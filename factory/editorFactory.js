// factory/editorFactory.js
import { createEditorApp } from '../modules/state/application/editorApplication.js';
import { createUiApplication } from '../modules/ui/application/uiApplication.js';
import { createInputApplication } from '../modules/input/application/inputApplication.js';

import { TextChunkModel } from '../model/editorModel.js';
import { VideoChunkModel } from '../extensions/video/model/videoModel.js';
import { ImageChunkModel } from '../extensions/image/model/ImageModel.js';

import { EditorLineModel} from '../model/editorLineModel.js';
import { textRenderer } from '../features/componets/textRenderer.js';
import { videoRenderer } from '../extensions/video/componets/videoRenderer.js';
import { imageRenderer } from '../extensions/image/componets/imageRenderer.js';

import { createEditorInputProcessor } from '../core/editorInputProcessor.js';
import { createEditorKeyHandler } from '../core/editorKeyHandler.js';

import { bindSelectionFeature } from '../features/selection/selectionFeatureBinder.js';
import { bindStyleButtons } from '../features/style/styleFeatureBinder.js';
import { bindAlignButtons } from '../features/align/alignFeatureBinder.js';

import { createDOMCreateService } from '../features/domCreateService.js';
import { DEFAULT_LINE_STYLE, DEFAULT_TEXT_STYLE } from '../constants/styleConstants.js';


import {chunkRegistry} from '../core/chunk/chunkRegistry.js';


/**
 * 에디터 인스턴스를 생성하는 최상위 팩토리
 */
export function createEditorFactory() {

  function create({ rootId, extensions = [] }) {
    /* ─────────────────────────────
     * 0️⃣ 내부 상태 및 생명주기 관리
     * ───────────────────────────── */
    let mounted   = false;
    let disposers = [];

    /* ─────────────────────────────
     * 1️⃣ 코어 서비스 초기화 (인스턴스 생성)
     * ───────────────────────────── */

    // 1. Text Chunk 핸들러
    chunkRegistry.register('text', {
        isText    : true,
        canSplit  : true,
        create    : (text = '', style = {}) => TextChunkModel('text', text, style),
        getLength : (chunk) => chunk.text.length,
        clone     : (chunk) => TextChunkModel('text', chunk.text, chunk.style),
        applyStyle: (chunk, patch) => TextChunkModel('text', chunk.text, { ...chunk.style, ...patch })
    });

    // 2. Video Chunk 핸들러
    chunkRegistry.register('video', {
        isText    : false,
        canSplit  : false,
        create    : (videoId, src) => VideoChunkModel(videoId, src),
        getLength : ()      => 1, // 비디오를 한 글자 공간으로 취급
        clone     : (chunk) => VideoChunkModel(chunk.videoId, chunk.src),
        applyStyle: (chunk) => chunk // 비디오는 스타일 무시
    });

    // 3. Image Chunk 핸들러
    chunkRegistry.register('image', {
        isText    : false,
        canSplit  : false,
        create    : (src) => ImageChunkModel(src),
        getLength : ()      => 1, // 이미지를 한 글자 공간으로 취급
        clone     : (chunk) => ImageChunkModel(chunk.src),
        applyStyle: (chunk) => chunk // 이미지는 스타일 무시
    });



    // DOM 구조 생성
    const domService = createDOMCreateService(rootId);
    domService.create();

    // 상태 관리 엔진
    const state = createEditorApp({
      editorState: [
        EditorLineModel(
          DEFAULT_LINE_STYLE.align,
          [TextChunkModel('text', '', { ...DEFAULT_TEXT_STYLE })]
        )
      ]
    });

    // UI 및 렌더링 엔진
    const ui = createUiApplication({
      rootId: `${rootId}-content`,
      rendererRegistry: {
        text : textRenderer,
        video: videoRenderer,
        image: imageRenderer
      }
    });

    // 입력 시스템
    const editorEl       = document.getElementById(`${rootId}-content`);
    const inputApp       = createInputApplication({ editorEl });
    const inputProcessor = createEditorInputProcessor(state, ui);

    /* ─────────────────────────────
     * 2️⃣ 내부 API 정의 (외부/확장 기능용)
     * ───────────────────────────── */
    const stateAPI = {
      get          : () => state.getState().present.editorState,
      save         : (newState) => state.saveEditorState(newState),
      saveCursor   : (cursor) => state.saveCursorState(cursor),
      undo         : () => state.undo(),
      redo         : () => state.redo(),
      isLineChanged: (i) => state.isLineChanged(i),
      getLines     : (idxs) => state.getLines(idxs),
      getLineRange : (s, e) => state.getLineRange(s, e)
    };

    const uiAPI = {
      render              : (data) => ui.render(data),
      renderLine          : (i, d) => ui.renderLine(i, d),
      restoreCursor       : (pos)  => ui.restoreSelectionPosition(pos),
      insertLine          : (i, a) => ui.insertNewLineElement(i, a),
      removeLine          : (i)    => ui.removeLineElement(i),
      getDomSelection     : ()     => ui.getSelectionRangesInDOM(),
      getSelectionPosition: ()     => ui.getSelectionPosition()
    };

    const editorAPI = {
      getToolbarButton(name) {
        const buttonIds = {
          video: `${rootId}-addVideoBtn`,
          image: `${rootId}-addImageBtn`,
          // 필요한 버튼 ID 매핑 추가
        };
        return document.getElementById(buttonIds[name] || name);
      }
    };

    /* ─────────────────────────────
     * 3️⃣ 라이프사이클 메서드
     * ───────────────────────────── */

    /**
     * mount: 이벤트 바인딩 및 초기 렌더링
     */
    function mount() {
      if (mounted) return;

      try {
        // A. 초기 렌더링 (이벤트보다 먼저 수행하여 DOM 안정화)
        const currentContent = stateAPI.get();
        uiAPI.render(currentContent);
        uiAPI.restoreCursor({ lineIndex: 0, offset: 0 });

        // B. 기본 입력 바인딩
        inputApp.bindInput(inputProcessor.processInput);
        // inputApp 자체의 해제 로직이 있다면 추적
        disposers.push(() => {
            console.log("Unbinding input processor...");
            // 필요한 경우 inputApp.unbindInput() 호출
        });

        // C. 키보드 서비스 바인딩
        const keyProcessor = createEditorKeyHandler({
          state: stateAPI,
          ui   : uiAPI
        });

        inputApp.bindKeydown({
          handleEnter    : keyProcessor.processEnter,
          handleBackspace: keyProcessor.processBackspace,
          undo           : keyProcessor.undo,
          redo: keyProcessor.redo
        });

        // D. 툴바 및 피처 바인딩
        const styleToolbar = {
          boldBtn       : document.getElementById(`${rootId}-boldBtn`),
          italicBtn     : document.getElementById(`${rootId}-italicBtn`),
          underLineBtn  : document.getElementById(`${rootId}-underLineBtn`),
          fontSizeSelect: document.getElementById(`${rootId}-fontSizeSelect`),
          textColorBtn  : document.getElementById(`${rootId}-textColorBtn`)
        };

        const alignToolbar = {
          leftBtn  : document.getElementById(`${rootId}-alignLeftBtn`),
          centerBtn: document.getElementById(`${rootId}-alignCenterBtn`),
          rightBtn : document.getElementById(`${rootId}-alignRightBtn`)
        };

        // Selection 피처 (필요 시 disposer 반환하도록 구성 권장)
        bindSelectionFeature(stateAPI, uiAPI, editorEl, { ...styleToolbar, ...alignToolbar });

        // 스타일 및 정렬 버튼 (반환된 해제 함수 저장)
        const styleDisposer = bindStyleButtons(stateAPI, uiAPI, styleToolbar);
        if (styleDisposer) disposers.push(styleDisposer);

        const alignDisposer = bindAlignButtons(stateAPI, uiAPI, alignToolbar);
        if (alignDisposer) disposers.push(alignDisposer);

        // E. 익스텐션 실행
        extensions.forEach(ext => {
          console.log("Setting up extension:", ext);

          if (!ext) return;
          const extDisposer = ext.setup?.({ stateAPI, uiAPI, editorAPI });
          
          // setup에서 직접 함수를 반환하거나, 객체에 destroy 메서드가 있는 경우 모두 대응
          if (typeof extDisposer === 'function') {
            disposers.push(extDisposer);
          } else if (ext.destroy) {
            disposers.push(() => ext.destroy());
          }
        });

        mounted = true;
        console.log(`[SparrowEditor] Instance ${rootId} mounted.`);
      } catch (error) {
        console.error(`[SparrowEditor] Mount failed:`, error);
        unmount(); // 실패 시 부분적으로 바인딩된 리스너 정리
      }
    }

    /**
     * unmount: 이벤트 리스너 제거 (역순 실행)
     */
    function unmount() {
      if (!mounted) return;

      console.log(`[SparrowEditor] Unmounting ${rootId}...`);
      
      // 등록된 순서의 반대(LIFO)로 해제하여 의존성 문제 방지
      while (disposers.length > 0) {
        const dispose = disposers.pop();
        try {
          if (typeof dispose === 'function') dispose();
        } catch (e) {
          console.error(`[SparrowEditor] Error during disposal:`, e);
        }
      }

      mounted = false;
    }

    /**
     * destroy: 언마운트 및 인스턴스 메모리 해제
     */
    function destroy() {
      unmount();
      
      // 각 시스템의 내부 파괴 로직 실행
      ui.destroy();
      state.destroy();
      inputApp.destroy();
      domService.destroy();

      console.log(`[SparrowEditor] Instance ${rootId} destroyed.`);
    }

    /* ─────────────────────────────
     * 4️⃣ 외부 노출 인터페이스
     * ───────────────────────────── */
    return {
      // 제어용 메서드
      mount,
      unmount,
      destroy,
      
      // 상태 확인용 (필요 시)
      isMounted: () => mounted,
      
      // 원본 참조 (디버깅/고급 제어용)
      state,
      ui,
      stateAPI,
      uiAPI
    };
  }

  return { create };
}
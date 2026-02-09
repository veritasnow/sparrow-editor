// factory/editorFactory.js
import { createEditorBootstrap } from './editorBootstrapFactory.js';

import { createUiApplication } from '../modules/ui/application/uiApplication.js';
import { createInputApplication } from '../modules/input/application/inputApplication.js';

import { textRenderer } from '../features/componets/textRenderer.js';
import { videoRenderer } from '../extensions/video/componets/videoRenderer.js';
import { imageRenderer } from '../extensions/image/componets/imageRenderer.js';
import { tableRenderer } from '../extensions/table/componets/tableRenderer.js';

import { createEditorInputProcessor } from '../core/input/editorInputProcessor.js';
import { createEditorKeyHandler } from '../core/keyInput/editorKeyHandler.js';

import { createSelectionService } from '../core/selection/domSelectionEngine.js';

import { bindSelectionFeature } from '../core/selection/selectionFeatureBinder.js';
import { bindStyleButtons } from '../features/style/styleFeatureBinder.js';
import { bindAlignButtons } from '../features/align/alignFeatureBinder.js';

import { registerDefaultChunks } from './chunkRegistryFactory.js';
import { createEditorAPI } from './editorApiFactory.js';

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

    // 메인 본문 영역의 고유 키 설정
    const MAIN_CONTENT_KEY = `${rootId}-content`;

    /* ─────────────────────────────
     * 1️⃣ 코어 서비스 초기화 (인스턴스 생성)
     * ───────────────────────────── */
    // 청크생성
    registerDefaultChunks();

    // DOM구조, 상태관리 초기화
    const { state, domService } = createEditorBootstrap({
      rootId,
      contentKey: MAIN_CONTENT_KEY
    });

    // UI 및 렌더링 엔진
    const ui = createUiApplication({
      rootId: MAIN_CONTENT_KEY,
      rendererRegistry: {
        text  : textRenderer,
        video : videoRenderer,
        image : imageRenderer,
        table : tableRenderer
      }
    });

    const editorEl       = document.getElementById(MAIN_CONTENT_KEY);

    // 선택 시스템
    const domSelection   = createSelectionService({ root: editorEl });

    // 입력 시스템
    const inputApp       = createInputApplication({ editorEl });
    
    // inputProcessor 생성 시 MAIN_CONTENT_KEY 전달
    const inputProcessor = createEditorInputProcessor(state, ui, domSelection, MAIN_CONTENT_KEY);

    /* ─────────────────────────────
     * 2️⃣ 내부 API 정의 (Key 기반 대응)
     * ───────────────────────────── */
    const { stateAPI, uiAPI, selectionAPI } = createEditorAPI({
      state,
      ui,
      domSelection,
    });

    const editorAPI = {
      getToolbarButton(name) {
        const buttonIds = {
          video: `${rootId}-addVideoBtn`,
          image: `${rootId}-addImageBtn`,
          table: `${rootId}-addTableBtn`,
        };
        return document.getElementById(buttonIds[name] || name);
      }
    };

    /* ─────────────────────────────
     * 3️⃣ 라이프사이클 메서드
     * ───────────────────────────── */

    function mount() {
      if (mounted) return;

      try {
        // A. 초기 렌더링 (메인 컨텐츠 로드)
        const currentContent = stateAPI.get(MAIN_CONTENT_KEY);
        uiAPI.render(currentContent, MAIN_CONTENT_KEY);
        
        selectionAPI.restoreCursor({
          containerId : MAIN_CONTENT_KEY,
          lineIndex   : 0,
          anchor: {
            chunkIndex : 0,
            type       : 'text',
            offset     : 0
          }
        });

        // B. 입력 이벤트 바인딩
        inputApp.bindInput(inputProcessor.processInput);
        disposers.push(() => {
          console.log(`[${rootId}] Input processor unbinding...`);
        });

        // C. 키보드 핸들러 (Enter, Backspace 등)
        const keyProcessor = createEditorKeyHandler({
          state       : stateAPI,
          ui          : uiAPI,
          domSelection: domSelection
        });

        inputApp.bindKeydown({
          syncInput        : inputProcessor.syncInput,
          processEnter     : keyProcessor.processEnter,
          processBackspace : keyProcessor.processBackspace,
          processDelete    : keyProcessor.processDelete,
          processPaste     : keyProcessor.processPaste,
          undo             : keyProcessor.undo,
          redo             : keyProcessor.redo
        });

        // D. 툴바 피처 바인딩
        const styleToolbar = {
          boldBtn         : document.getElementById(`${rootId}-boldBtn`),
          italicBtn       : document.getElementById(`${rootId}-italicBtn`),
          underLineBtn    : document.getElementById(`${rootId}-underLineBtn`),
          fontSizeSelect  : document.getElementById(`${rootId}-fontSizeSelect`),
          fontFamilySelect: document.getElementById(`${rootId}-fontFamilySelect`),
          textColorBtn    : document.getElementById(`${rootId}-textColorBtn`)
        };

        const alignToolbar = {
          leftBtn   : document.getElementById(`${rootId}-alignLeftBtn`),
          centerBtn : document.getElementById(`${rootId}-alignCenterBtn`),
          rightBtn  : document.getElementById(`${rootId}-alignRightBtn`)
        };

        // Selection 상태에 따른 버튼 활성화 바인딩
        bindSelectionFeature(stateAPI, selectionAPI, editorEl, { ...styleToolbar, ...alignToolbar });

        // 스타일 적용 버튼 이벤트 바인딩
        const styleDisposer = bindStyleButtons(stateAPI, uiAPI, selectionAPI, styleToolbar);
        if (styleDisposer) disposers.push(styleDisposer);

        const alignDisposer = bindAlignButtons(stateAPI, uiAPI, selectionAPI, alignToolbar);
        if (alignDisposer) disposers.push(alignDisposer);


        // E. 익스텐션(Video, Image, Table 등) 실행
        extensions.forEach(ext => {
          if (!ext) return;
          console.log(`[${rootId}] Extension setup:`, ext);
          
          const extDisposer = ext.setup({ stateAPI, uiAPI, selectionAPI, editorAPI });
          
          if (typeof extDisposer === 'function') {
            disposers.push(extDisposer);
          } else if (ext.destroy) {
            disposers.push(() => ext.destroy());
          }
        });

        mounted = true;
        console.log(`[SparrowEditor] ${rootId} mounted with MAIN_CONTENT_KEY.`);
      } catch (error) {
        console.error(`[SparrowEditor] Mount failed:`, error);
        unmount(); 
      }
    }

    function unmount() {
      if (!mounted) return;

      console.log(`[SparrowEditor] Unmounting ${rootId}...`);
      
      while (disposers.length > 0) {
        const dispose = disposers.pop();
        try {
          if (typeof dispose === 'function') dispose();
        } catch (e) {
          console.error(`[SparrowEditor] Disposal error:`, e);
        }
      }

      mounted = false;
    }

    function destroy() {
      unmount();
      
      ui.destroy();
      state.destroy();
      inputApp.destroy();
      domService.destroy();

      console.log(`[SparrowEditor] ${rootId} instance completely destroyed.`);
    }

    /* ─────────────────────────────
     * 4️⃣ 외부 노출 인터페이스
     * ───────────────────────────── */
    return {
      mount,
      unmount,
      destroy,
      isMounted: () => mounted,
      state,
      ui,
      stateAPI,
      uiAPI
    };
  }

  return { create };
}
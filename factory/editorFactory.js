// factory/editorFactory.js
import { createEditorApp } from '../modules/state/application/editorApplication.js';
import { createUiApplication } from '../modules/ui/application/uiApplication.js';
import { createInputApplication } from '../modules/input/application/inputApplication.js';

import { TextChunkModel } from '../model/editorModel.js';
import { VideoChunkModel } from '../extensions/video/model/videoModel.js';
import { ImageChunkModel } from '../extensions/image/model/ImageModel.js';
import { TableChunkModel } from '../extensions/table/model/tableModel.js';

import { EditorLineModel } from '../model/editorLineModel.js';
import { textRenderer } from '../features/componets/textRenderer.js';
import { videoRenderer } from '../extensions/video/componets/videoRenderer.js';
import { imageRenderer } from '../extensions/image/componets/imageRenderer.js';
import { tableRenderer } from '../extensions/table/componets/tableRenderer.js';

import { createEditorInputProcessor } from '../core/input/editorInputProcessor.js';
import { createEditorKeyHandler } from '../core/keyInput/editorKeyHandler.js';

import { createSelectionService } from '../core/selection/domSelectionEngine.js';

import { bindSelectionFeature } from '../features/selection/selectionFeatureBinder.js';
import { bindStyleButtons } from '../features/style/styleFeatureBinder.js';
import { bindAlignButtons } from '../features/align/alignFeatureBinder.js';

import { createDOMCreateService } from '../features/domCreateService.js';
import { DEFAULT_LINE_STYLE, DEFAULT_TEXT_STYLE } from '../constants/styleConstants.js';

import { chunkRegistry } from '../core/chunk/chunkRegistry.js';

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

    // 1. Text Chunk 핸들러
    chunkRegistry.register('text', {
      isText    : true,
      canSplit  : true,
      create    : (text = '', style = {}) => TextChunkModel('text', text, style),
      getLength : (chunk) => chunk.text.length,
      clone     : (chunk) => TextChunkModel('text', chunk.text, { ...chunk.style }),
      applyStyle: (chunk, patch) => TextChunkModel('text', chunk.text, { ...chunk.style, ...patch })
    });

    // 2. Video Chunk 핸들러
    chunkRegistry.register('video', {
      isText    : false,
      canSplit  : false,
      create    : (videoId, src) => VideoChunkModel(videoId, src),
      getLength : () => 1,
      clone     : (chunk) => VideoChunkModel(chunk.videoId, chunk.src),
      applyStyle: (chunk) => chunk
    });

    // 3. Image Chunk 핸들러
    chunkRegistry.register('image', {
      isText    : false,
      canSplit  : false,
      create    : (src) => ImageChunkModel(src),
      getLength : () => 1,
      clone     : (chunk) => ImageChunkModel(chunk.src),
      applyStyle: (chunk) => chunk
    });

    // 4. Table Chunk 핸들러
    chunkRegistry.register('table', {
        isText   : false,
        canSplit : false,
        create   : (rows, cols) => TableChunkModel(rows, cols),
        getLength: () => 1,
        clone    : (chunk) => {
            return {
                ...chunk,
                data: chunk.data.map(row =>
                    row.map(cell => ({
                        id: cell.id, 
                        style: { ...cell.style } 
                    }))
                ),
                style: { ...chunk.style }
            };
        },
        applyStyle: (chunk, patch) => ({ ...chunk, style: { ...chunk.style, ...patch } })
    });

    // DOM 구조 생성 (HTML 기본 뼈대)
    const domService = createDOMCreateService(rootId);
    domService.create();

    // 💡 상태 관리 엔진 (메인 영역 데이터로 초기화)
    const state = createEditorApp({
      [MAIN_CONTENT_KEY]: [
        EditorLineModel(
          DEFAULT_LINE_STYLE.align,
          [TextChunkModel('text', '', { ...DEFAULT_TEXT_STYLE })]
        )
      ]
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
    const stateAPI = {
      get           : (key = MAIN_CONTENT_KEY) => state.getState(key),
      save          : (key, data, options = { saveHistory: true }) => {
        if (data === undefined) {
          state.saveEditorState(MAIN_CONTENT_KEY, data, options);
        } else {
          state.saveEditorState(key, data, options);
        }
      },
      // 💡 인라인 서비스에서 호출할 배치 저장 API 추가
      saveBatch     : (updates, options = { saveHistory: true }) => {
        // updates: [{ key, newState, ranges }, ...] 형태의 배열을 기대함
        state.saveEditorBatchState(updates, options);
      },      
      saveCursor    : (cursor) => state.saveCursorState(cursor),
      getCursor     : () => state.getCursor(),
      undo          : () => state.undo(),
      redo          : () => state.redo(),
      isLineChanged : (lineIndex, key = MAIN_CONTENT_KEY) => state.isLineChanged(key, lineIndex),
      getLines      : (idxs, key = MAIN_CONTENT_KEY) => state.getLines(key, idxs),
      getLineRange  : (start, end, key = MAIN_CONTENT_KEY) => state.getLineRange(key, start, end),
    };

    /**
     * 💡 uiAPI: 모든 렌더링 관련 함수가 targetKey를 선택적으로 받도록 개선
     */
    const uiAPI = {
      render                      : (data, key = MAIN_CONTENT_KEY) => ui.render(data, key),
      renderLine                  : (i, d, key = MAIN_CONTENT_KEY, p = null) => ui.renderLine(i, d, key, p),
      renderChunk                 : (li, ci, d, key = MAIN_CONTENT_KEY) => ui.renderChunk(li, ci, d, key),
      ensureFirstLine             : (key = MAIN_CONTENT_KEY) => ui.ensureFirstLine(key),
      shiftLinesDown              : (from, key = MAIN_CONTENT_KEY) => ui.shiftLinesDown(from, key),
      insertLine                  : (i, a, key = MAIN_CONTENT_KEY) => ui.insertLine(i, a, key),
      removeLine                  : (i, key = MAIN_CONTENT_KEY) => ui.removeLine(i, key),
      restoreCursor               : (pos) => domSelection.restoreCursor(pos),
      restoreMultiBlockCursor     : (positions) => domSelection.restoreMultiBlockCursor(positions),
      getDomSelection             : (targetKey) => domSelection.getDomSelection(targetKey),
      getSelectionPosition        : () => domSelection.getSelectionPosition(),
      getInsertionAbsolutePosition: () => domSelection.getInsertionAbsolutePosition(),
      updateLastValidPosition     : () => domSelection.updateLastValidPosition(),
      getLastValidPosition        : () => domSelection.getLastValidPosition(),
      getActiveKey                : () => domSelection.getActiveKey(),
      getActiveKeys               : () => domSelection.getActiveKeys(),
      getLastActiveKey            : () => domSelection.getLastActiveKey(),
      // DOM -> Model 파싱 브릿지
      parseLineDOM                : (p, chunks, sel, off, idx) => ui.parseLineDOM(p, chunks, sel, off, idx),
      extractTableDataFromDOM     : (tableEl) => ui.extractTableDataFromDOM(tableEl)
    };

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
        
        uiAPI.restoreCursor({
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
          processEnter     : keyProcessor.processEnter,
          processBackspace : keyProcessor.processBackspace,
          processDelete    : keyProcessor.processDelete,
          processPaste     : keyProcessor.processPaste,
          undo             : keyProcessor.undo,
          redo             : keyProcessor.redo
        });

        // D. 툴바 피처 바인딩
        const styleToolbar = {
          boldBtn       : document.getElementById(`${rootId}-boldBtn`),
          italicBtn     : document.getElementById(`${rootId}-italicBtn`),
          underLineBtn  : document.getElementById(`${rootId}-underLineBtn`),
          fontSizeSelect: document.getElementById(`${rootId}-fontSizeSelect`),
          textColorBtn  : document.getElementById(`${rootId}-textColorBtn`)
        };

        const alignToolbar = {
          leftBtn   : document.getElementById(`${rootId}-alignLeftBtn`),
          centerBtn : document.getElementById(`${rootId}-alignCenterBtn`),
          rightBtn  : document.getElementById(`${rootId}-alignRightBtn`)
        };

        // Selection 상태에 따른 버튼 활성화 바인딩
        bindSelectionFeature(stateAPI, uiAPI, editorEl, { ...styleToolbar, ...alignToolbar });

        // 스타일 적용 버튼 이벤트 바인딩
        const styleDisposer = bindStyleButtons(stateAPI, uiAPI, styleToolbar);
        if (styleDisposer) disposers.push(styleDisposer);

        const alignDisposer = bindAlignButtons(stateAPI, uiAPI, alignToolbar);
        if (alignDisposer) disposers.push(alignDisposer);

        // E. 익스텐션(Video, Image, Table 등) 실행
        extensions.forEach(ext => {
          if (!ext) return;
          console.log(`[${rootId}] Extension setup:`, ext);
          
          const extDisposer = ext.setup?.({ stateAPI, uiAPI, editorAPI });
          
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
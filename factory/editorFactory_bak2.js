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
    const MAIN_CONTENT_KEY = `${rootId}-content`;

    /* ─────────────────────────────
     * 1️⃣ 코어 서비스 초기화
     * ───────────────────────────── */

    // Chunk Registry 등록 (텍스트, 비디오, 이미지, 테이블)
    chunkRegistry.register('text', {
      isText: true,
      canSplit: true,
      create: (text = '', style = {}) => TextChunkModel('text', text, style),
      getLength: (chunk) => chunk.text.length,
      clone: (chunk) => TextChunkModel('text', chunk.text, chunk.style),
      applyStyle: (chunk, patch) => TextChunkModel('text', chunk.text, { ...chunk.style, ...patch })
    });

    chunkRegistry.register('video', {
      isText: false,
      canSplit: false,
      create: (videoId, src) => VideoChunkModel(videoId, src),
      getLength: () => 1,
      clone: (chunk) => VideoChunkModel(chunk.videoId, chunk.src),
      applyStyle: (chunk) => chunk
    });

    chunkRegistry.register('image', {
      isText: false,
      canSplit: false,
      create: (src) => ImageChunkModel(src),
      getLength: () => 1,
      clone: (chunk) => ImageChunkModel(chunk.src),
      applyStyle: (chunk) => chunk
    });

    chunkRegistry.register('table', {
      isText: false,
      canSplit: false,
      create: (rows, cols) => TableChunkModel(rows, cols),
      getLength: () => 1,
      clone: (chunk) => ({
        ...chunk,
        data: chunk.data.map(row =>
          row.map(cell => ({
            ...cell,
            style: { ...cell.style },
            chunks: cell.chunks ? cell.chunks.map(c => ({ ...c, style: { ...c.style } })) : undefined
          }))
        ),
        style: { ...chunk.style }
      }),
      applyStyle: (chunk) => chunk
    });

    // DOM/Core 초기화
    const domService = createDOMCreateService(rootId);
    domService.create();

    const state = createEditorApp({
      [MAIN_CONTENT_KEY]: [
        EditorLineModel(DEFAULT_LINE_STYLE.align, [TextChunkModel('text', '', { ...DEFAULT_TEXT_STYLE })])
      ]
    });

    const ui = createUiApplication({
      rootId: MAIN_CONTENT_KEY,
      rendererRegistry: {
        text: textRenderer, video: videoRenderer, image: imageRenderer, table: tableRenderer
      }
    });

    const editorEl = document.getElementById(MAIN_CONTENT_KEY);
    const domSelection = createSelectionService({ root: editorEl });
    const inputApp = createInputApplication({ editorEl });
    const inputProcessor = createEditorInputProcessor(state, ui, domSelection, MAIN_CONTENT_KEY);

    /* ─────────────────────────────
     * 2️⃣ 내부 API 정의 (중복 로직 통합 및 동적 타겟팅)
     * ───────────────────────────── */

    /**
     * @private 현재 작업 대상 컨테이너 키 결정 유틸리티
     */
    const getTargetKey = (explicitKey) => 
        explicitKey || domSelection.getActiveKey() || MAIN_CONTENT_KEY;

    const stateAPI = {
      get: (key) => state.getState(getTargetKey(key)),
      
      save: (keyOrData, data) => {
        // 인자가 1개면 현재 활성 영역에 저장, 2개면 명시된 키에 저장
        const isExplicit = data !== undefined;
        const targetKey = isExplicit ? keyOrData : getTargetKey();
        const stateData = isExplicit ? data : keyOrData;
        state.saveEditorState(targetKey, stateData);
      },
      
      saveCursor: (cursor) => state.saveCursorState(cursor),
      undo: () => state.undo(),
      redo: () => state.redo(),
      
      isLineChanged: (lineIdx, key) => state.isLineChanged(getTargetKey(key), lineIdx),
      getLines: (idxs, key) => state.getLines(getTargetKey(key), idxs),
      getLineRange: (start, end, key) => state.getLineRange(getTargetKey(key), start, end),
    };

    const uiAPI = {
      render: (data, key) => ui.render(data, getTargetKey(key)),
      renderLine: (lineIdx, data, key) => ui.renderLine(lineIdx, data, getTargetKey(key)),
      insertLine: (lineIdx, align, key) => ui.insertNewLineElement(lineIdx, getTargetKey(key), align),
      removeLine: (lineIdx, key) => ui.removeLineElement(lineIdx, getTargetKey(key)),
      restoreCursor: (pos) => domSelection.restoreCursor(pos),
      getDomSelection: () => domSelection.getDomSelection(),
      getSelectionPosition: () => domSelection.getSelectionPosition(),
      getInsertionAbsolutePosition: () => domSelection.getInsertionAbsolutePosition(),
      updateLastValidPosition: () => domSelection.updateLastValidPosition(),
      getLastValidPosition: () => domSelection.getLastValidPosition(),
      getActiveKey: () => domSelection.getActiveKey(),
      getLastActiveKey:() => domSelection.getLastActiveKey(),
    };

    const editorAPI = {
      getToolbarButton(name) {
        const buttonIds = { video: `${rootId}-addVideoBtn`, image: `${rootId}-addImageBtn`, table: `${rootId}-addTableBtn` };
        return document.getElementById(buttonIds[name] || name);
      }
    };

    /* ─────────────────────────────
     * 3️⃣ 라이프사이클 메서드
     * ───────────────────────────── */

    function mount() {
      if (mounted) return;
      try {
        // 초기 본문 로드 및 커서 설정
        const currentContent = stateAPI.get(MAIN_CONTENT_KEY);
        uiAPI.render(currentContent, MAIN_CONTENT_KEY);
        uiAPI.restoreCursor({
          containerId: MAIN_CONTENT_KEY,
          lineIndex: 0,
          anchor: { chunkIndex: 0, type: 'text', offset: 0 }
        });

        // 입력 바인딩
        inputApp.bindInput(inputProcessor.processInput);

        const keyProcessor = createEditorKeyHandler({ state: stateAPI, ui: uiAPI, domSelection });
        inputApp.bindKeydown({
          handleEnter: keyProcessor.processEnter,
          handleBackspace: keyProcessor.processBackspace,
          undo: keyProcessor.undo,
          redo: keyProcessor.redo
        });

        // 툴바 및 기능 바인딩
        const styleToolbar = {
          boldBtn: document.getElementById(`${rootId}-boldBtn`),
          italicBtn: document.getElementById(`${rootId}-italicBtn`),
          underLineBtn: document.getElementById(`${rootId}-underLineBtn`),
          fontSizeSelect: document.getElementById(`${rootId}-fontSizeSelect`),
          textColorBtn: document.getElementById(`${rootId}-textColorBtn`)
        };

        const alignToolbar = {
          leftBtn: document.getElementById(`${rootId}-alignLeftBtn`),
          centerBtn: document.getElementById(`${rootId}-alignCenterBtn`),
          rightBtn: document.getElementById(`${rootId}-alignRightBtn`)
        };

        bindSelectionFeature(stateAPI, uiAPI, editorEl, { ...styleToolbar, ...alignToolbar });
        
        const sDisp = bindStyleButtons(stateAPI, uiAPI, styleToolbar);
        const aDisp = bindAlignButtons(stateAPI, uiAPI, alignToolbar);
        if (sDisp) disposers.push(sDisp);
        if (aDisp) disposers.push(aDisp);

        // 익스텐션 설정
        extensions.forEach(ext => {
          if (!ext) return;
          const extDisp = ext.setup?.({ stateAPI, uiAPI, editorAPI });
          if (typeof extDisp === 'function') disposers.push(extDisp);
        });

        mounted = true;
      } catch (error) {
        console.error(`[SparrowEditor] Mount failed:`, error);
        unmount(); 
      }
    }

    function unmount() {
      if (!mounted) return;
      disposers.forEach(d => { try { d?.(); } catch(e){} });
      disposers = [];
      mounted = false;
    }

    function destroy() {
      unmount();
      ui.destroy();
      state.destroy();
      inputApp.destroy();
      domService.destroy();
    }

    return { mount, unmount, destroy, isMounted: () => mounted, state, ui, stateAPI, uiAPI };
  }

  return { create };
}
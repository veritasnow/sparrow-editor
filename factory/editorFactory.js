// factory/editorFactory.js
import { createEditorApp } from '../state/application/editorApplication.js';
import { createUiApplication } from '../ui/application/uiApplication.js';
import { createInputApplication } from '../input/application/inputApplication.js';

import { EditorLineModel, TextChunkModel } from '../model/editorModel.js';
import { textRenderer } from '../renderers/textRenderer.js';
import { videoRenderer } from '../renderers/videoRenderer.js';

import { createEditorInputService } from '../core/editorInputService.js';
import { createEditorKeyService } from '../core/editorKeyService.js';

import { bindSelectionFeature } from '../features/selection/selectionFeatureBinder.js';
import { bindStyleButtons } from '../features/style/styleFeatureBinder.js';
import { bindAlignButtons } from '../features/align/alignFeatureBinder.js';

import { createDOMCreateService } from '../features/domCreateService.js';
import { DEFAULT_LINE_STYLE, DEFAULT_TEXT_STYLE } from '../constants/styleConstants.js';

export function createEditorFactory() {

  function create({ rootId, extensions = [] }) {

    /* ─────────────────────────────
     * 내부 상태
     * ───────────────────────────── */
    let mounted = false;
    const disposers = [];

    /* ─────────────────────────────
     * 1️⃣ DOM 생성 (단발성)
     * ───────────────────────────── */
    createDOMCreateService(rootId);

    /* ─────────────────────────────
     * 2️⃣ Editor State
     * ───────────────────────────── */
    const app = createEditorApp({
      editorState: [
        EditorLineModel(
          DEFAULT_LINE_STYLE.align,
          [TextChunkModel('text', '', { ...DEFAULT_TEXT_STYLE })]
        )
      ]
    });

    /* ─────────────────────────────
     * 3️⃣ UI Application
     * ───────────────────────────── */
    const ui = createUiApplication({
      rootId: `${rootId}-content`,
      rendererRegistry: {
        text: textRenderer,
        video: videoRenderer
      }
    });

    /* ─────────────────────────────
     * 4️⃣ Input System
     * ───────────────────────────── */
    const editorEl = document.getElementById(`${rootId}-content`);
    const inputApp = createInputApplication({ editorEl });
    const inputProcessor = createEditorInputService(app, ui);

    /* ─────────────────────────────
     * 5️⃣ API 정의
     * ───────────────────────────── */
    const stateAPI = {
      get: () => app.getState().present.editorState,
      save: (state) => app.saveEditorState(state),
      saveCursor: (cursor) => app.saveCursorState(cursor),
      undo: () => app.undo(),
      redo: () => app.redo(),
      isLineChanged: (i) => app.isLineChanged(i),
      getLines: (idxs) => app.getLines(idxs),
      getLineRange: (s, e) => app.getLineRange(s, e)
    };

    const uiAPI = {
      render: (state) => ui.render(state),
      renderLine: (i, d) => ui.renderLine(i, d),
      restoreCursor: (pos) => ui.restoreSelectionPosition(pos),
      insertLine: (i, a) => ui.insertNewLineElement(i, a),
      removeLine: (i) => ui.removeLineElement(i),
      getDomSelection: () => ui.getSelectionRangesInDOM(),
      getSelectionPosition: () => ui.getSelectionPosition()
    };

    const editorAPI = {
      getToolbarButton(name) {
        if (name === 'video') {
          return document.getElementById(`${rootId}-addVideoBtn`);
        }
        return null;
      }
    };

    /* ─────────────────────────────
     * mount
     * ───────────────────────────── */
    function mount() {
      if (mounted) return;
      mounted = true;

      // input
      inputApp.bindInput(inputProcessor.processInput);
      disposers.push(() => inputApp.destroy?.());

      // keyboard
      const keyProcessor = createEditorKeyService({
        state: stateAPI,
        ui: uiAPI
      });

      inputApp.bindKeydown({
        handleEnter: keyProcessor.processEnter,
        handleBackspace: keyProcessor.processBackspace,
        undo: keyProcessor.undo,
        redo: keyProcessor.redo
      });

      // features
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

      bindSelectionFeature(
        stateAPI,
        uiAPI,
        editorEl,
        { ...styleToolbar, ...alignToolbar }
      );

      bindStyleButtons(stateAPI, uiAPI, styleToolbar);
      bindAlignButtons(stateAPI, uiAPI, alignToolbar);

      // extensions
      extensions.forEach(ext => {
        ext?.setup?.({ stateAPI, uiAPI, editorAPI });
        ext?.destroy && disposers.push(() => ext.destroy());
      });

      // initial render
      const state = app.getState().present.editorState;
      ui.render(state);
      ui.restoreSelectionPosition({ lineIndex: 0, offset: 0 });
    }

    /* ─────────────────────────────
     * destroy
     * ───────────────────────────── */
    function destroy() {
      if (!mounted) return;
      mounted = false;

      while (disposers.length) {
        disposers.pop()();
      }

      ui.destroy?.();
      app.destroy?.();
    }

    /* ─────────────────────────────
     * Context 반환
     * ───────────────────────────── */
    return {
      app,
      ui,
      inputApp,
      stateAPI,
      uiAPI,
      editorAPI,
      extensions,
      mount,
      destroy
    };
  }

  return { create };
}

import { createEditorApp } from './state/application/editorApplication.js';
import { createUiApplication } from './ui/application/uiApplication.js';
import { createInputApplication } from './input/application/inputApplication.js';

import { EditorLineModel, TextChunkModel } from './model/editorModel.js';
import { textRenderer } from './renderers/textRenderer.js';
import { videoRenderer } from './renderers/videoRenderer.js';

import { createEditorInputService } from './core/editorInputService.js';
import { createEditorKeyService } from './core/editorKeyService.js';

import { bindSelectionFeature } from './features/selection/selectionFeatureBinder.js';
import { bindStyleButtons } from './features/style/styleFeatureBinder.js';

import { bindAlignButtons } from './features/align/alignFeatureBinder.js';
import { bindVideoButton } from './features/video/videoFeatureBinder.js';

import { createDOMCreateService } from './features/domCreateService.js';
import { DEFAULT_LINE_STYLE, DEFAULT_TEXT_STYLE } from './constants/styleConstants.js';


// 🧩 메인 엔트리
export function createEditor(rootId) {

  // ─────────────────────────────
  // 1️⃣ DOM 생성
  // ─────────────────────────────
  createDOMCreateService(rootId);


  // ─────────────────────────────
  // 2️⃣ 상태 관리(App)
  // ─────────────────────────────
  const app = createEditorApp({
    editorState: [
      EditorLineModel(
        DEFAULT_LINE_STYLE.align,
        [ TextChunkModel('text', '', { ...DEFAULT_TEXT_STYLE }) ]
      )
    ]
  });


  // ─────────────────────────────
  // 3️⃣ UI 애플리케이션
  // ─────────────────────────────
  const ui = createUiApplication({
    rootId           : `${rootId}-content`,
    rendererRegistry : {
      text  : textRenderer,
      video : videoRenderer
    }
  });

  function initCursor(pos) {
    const state = app.getState().present.editorState;
    ui.render(state);
    ui.restoreSelectionPosition(pos);
  }


  // ─────────────────────────────
  // 4️⃣ 입력(Input) 처리
  // ─────────────────────────────
  const editorEl       = document.getElementById(`${rootId}-content`);
  const inputApp       = createInputApplication({ editorEl });
  const inputProcessor = createEditorInputService(app, ui);

  inputApp.bindInput(inputProcessor.processInput);


  // ─────────────────────────────
  // 5️⃣ State / UI API 노출
  // ─────────────────────────────
  const stateAPI = {
    get          : ()         => app.getState().present.editorState,
    save         : (state)    => app.saveEditorState(state),
    saveCursor   : (cursor)  => app.saveCursorState(cursor),
    undo         : ()         => app.undo(),
    redo         : ()         => app.redo(),
    isLineChanged: (i)        => app.isLineChanged(i),
    getLines     : (idxs)     => app.getLines(idxs),
    getLineRange : (s, e)     => app.getLineRange(s, e)
  };

  const uiAPI = {
    render                  : (state) => ui.render(state),
    renderLine              : (i, d)  => ui.renderLine(i, d),
    restoreCursor           : (pos)   => ui.restoreSelectionPosition(pos),
    insertLine              : (i, a)  => ui.insertNewLineElement(i, a),
    removeLine              : (i)     => ui.removeLineElement(i),
    getDomSelection         : ()      => ui.getSelectionRangesInDOM(),
    getSelectionPosition    : ()      => ui.getSelectionPosition()
  };


  // ─────────────────────────────
  // 6️⃣ 키 이벤트
  // ─────────────────────────────
  const keyProcessor = createEditorKeyService({ state: stateAPI, ui: uiAPI });

  inputApp.bindKeydown({
    handleEnter     : keyProcessor.processEnter,
    handleBackspace : keyProcessor.processBackspace,
    undo            : keyProcessor.undo,
    redo            : keyProcessor.redo
  });


  // ─────────────────────────────
  // 7️⃣ 툴바 엘리먼트 수집
  // ─────────────────────────────
  const styleToolbar = {
    boldBtn        : document.getElementById(`${rootId}-boldBtn`),
    italicBtn      : document.getElementById(`${rootId}-italicBtn`),
    underLineBtn   : document.getElementById(`${rootId}-underLineBtn`),
    fontSizeSelect : document.getElementById(`${rootId}-fontSizeSelect`),
    textColorBtn   : document.getElementById(`${rootId}-textColorBtn`),
  };

  const alignToolbar = {
    leftBtn   : document.getElementById(`${rootId}-alignLeftBtn`),
    centerBtn : document.getElementById(`${rootId}-alignCenterBtn`),
    rightBtn  : document.getElementById(`${rootId}-alignRightBtn`)
  };


  // ─────────────────────────────
  // 8️⃣ Selection Feature (UI 동기화 전담)
  // ─────────────────────────────
  bindSelectionFeature(
    stateAPI,
    uiAPI,
    editorEl,
    { ...styleToolbar, ...alignToolbar }
  );


  // ─────────────────────────────
  // 9️⃣ 버튼 기능 바인딩
  // ─────────────────────────────
  bindStyleButtons(stateAPI, uiAPI, styleToolbar);
  bindAlignButtons(stateAPI, uiAPI, alignToolbar);

  bindVideoButton(
    document.getElementById(`${rootId}-addVideoBtn`),
    stateAPI,
    uiAPI
  );


  // ─────────────────────────────
  // 🔟 초기 렌더링
  // ─────────────────────────────
  initCursor({ lineIndex: 0, offset: 0 });
}

import { createEditorApp } from './state/application/editorApplication.js';
import { createUiApplication } from './ui/application/uiApplication.js';
import { createInputApplication } from './input/application/inputApplication.js'; 
import { EditorLineModel, TextChunkModel } from './model/editorModel.js';
import { textRenderer } from './renderers/textRenderer.js';
import { videoRenderer } from './renderers/videoRenderer.js';
import { createEditorInputService } from './core/editorInputService.js'; 
import { createEditorKeyService } from './core/editorKeyService.js'; 

// 🔥 새로 추가됨
import { bindSelectionFeature } from './features/selection/selectionFeatureBinder.js';

import { bindStyleButtons } from './features/style/styleFeatureBinder.js';
import { bindAlignButtons } from './features/align/alignFeatureBinder.js';
import { bindVideoButton } from './features/video/videoFeatureBinder.js';
import { createDOMCreateService } from './features/domCreateService.js';

// 🧩 메인 엔트리
export function createEditor(rootId) {

  // ───────── 1️⃣ DOM 생성
  createDOMCreateService(rootId);

  // ───────── 2️⃣ 상태 관리
  const app = createEditorApp({
    editorState: [
      EditorLineModel('left', [ TextChunkModel('text', '', {fontSize: '14px'}) ])
    ]
  });

  // ───────── 3️⃣ UI 애플리케이션
  const ui = createUiApplication({
    rootId           : `${rootId}-content`,
    rendererRegistry : { text: textRenderer, video: videoRenderer }
  });

  function init(newPos) {
    const state = app.getState().present.editorState;
    ui.render(state);
    ui.restoreSelectionPosition(newPos);
  }

  // ───────── 5️⃣ 입력 이벤트
  const editorEl       = document.getElementById(`${rootId}-content`);
  const inputApp       = createInputApplication({ editorEl });
  const inputProcessor = createEditorInputService(app, ui);
  inputApp.bindInput(inputProcessor.processInput);

  // ───────── 6️⃣ 상태 & UI API
  const stateAPI = {
      get          : ()            => app.getState().present.editorState,
      save         : (newState)    => app.saveEditorState(newState),
      saveCursor   : (cur)         => app.saveCursorState(cur),
      undo         : ()            => app.undo(),
      redo         : ()            => app.redo(),
      isLineChanged: (i)           => app.isLineChanged(i),
      getLines     : (idxs)        => app.getLines(idxs),
      getLineRange : (s, e)        => app.getLineRange(s, e)
  };

  const uiAPI = {
      render              : (state)               => ui.render(state),
      renderLine          : (i, data)            => ui.renderLine(i, data),
      restoreCursor       : (pos)                 => ui.restoreSelectionPosition(pos),
      insertLine          : (i, align)            => ui.insertNewLineElement(i, align),
      removeLine          : (i)                   => ui.removeLineElement(i),
      getDomSelection     : ()                    => ui.getSelectionRangesInDOM(),
      getSelectionPosition: ()                    => ui.getSelectionPosition()
  };

  // ───────── 7️⃣ 키 이벤트
  const keyProcessor = createEditorKeyService({ state: stateAPI, ui: uiAPI });

  inputApp.bindKeydown({
    handleEnter     : keyProcessor.processEnter,
    handleBackspace : keyProcessor.processBackspace,
    undo            : keyProcessor.undo,
    redo            : keyProcessor.redo
  });

  const toolbarElements = {
    boldBtn        : document.getElementById(`${rootId}-boldBtn`),
    italicBtn      : document.getElementById(`${rootId}-italicBtn`),
    underLineBtn   : document.getElementById(`${rootId}-underLineBtn`),
    fontSizeSelect : document.getElementById(`${rootId}-fontSizeSelect`)
  };

  // ───────── 8️⃣ Selection Feature 바인딩 (🔥 추가됨)
  bindSelectionFeature(
    stateAPI,
    uiAPI,
    editorEl,
    toolbarElements
  );

  // ───────── 9️⃣ 버튼 바인딩
  bindStyleButtons(stateAPI, uiAPI, toolbarElements);

  bindAlignButtons(
    stateAPI,
    uiAPI,
    {
      leftBtn  : document.getElementById(`${rootId}-alignLeftBtn`),
      centerBtn: document.getElementById(`${rootId}-alignCenterBtn`),
      rightBtn : document.getElementById(`${rootId}-alignRightBtn`)
    }
  );

  bindVideoButton(
    document.getElementById(`${rootId}-addVideoBtn`),
    stateAPI,
    uiAPI
  );

  // ───────── 1️⃣0️⃣ 초기 렌더링
  init({ lineIndex: 0, offset: 0 });
}

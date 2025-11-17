import { createEditorApp } from './state/application/editorApplication.js';
import { createUiApplication } from './ui/application/uiApplication.js';
import { createInputApplication } from './input/application/inputApplication.js'; 
import { EditorLineModel, TextChunkModel } from './model/editorModel.js';
import { textRenderer } from './renderers/textRenderer.js';
import { videoRenderer } from './renderers/videoRenderer.js';
import { createEditorInputService } from './core/editorInputService.js'; 
import { createEditorKeyService } from './core/editorKeyService.js'; 
import { bindStyleButtons } from './features/style/styleFeatureBinder.js';
import { bindAlignButtons } from './features/align/alignFeatureBinder.js';
import { bindVideoButton } from './features/video/videoFeatureBinder.js';
import { createDOMCreateService } from './features/domCreateService.js';


// 🧩 외부에서 호출할 메인 엔트리
export function createEditor(rootId) {
  // 1️⃣ DOM 구성
  createDOMCreateService(rootId);

  // 2️⃣ 상태 관리
  const app = createEditorApp({
    editorState: [
      EditorLineModel('left', [ TextChunkModel('text', '', {}) ])
    ]
  });

  // 3️⃣ UI 애플리케이션 생성, 렌더러 등록
  const ui = createUiApplication({
    rootId           : `${rootId}-content`,
    rendererRegistry : { text: textRenderer, video: videoRenderer }
  });

  // 최초 init 세팅
  function init(newPos) {
    const currentState = app.getState().present.editorState;
    ui.render(currentState);
    ui.restoreSelectionPosition(newPos);
  }

  // 6️⃣ 입력 및 키 이벤트 바인딩
  const editorEl = document.getElementById(`${rootId}-content`);
  const inputApp = createInputApplication({ editorEl });
  const inputProcessor = createEditorInputService(app, ui);
  inputApp.bindInput(inputProcessor.processInput);

  const stateAPI = {
      get        : ()          => app.getState().present.editorState
    , save       : (newState)  => app.saveEditorState(newState)
    , saveCursor : (newCursor) => app.saveCursorState(newCursor)
    , undo       : ()          => app.undo()
    , redo       : ()          => app.redo()
  };

  const uiAPI = {
      render              : (state)               => ui.render(state)
    , renderLine          : (lineIndex, lineData) => ui.renderLine(lineIndex, lineData)
    , restoreCursor       : (pos)                 => ui.restoreSelectionPosition(pos)
    , insertLine          : (lineIndex, align)    => ui.insertNewLineElement(lineIndex, align)
    , removeLine          : (lineIndex)           => ui.removeLineElement(lineIndex)
    , getDomSelection     : ()                    => ui.getSelectionRangesInDOM()
    , getSelectionPosition: ()                    => ui.getSelectionPosition()
  };

  const keyProcessor = createEditorKeyService({
      state : stateAPI
    , ui    : uiAPI
  });

  inputApp.bindKeydown({
    handleEnter     : keyProcessor.processEnter,
    handleBackspace : keyProcessor.processBackspace,
    undo            : keyProcessor.undo,
    redo            : keyProcessor.redo,
  });

  // 7️⃣ 버튼 바인딩
  bindStyleButtons(
    stateAPI,
    uiAPI,
    {
      boldBtn      : document.getElementById(`${rootId}-boldBtn`),
      italicBtn    : document.getElementById(`${rootId}-italicBtn`),
      underLineBtn : document.getElementById(`${rootId}-underLineBtn`)
    }
  );

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

  // 8️⃣ 초기 렌더링
  init({ lineIndex: 0, offset: 0 });
}

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

  // 3️⃣ 렌더러 등록
  const rendererRegistry = { text: textRenderer, video: videoRenderer };

  // 4️⃣ UI 애플리케이션 생성
  const ui = createUiApplication({
    rootId: `${rootId}-content`,
    rendererRegistry
  });

  // 5️⃣ 상태 렌더링 + 커서 복원
  function updateAndRestore(newPos) {
    const currentState = app.getState().present.editorState;
    ui.render(currentState);
    ui.restoreSelectionPosition(newPos);
  }

  // 6️⃣ 입력 및 키 이벤트 바인딩
  const editorEl = document.getElementById(`${rootId}-content`);
  const inputApp = createInputApplication({ editorEl });

  const inputProcessor = createEditorInputService(app, ui);
  inputApp.bindInput(inputProcessor.processInput);

  const keyProcessor = createEditorKeyService(app, ui);
  inputApp.bindKeydown({
    handleEnter     : keyProcessor.processEnter,
    handleBackspace : keyProcessor.processBackspace,
    undo            : keyProcessor.undo,
    redo            : keyProcessor.redo,
  });

  // 7️⃣ 버튼 바인딩
  const getEditorState = () => app.getState().present.editorState;
  const saveEditorState = newState => app.saveEditorState(newState);

  bindStyleButtons(getEditorState, saveEditorState, ui, updateAndRestore, {
    boldBtn: document.getElementById(`${rootId}-boldBtn`),
    italicBtn: document.getElementById(`${rootId}-italicBtn`),
    underLineBtn: document.getElementById(`${rootId}-underLineBtn`)
  });

  bindAlignButtons(app, ui, updateAndRestore, {
    leftBtn: document.getElementById(`${rootId}-alignLeftBtn`),
    centerBtn: document.getElementById(`${rootId}-alignCenterBtn`),
    rightBtn: document.getElementById(`${rootId}-alignRightBtn`)
  });

  bindVideoButton(
    document.getElementById(`${rootId}-addVideoBtn`),
    getEditorState,
    saveEditorState,
    updateAndRestore,
    ui.getSelectionPosition
  );

  // 8️⃣ 초기 렌더링
  updateAndRestore({ lineIndex: 0, offset: 0 });

  // 외부 제어용 핸들 반환
  return { app, ui, updateAndRestore };
}

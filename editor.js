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

// 🧩 메인 엔트리: 외부에서 호출
export function createEditor(rootId) {

  // ───────── 1️⃣ DOM 생성 ─────────
  // 에디터의 기본 DOM 구조를 생성
  createDOMCreateService(rootId);

  // ───────── 2️⃣ 상태 관리 초기화 ─────────
  const app = createEditorApp({
    editorState: [
      EditorLineModel('left', [ TextChunkModel('text', '', {}) ])
    ]
  });

  // ───────── 3️⃣ UI 애플리케이션 생성 ─────────
  // 렌더러 등록: 텍스트/비디오
  const ui = createUiApplication({
    rootId           : `${rootId}-content`,
    rendererRegistry : { text: textRenderer, video: videoRenderer }
  });

  // ───────── 4️⃣ 초기 렌더링 함수 정의 ─────────
  // 상태 기반 렌더링 + 커서 복원
  function init(newPos) {
    const currentState = app.getState().present.editorState;
    ui.render(currentState);
    ui.restoreSelectionPosition(newPos);
  }

  // ───────── 5️⃣ 입력 이벤트 처리 바인딩 ─────────
  const editorEl = document.getElementById(`${rootId}-content`);
  const inputApp = createInputApplication({ editorEl });
  const inputProcessor = createEditorInputService(app, ui);
  inputApp.bindInput(inputProcessor.processInput);

  // ───────── 6️⃣ 상태 & UI API 정의 ─────────
  // 서비스와 버튼 바인딩에서 사용할 공통 인터페이스
  const stateAPI = {
      get        : ()          => app.getState().present.editorState,
      save       : (newState)  => app.saveEditorState(newState),
      saveCursor : (newCursor) => app.saveCursorState(newCursor),
      undo       : ()          => app.undo(),
      redo       : ()          => app.redo()
  };

  const uiAPI = {
      render              : (state)               => ui.render(state),
      renderLine          : (lineIndex, lineData) => ui.renderLine(lineIndex, lineData),
      restoreCursor       : (pos)                 => ui.restoreSelectionPosition(pos),
      insertLine          : (lineIndex, align)    => ui.insertNewLineElement(lineIndex, align),
      removeLine          : (lineIndex)           => ui.removeLineElement(lineIndex),
      getDomSelection     : ()                    => ui.getSelectionRangesInDOM(),
      getSelectionPosition: ()                    => ui.getSelectionPosition()
  };

  // ───────── 7️⃣ 키 이벤트 처리 ─────────
  const keyProcessor = createEditorKeyService({
      state : stateAPI,
      ui    : uiAPI
  });

  inputApp.bindKeydown({
    handleEnter     : keyProcessor.processEnter,
    handleBackspace : keyProcessor.processBackspace,
    undo            : keyProcessor.undo,
    redo            : keyProcessor.redo
  });

  // ───────── 8️⃣ 버튼 이벤트 바인딩 ─────────
  // 스타일 버튼 (Bold, Italic, Underline)
  bindStyleButtons(
    stateAPI,
    uiAPI,
    {
      boldBtn      : document.getElementById(`${rootId}-boldBtn`),
      italicBtn    : document.getElementById(`${rootId}-italicBtn`),
      underLineBtn : document.getElementById(`${rootId}-underLineBtn`)
    }
  );

  // 정렬 버튼 (Left, Center, Right)
  bindAlignButtons(
    stateAPI,
    uiAPI,
    {
      leftBtn  : document.getElementById(`${rootId}-alignLeftBtn`),
      centerBtn: document.getElementById(`${rootId}-alignCenterBtn`),
      rightBtn : document.getElementById(`${rootId}-alignRightBtn`)
    }
  );

  // 비디오 버튼 (YouTube 삽입)
  bindVideoButton(
    document.getElementById(`${rootId}-addVideoBtn`),
    stateAPI,
    uiAPI
  );

  // ───────── 9️⃣ 초기 렌더링 호출 ─────────
  init({ lineIndex: 0, offset: 0 });
}

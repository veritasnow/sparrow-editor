import { createEditorApp } from './module/stateModule/application/editorApplication.js';
import { createUiApplication } from './module/uiModule/application/uiApplication.js';

// 외부 렌더러 등록
import { textRenderer } from './renderers/textRenderer.js';
import { videoRenderer } from './renderers/videoRenderer.js';

// 서비스
import { bindInputEvent } from './service/editorInputService.js';
import { bindKeydownEvent } from './service/editorKeyService.js';
import { bindStyleButtons } from './service/editorStyleService.js';
import { bindAlignButtons } from './service/editorAlignService.js';

// ───────── 상태 관리 ─────────
const app = createEditorApp({
  editorState: [
    {
      align: "left",
      chunks: [{ type: "text", text: "", style: {} }]
    }
  ]
});

// ───────── 렌더러 등록 ─────────
const rendererRegistry = {
  text: textRenderer,
  video: videoRenderer
};

// ───────── UI 애플리케이션 ─────────
const ui = createUiApplication({
  rootId: "editor",
  rendererRegistry // ← 추가
});

// ───────── 상태 렌더링 + 커서 복원 ─────────
function updateAndRestore(newPos) {
  const currentState = app.getState().present.editorState;
  ui.render(currentState);
  ui.restoreSelectionPosition(newPos);
}

// ───────── 버튼 & 이벤트 바인딩 ─────────
const editorEl = document.getElementById('editor');
const boldBtn = document.getElementById('boldBtn');
const italicBtn = document.getElementById('italicBtn');
const underLineBtn = document.getElementById('underLineBtn');
const alignLeftBtn = document.getElementById('alignLeftBtn');
const alignCenterBtn = document.getElementById('alignCenterBtn');
const alignRightBtn = document.getElementById('alignRightBtn');


bindInputEvent(editorEl, app, ui);
bindKeydownEvent(editorEl, app, ui, updateAndRestore);
bindStyleButtons(
    () => app.getState().present.editorState // getEditorState
  , newState => app.saveEditorState(newState) // saveEditorState
  , ui
  , updateAndRestore
  , { boldBtn, italicBtn, underLineBtn }
);
bindAlignButtons(app, ui, updateAndRestore, {
  leftBtn: alignLeftBtn,
  centerBtn: alignCenterBtn,
  rightBtn: alignRightBtn
});

// ───────── 초기 렌더링 ─────────
updateAndRestore({ lineIndex: 0, offset: 0 });

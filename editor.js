import { createEditorApp } from './module/stateModule/application/editorApplication.js';
import { createUiApplication } from './module/uiModule/application/uiApplication.js';
import { createInputApplication } from './module/inputModule/application/inputApplication.js'; 

// 외부 렌더러 등록
import { textRenderer } from './renderers/textRenderer.js';
import { videoRenderer } from './renderers/videoRenderer.js';

// 에디터 기본 서비스
import { createEditorInputService } from './service/input/editorInputService.js'; 
import { createEditorKeyService } from './service/keyInput/editorKeyService.js'; 

// 에디터 확장 서비스 바인드
import { bindStyleButtons } from './service/editorStyleService.js';
import { bindAlignButtons } from './service/editorAlignService.js';
import { bindVideoButton } from './service/video/videoFeatureBinder.js'; // 🎥 변경된 함수 사용

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
// ui 객체는 selectionService의 함수들(getSelectionPosition 등)을 포함하고 있다고 가정합니다.
const ui = createUiApplication({
    rootId: "editor",
    rendererRegistry
});

// ───────── 상태 렌더링 + 커서 복원 ─────────
function updateAndRestore(newPos) {
    const currentState = app.getState().present.editorState;
    ui.render(currentState);
    ui.restoreSelectionPosition(newPos); 
}

// ───────── 버튼 & 이벤트 바인딩 ─────────
const editorEl       = document.getElementById('editor');
const boldBtn        = document.getElementById('boldBtn');
const italicBtn      = document.getElementById('italicBtn');
const underLineBtn   = document.getElementById('underLineBtn');
const alignLeftBtn   = document.getElementById('alignLeftBtn');
const alignCenterBtn = document.getElementById('alignCenterBtn');
const alignRightBtn  = document.getElementById('alignRightBtn');
const videoBtn       = document.getElementById('addVideoBtn'); // 🎥 추가



// ───────── 입력 및 키 이벤트 바인딩 ─────────
const inputApp = createInputApplication({ editorEl }); 

// 1. 입력 바인등
const inputProcessor = createEditorInputService(app, ui);
inputApp.bindInput(inputProcessor.processInput);

// 2. 키입력 바인딩
const keyProcessor = createEditorKeyService(app, ui); 
inputApp.bindKeydown({
    handleEnter: keyProcessor.processEnter,
    handleBackspace: keyProcessor.processBackspace
});






// ───────── 버튼 이벤트 초기화 함수 ─────────
function initializeButtons() {
    // 💡 상태 접근자 정의: 반복되는 인라인 함수를 변수로 추출하여 가독성 개선
    const getEditorState = () => app.getState().present.editorState;
    const saveEditorState = newState => app.saveEditorState(newState);

    // 1. 스타일 버튼 바인딩
    bindStyleButtons(
        getEditorState,
        saveEditorState,
        ui,
        updateAndRestore,
        { boldBtn, italicBtn, underLineBtn }
    );

    // 2. 정렬 버튼 바인딩
    bindAlignButtons(app, ui, updateAndRestore, {
        leftBtn: alignLeftBtn,
        centerBtn: alignCenterBtn,
        rightBtn: alignRightBtn
    });

    // 3. 동영상 추가 버튼 바인딩 - [개선된 부분]
    bindVideoButton(
        videoBtn,
        getEditorState,
        saveEditorState,
        updateAndRestore,
        ui.getSelectionPosition // 👈 커서 위치 파악 함수 전달
    );
}

// ───────── 버튼 초기화 실행 ─────────
initializeButtons();

// ───────── 초기 렌더링 ─────────
updateAndRestore({ lineIndex: 0, offset: 0 });
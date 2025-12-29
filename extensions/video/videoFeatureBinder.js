import { createVideoPopupView } from './compoents/videoPopupView.js';
import { createVideoInsertService } from './service/videoInsertService.js';

// features/video/videoFeatureBinder.js

export function bindVideoButton(videoBtn, stateAPI, uiAPI, rootId) {
    const rootEl = document.getElementById(rootId);
    const toolbar = rootEl.querySelector('.toolbar');

    // 1. View & Service 초기화
    const { popup, inputEl, confirmBtn, open, close } = createVideoPopupView(rootEl, toolbar, videoBtn);
    const { insertVideo } = createVideoInsertService(stateAPI, uiAPI);

    let lastCursorPos = null;

    // 2. Event Handlers
    const onVideoBtnClick = (e) => {
        e.stopPropagation();
        lastCursorPos = uiAPI.getSelectionPosition();
        popup.style.display === 'block' ? close() : (open(), inputEl.focus());
    };

    const onConfirmClick = () => {
        const url = inputEl.value.trim();
        if (!url) return;
        if (insertVideo(url, lastCursorPos)) close();
    };

    const onDocumentClick = (e) => {
        if (!popup.contains(e.target) && e.target !== videoBtn) close();
    };

    // 3. Event Binding
    videoBtn.addEventListener('click', onVideoBtnClick);
    confirmBtn.addEventListener('click', onConfirmClick);
    document.addEventListener('click', onDocumentClick);

    // 4. ✨ 핵심: 통합 Disposer
    return function destroy() {
        console.log("[VideoFeature] Cleaning up...");
        
        // A. 이벤트 리스너 해제 (메모리 누수 방지)
        videoBtn.removeEventListener('click', onVideoBtnClick);
        confirmBtn.removeEventListener('click', onConfirmClick);
        document.removeEventListener('click', onDocumentClick);

        // B. DOM 정리 (UI 오염 방지)
        // 팝업이 툴바나 바디에 append 되어 있다면 반드시 제거해야 합니다.
        if (popup && popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
    };
}
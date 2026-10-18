
import { VideoPopup } from './componets/VideoPopup.js';
import { createVideoInsert } from './service/insertVideo.js';

export function bindVideoButton(
    videoBtn,
    stateAPI,
    uiAPI,
    selectionAPI,
    rootId
) {
    const rootEl = document.getElementById(rootId);
    if (!rootEl) return;

    const toolbar = rootEl.querySelector('.sparrow-toolbar');
    if (!toolbar) return;

    // 1. 에디터별 비디오 삽입 기능 생성
    const { insertVideo } = createVideoInsert({
        stateAPI,
        uiAPI,
        selectionAPI
    });

    // 2. 팝업 초기화
    const {
        popup,
        inputEl,
        confirmBtn,
        open,
        close
    } = VideoPopup(rootEl, toolbar, videoBtn);

    let lastCursorPos = null;

    // 3. 이벤트 핸들러
    const onVideoBtnClick = (e) => {
        e.stopPropagation();

        if (popup.style.display === 'block') {
            close();
            return;
        }

        // 팝업에 포커스가 이동하기 전에 본문 커서 위치 저장
        selectionAPI.updateLastValidPosition();
        lastCursorPos = selectionAPI.getLastValidPosition();

        open();
        inputEl.focus();
    };

    const onConfirmClick = () => {
        const url = inputEl.value.trim();
        if (!url) return;

        if (insertVideo(url, lastCursorPos)) {
            close();
        }
    };

    const onDocumentClick = (e) => {
        if (!popup.contains(e.target) && e.target !== videoBtn) {
            close();
        }
    };

    // 4. 이벤트 등록
    videoBtn.addEventListener('click', onVideoBtnClick);
    confirmBtn.addEventListener('click', onConfirmClick);
    document.addEventListener('click', onDocumentClick);

    // 5. 정리 함수
    return function destroy() {
        videoBtn.removeEventListener('click', onVideoBtnClick);
        confirmBtn.removeEventListener('click', onConfirmClick);
        document.removeEventListener('click', onDocumentClick);

        if (popup?.parentNode) {
            popup.parentNode.removeChild(popup);
        }
    };
}

// extensions/video/ui/videoPopupView.js

/**
 * 비디오 삽입 팝업의 DOM 구조 및 기본 UI 동작을 관리하는 뷰 모듈.
 *
 * @returns {{ popup: HTMLElement, inputEl: HTMLElement, confirmBtn: HTMLElement, open: Function, close: Function }}
 */
export function createVideoPopupView(rootEl, toolbar, videoBtn) {
    let popup = rootEl.querySelector('.video-input-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.className = 'video-input-popup';
        popup.innerHTML = `
        <input type="text" placeholder="YouTube URL 입력..." class="video-url-input" />
        <button class="video-confirm-btn">추가</button>
        `;
        toolbar.appendChild(popup);
    }

    const inputEl    = popup.querySelector('.video-url-input');
    const confirmBtn = popup.querySelector('.video-confirm-btn');

    // 팝업 열기/위치 조정 (View responsibility)
    const open = () => {
        popup.style.display = 'block';
        const rect = videoBtn.getBoundingClientRect();
        const toolbarRect = toolbar.getBoundingClientRect();
        popup.style.top = `${rect.bottom - toolbarRect.top + 6}px`;
        popup.style.left = `${rect.left - toolbarRect.left}px`;
        inputEl.focus();
    };

    // 팝업 닫기/초기화 (View responsibility)
    const close = () => {
        inputEl.value = ''; // UI 초기화
        popup.style.display = 'none';
    };

    return { popup, inputEl, confirmBtn, open, close };
}
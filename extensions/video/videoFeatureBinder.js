// extensions/video/videoFeatureBinder.js

import { createVideoPopupView } from './compoents/videoPopupView.js';
import { createVideoInsertService } from './service/videoInsertService.js';


/**
 * 🎥 유튜브 버튼 이벤트 바인딩 (최상위 레이어)
 * stateAPI와 uiAPI를 통해 상태/커서/렌더링 처리
 */
export function bindVideoButton(videoBtn, stateAPI, uiAPI) {
    const toolbar = document.querySelector('.toolbar');

    // 1. View 초기화
    const { popup, inputEl, confirmBtn, open, close } = createVideoPopupView(toolbar, videoBtn);

    // 2. Logic 초기화
    const { insertVideo } = createVideoInsertService(stateAPI, uiAPI);

    // 3. 마지막 커서 위치 저장용
    let lastCursorPos = null;

    // 버튼 클릭: 팝업 토글
    videoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // 🔹 클릭 시점의 커서 위치 저장
        lastCursorPos = uiAPI.getSelectionPosition();
        if (popup.style.display === 'block') close();
        else open();
        // 팝업 열리면 input 포커스
        if (popup.style.display === 'block') inputEl.focus();
    });

    // 추가 버튼 클릭: 입력값 받아 Service 호출
    confirmBtn.addEventListener('click', () => {
        const url = inputEl.value.trim();
        if (!url) return;
        // 🔹 insertVideo 호출 시 마지막 커서 위치 전달
        const success = insertVideo(url, lastCursorPos);
        if (success) close();
    });

    // 외부 클릭: 팝업 닫기
    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && e.target !== videoBtn) close();
    });
}

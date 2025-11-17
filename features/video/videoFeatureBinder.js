// sparrow-editor\service\video\videoFeatureBinder.js

import { createVideoPopupView } from '../../components/video/videoPopupView.js';      // 💡 View Component
import { createVideoInsertService } from './videoInsertService.js'; // 💡 Application Service/Hook


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

    // 3. 이벤트 연결

    // 버튼 클릭: 팝업 토글
    videoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (popup.style.display === 'block') close();
        else open();
    });

    // 추가 버튼 클릭: 입력값 받아 Service 호출
    confirmBtn.addEventListener('click', () => {
        const url = inputEl.value.trim();
        const success = insertVideo(url);
        if (success) close();
    });

    // 외부 클릭: 팝업 닫기
    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && e.target !== videoBtn) close();
    });
}
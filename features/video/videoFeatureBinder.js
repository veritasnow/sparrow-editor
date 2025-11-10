// sparrow-editor\service\video\videoFeatureBinder.js

import { createVideoPopupView } from '../../components/video/videoPopupView.js';      // 💡 View Component
import { createVideoInsertService } from './videoInsertService.js'; // 💡 Application Service/Hook

/**
 * 🎥 유튜브 버튼 이벤트 바인딩 (최상위 컴포지션 레이어)
 * 이 함수는 View와 Service를 초기화하고 이벤트를 연결합니다.
 */
export function bindVideoButton(videoBtn, getEditorState, saveEditorState, updateAndRestore, getSelectionPosition) {
    const toolbar = document.querySelector('.toolbar');

    // 1. View 모듈 초기화 (DOM 생성)
    const { popup, inputEl, confirmBtn, open, close } = createVideoPopupView(toolbar, videoBtn);

    // 2. Logic 모듈 초기화 (로직 주입)
    const { insertVideo } = createVideoInsertService(
        getEditorState, 
        saveEditorState, 
        updateAndRestore, 
        getSelectionPosition
    );

    // 3. 이벤트 연결 (Binding)
    
    // 버튼 클릭: View 제어
    videoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (popup.style.display === 'block') {
            close();
        } else {
            open();
        }
    });

    // 추가 버튼 클릭: View에서 입력값을 받고 Service/Hook 호출
    confirmBtn.addEventListener('click', () => {
        const url = inputEl.value.trim();
        const success = insertVideo(url); // Logic 실행
        
        if (success) {
            close(); // 성공하면 View 닫기
        }
    });

    // 외부 클릭: View 제어
    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && e.target !== videoBtn) {
            close();
        }
    });
}
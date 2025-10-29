// /module/inputModule/service/keyBindingService.js

/**
 * 키보드 이벤트 리스너를 바인딩하고, 특정 키 이벤트가 발생했을 때
 * 외부(Core)에서 주입된 핸들러를 호출하는 역할을 담당합니다.
 * @param {HTMLElement} editorEl - 에디터 DOM 엘리먼트
 */
export function createKeyBindingService(editorEl) {
    return {
        /**
         * @param {Object} handlers - { handleEnter: Function, handleBackspace: Function }
         */
        bindEvents(handlers) {
            editorEl.addEventListener("keydown", (e) => {
                // Keydown 이벤트는 항상 Core 로직이 판단할 수 있도록 인풋 이벤트처럼 필터링하지 않습니다.
                
                if (e.key === "Enter") {
                    e.preventDefault();
                    handlers.handleEnter(); // 💡 Core 로직 실행
                    return;
                }

                if (e.key === "Backspace") {
                    // Backspace는 항상 Core에서 처리하도록 막습니다.
                    e.preventDefault(); 
                    handlers.handleBackspace(); // 💡 Core 로직 실행
                    return;
                }
                
                // 기타 다른 키 이벤트 (Ctrl+B 등) 처리 영역을 여기에 추가할 수 있습니다.
            });
        }
    };
}
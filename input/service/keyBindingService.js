/**
 * 🎧 에디터 키보드 입력 이벤트 바인딩 서비스
 * 단일 진입점으로 모든 키 입력을 Core 로직에 위임합니다.
 */
export function createKeyBindingService(editorEl) {
    return {
        /**
         * @param {Object} handlers - { handleEnter, handleBackspace, handleUndo, handleRedo }
         */
        bindEvents(handlers) {
            editorEl.addEventListener("keydown", (e) => {
                const { key, ctrlKey, shiftKey } = e;

                // ENTER
                if (key === "Enter") {
                    e.preventDefault();
                    handlers.handleEnter();
                    return;
                }

                // BACKSPACE
                if (key === "Backspace") {
                    e.preventDefault();
                    handlers.handleBackspace();
                    return;
                }

                // UNDO (Ctrl + Z)
                if (ctrlKey && key === "z" && !shiftKey) {
                    e.preventDefault();
                    handlers.undo();
                    return;
                }

                // REDO (Ctrl + Shift + Z)
                if (ctrlKey && key === "Z" && shiftKey) {
                    e.preventDefault();
                    handlers.redo();
                    return;
                }

                // 🔧 여기에 Ctrl+B, Ctrl+I 등 단축키 추가 가능
            });
        }
    };
}

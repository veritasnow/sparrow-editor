/**
 * 🎧 에디터 키보드 입력 이벤트 바인딩 서비스
 * 단일 진입점으로 모든 키 입력을 Core 로직에 위임합니다.
 */
export function createKeyBindingService(editorEl) {

    if (!editorEl) {
        throw new Error("Editor element is required for key binding service.");
    }

    let destroyed = false;
    let bound = false;

    // 🔒 keydown 핸들러 참조 (unbind를 위해 필요)
    let onKeydown;

    function assertAlive() {
        if (destroyed) {
            throw new Error("❌ KeyBindingService has been destroyed");
        }
    }

    return {
        /**
         * @param {Object} handlers - { handleEnter, handleBackspace, handleUndo, handleRedo }
         */
        bindEvents(handlers) {
            assertAlive();
            if (bound) return; // ✅ 중복 바인딩 방지
            bound = true;

            onKeydown = (e) => {
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
            };

            editorEl.addEventListener("keydown", onKeydown);
        },

        /**
         * 키보드 이벤트 바인딩을 해제하고 서비스 생명주기를 종료합니다.
         */
        destroy() {
            if (destroyed) return;
            destroyed = true;

            editorEl.removeEventListener("keydown", onKeydown);
            onKeydown = null;
        }
    };
}
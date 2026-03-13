/**
 * 🎧 에디터 키보드 입력 및 클립보드 이벤트 바인딩 서비스
 */
export function createKeyBindingService(editorEl) {

    if (!editorEl) {
        throw new Error("Editor element is required for key binding service.");
    }

    let destroyed = false;
    let bound = false;

    // 🔒 핸들러 참조 (해제를 위해 필요)
    let onKeydown;
    let onPaste;

    function assertAlive() {
        if (destroyed) {
            throw new Error("❌ KeyBindingService has been destroyed");
        }
    }


    function bindEvents(handlers) {
        assertAlive();
        if (bound) return;
        bound = true;

        // 1. 키보드 입력 핸들러
        onKeydown = (e) => {
            const { key, ctrlKey, shiftKey } = e;

            // ENTER
            if (key === "Enter") {
                e.preventDefault();

                // ✨ [수정] 개행 로직 실행 전, 현재 DOM 내용을 모델에 강제 동기화
                // 이 과정에서 테이블 분리 로직(isSplit)도 함께 실행됨
                if (typeof handlers.syncInput === 'function') {
                    handlers.syncInput();
                }

                handlers.processEnter();
                return;
            }

            // BACKSPACE
            if (key === "Backspace") {
                e.preventDefault();
                handlers.processBackspace(e);
                return;
            }

            // DELETE
            if (key === "Delete") {
                e.preventDefault();
                handlers.processDelete(e);
                return;
            }

            // UNDO (Ctrl + Z)
            if (ctrlKey && key.toLowerCase() === "z" && !shiftKey) {
                e.preventDefault();
                handlers.undo();
                return;
            }

            // REDO (Ctrl + Shift + Z 또는 Ctrl + Y)
            if (
                ctrlKey &&
                ((key.toLowerCase() === "z" && shiftKey) || key.toLowerCase() === "y")
            ) {
                e.preventDefault();
                handlers.redo();
                return;
            }
        };

        // 2. 붙여넣기 핸들러
        onPaste = (e) => {
            handlers.processPaste(e);
        };

        editorEl.addEventListener("keydown", onKeydown);
        editorEl.addEventListener("paste", onPaste);
    }    

    function destroy() {
        if (destroyed) return;
        destroyed = true;

        if (onKeydown) {
            editorEl.removeEventListener("keydown", onKeydown);
        }
        if (onPaste) {
            editorEl.removeEventListener("paste", onPaste);
        }

        onKeydown = null;
        onPaste = null;
    }    

    return {
        /**
         * @param {Object} handlers
         * { processEnter, processBackspace, processDelete, processPaste, undo, redo, tryPreEnter }
         */
        bindEvents,

        /**
         * 이벤트 바인딩 해제 및 서비스 종료
         */
        destroy
    };
}

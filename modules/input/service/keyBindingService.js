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

    /**
     * ✅ 텍스트 입력 전에
     * 커서 앞/뒤에 table 이 있으면 엔터를 먼저 실행
     */
    function tryPreEnterBeforeTextInput(e, handlers) {
        const { key, ctrlKey } = e;

        // 1️⃣ 문자 입력만
        if (key.length !== 1 || ctrlKey) return;

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        let node = sel.getRangeAt(0).startContainer;

        // text → element
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }
        if (!node) return;

        // 2️⃣ table 내부면 절대 개입하지 않음
        if (node.closest("table")) {
            return;
        }

        // 3️⃣ "최상위 line(text-block)" 찾기
        const lineEl = node.closest(".text-block");
        if (!lineEl) return;

        // 4️⃣ 해당 line 안에 table chunk가 있는지
        const hasTableInLine = !!lineEl.querySelector(":scope > table.se-table");

        if (hasTableInLine) {
            // ✅ table 앞/뒤 텍스트 입력 → 강제 개행
            handlers.processEnter();
        }
    }


    return {
        /**
         * @param {Object} handlers
         * { processEnter, processBackspace, processDelete, processPaste, undo, redo, tryPreEnter }
         */
        bindEvents(handlers) {
            assertAlive();
            if (bound) return;
            bound = true;

            // 1. 키보드 입력 핸들러
            onKeydown = (e) => {
                const { key, ctrlKey, shiftKey } = e;

                // ENTER
                if (key === "Enter") {
                    e.preventDefault();
                    handlers.processEnter();
                    return;
                }

                // ✅ [추가] 테이블 앞/뒤면 엔터 먼저 실행
                //tryPreEnterBeforeTextInput(e, handlers);

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
        },

        /**
         * 이벤트 바인딩 해제 및 서비스 종료
         */
        destroy() {
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
    };
}

// /module/inputModule/service/inputBindingService.js

export function createInputBindingService(editorEl) {
    if (!editorEl) {
        throw new Error("Editor element is required for input binding service.");
    }
    
    let composing          = false;
    let lastCompositionEnd = 0;
    let destroyed          = false;
    let bound              = false;

    let onCompositionStart;
    let onCompositionEnd;
    let onInput;

    function assertAlive() {
        if (destroyed) {
            throw new Error("❌ InputBindingService has been destroyed");
        }
    }

    return {
        bindEvents(processInputCallback) {
            assertAlive();
            if (bound) return;
            bound = true;

            onCompositionStart = () => {
                composing = true;
            };

            onCompositionEnd = () => {
                composing = false;
                lastCompositionEnd = Date.now();
                // 💡 중요: 조합 종료 시에도 skipRender를 true로 보내어 
                // 브라우저가 이미 그려놓은 DOM을 에디터가 덮어쓰지 않게 합니다.
                processInputCallback(true); 
            };

            onInput = (e) => {
                if (e.inputType === 'insertParagraph') return;

                const timeSinceCompositionEnd = Date.now() - lastCompositionEnd;
                const inputData = e.data || '';
                
                const PUNCTUATION_MARKS = ['.', ' ', '?', '!', ',', ':', ';', '"', "'"];
                const isPunctuationOrSpace = e.inputType === 'insertText' && PUNCTUATION_MARKS.includes(inputData);

                if (!isPunctuationOrSpace && timeSinceCompositionEnd < 50) {
                    return;
                }

                // 조합 중(composing: true)일 때는 모델만 업데이트(skipRender: true)
                processInputCallback(composing);
            };

            editorEl.addEventListener('compositionstart', onCompositionStart);
            editorEl.addEventListener('compositionend', onCompositionEnd);
            editorEl.addEventListener('input', onInput);
        },

        destroy() {
            if (destroyed) return;
            destroyed = true;
            editorEl.removeEventListener('compositionstart', onCompositionStart);
            editorEl.removeEventListener('compositionend', onCompositionEnd);
            editorEl.removeEventListener('input', onInput);
            onCompositionStart = null;
            onCompositionEnd = null;
            onInput = null;
        }
    };
}
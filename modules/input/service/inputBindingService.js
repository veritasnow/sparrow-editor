export function createInputBindingService(editorEl) {
    if (!editorEl) throw new Error("Editor element required.");
    
    let composing = false;
    let lastCompositionEnd = 0;
    let destroyed = false;
    let bound = false;

    let onCompositionStart, onCompositionEnd, onInput;

    return {
        bindEvents(processInputCallback) {
            if (bound) return;
            bound = true;

            onCompositionStart = () => { composing = true; };

            onCompositionEnd = () => {
                composing = false;
                lastCompositionEnd = Date.now();
                // 💡 IME 종료 시에도 skipRender: true를 전달하여 불필요한 재렌더링 방지
                processInputCallback(true); 
            };

            onInput = (e) => {
                if (e.inputType === 'insertParagraph') return;

                const timeSinceCompositionEnd = Date.now() - lastCompositionEnd;
                const inputData = e.data || '';
                const PUNCTUATION_MARKS = ['.', ' ', '?', '!', ',', ':', ';', '"', "'"];
                const isPunctuationOrSpace = e.inputType === 'insertText' && PUNCTUATION_MARKS.includes(inputData);

                if (!isPunctuationOrSpace && timeSinceCompositionEnd < 50) return;

                // 💡 조합 중(composing)일 때도 모델 업데이트를 위해 콜백 호출
                // skipRender 인자로 composing 값을 넘겨서 텍스트 렌더링만 제어함
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
        },

        isComposing() {
            return composing;
        }        
    };
}
// /module/inputModule/service/inputBindingService.js

/**
 * 에디터 DOM에 입력(input) 및 IME(composition) 이벤트 리스너를 바인딩하고,
 * 유효한 입력이 발생했을 때 핵심 로직을 수행하는 콜백을 호출하는 서비스 팩토리입니다.
 * * @param {HTMLElement} editorEl - 에디터 DOM 엘리먼트 (InputModule 생성 시 주입)
 * @returns {Object} 공개 함수들 (bindEvents, destroy)
 */
export function createInputBindingService(editorEl) {
    
    if (!editorEl) {
        throw new Error("Editor element is required for input binding service.");
    }
    
    // 내부 상태: 한글/IME 입력 상태 관리
    let composing = false;
    let lastCompositionEnd = 0;
    let destroyed = false;
    let bound = false;

    // 🔒 이벤트 핸들러 참조 보관 (unbind를 위해 필요)
    let onCompositionStart;
    let onCompositionEnd;
    let onInput;

    function assertAlive() {
        if (destroyed) {
            throw new Error("❌ InputBindingService has been destroyed");
        }
    }

    return {
        /**
         * Core 모듈에서 정의된 입력 처리 로직 콜백을 주입받아 이벤트 리스너를 등록합니다.
         * * @param {Function} processInputCallback - 핵심 입력 처리 로직 (Core 모듈의 processInputEvent 함수)
         */
        bindEvents(processInputCallback) {
            assertAlive();
            if (bound) return; // ✅ 중복 바인딩 방지
            bound = true;

            // 1. Composition (IME/한글 입력) 이벤트 핸들링
            onCompositionStart = () => {
                composing = true;
            };

            onCompositionEnd = () => {
                composing = false;
                lastCompositionEnd = Date.now();
                // IME 입력 완료 시 Core 로직 실행
                processInputCallback();
            };

            // 2. Input 이벤트 핸들링 (일반 입력)
            onInput = (e) => {
                // 개행 중복 방지 (Enter는 keydown에서 처리하는 것이 일반적)
                if (e.inputType === 'insertParagraph') return;

                const timeSinceCompositionEnd = Date.now() - lastCompositionEnd;
                const inputData = e.data || '';
                
                const PUNCTUATION_MARKS = ['.', ' ', '?', '!', ',', ':', ';', '"', "'"];
                const isPunctuationOrSpace =
                    e.inputType === 'insertText' &&
                    PUNCTUATION_MARKS.includes(inputData);

                // 문장 부호가 아니면서, 한글 입력 직후 짧은 시간 내에 입력된 것은 무시 (중복 방지 필터링)
                if (!isPunctuationOrSpace && timeSinceCompositionEnd < 50) {
                    return;
                }

                // IME 입력 중이 아닐 때만 Core 로직 실행
                if (!composing) {
                    processInputCallback();
                }
            };

            editorEl.addEventListener('compositionstart', onCompositionStart);
            editorEl.addEventListener('compositionend', onCompositionEnd);
            editorEl.addEventListener('input', onInput);
        },

        /**
         * 입력 이벤트 바인딩을 해제하고 서비스 생명주기를 종료합니다.
         */
        destroy() {
            if (destroyed) return;
            destroyed = true;

            editorEl.removeEventListener('compositionstart', onCompositionStart);
            editorEl.removeEventListener('compositionend', onCompositionEnd);
            editorEl.removeEventListener('input', onInput);

            // 참조 해제 (GC 친화)
            onCompositionStart = null;
            onCompositionEnd = null;
            onInput = null;
        }
    };
}

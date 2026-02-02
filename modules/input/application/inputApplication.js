// /module/inputModule/application/inputApplication.js
import { createInputBindingService } from "../service/inputBindingService.js";
import { createKeyBindingService   } from "../service/keyBindingService.js";

/**
 * 에디터의 DOM 이벤트 바인딩 서비스를 통합하는 애플리케이션입니다.
 * @param {Object} config - { editorEl: HTMLElement }
 */
export function createInputApplication({ editorEl }) {

    if (!editorEl) {
        throw new Error("editorEl is required to create InputApplication.");
    }

    const inputService = createInputBindingService(editorEl);
    const keyService   = createKeyBindingService(editorEl);

    let destroyed = false;

    function assertAlive() {
        if (destroyed) {
            throw new Error("❌ InputApplication has been destroyed");
        }
    }

    return {
        /**
         * Input/Composition 이벤트 처리 콜백을 주입받아 바인딩합니다.
         * @param {Function} processInputCallback - Core의 입력 처리 로직 함수
         */
        bindInput(processInputCallback) {
            assertAlive();
            inputService.bindEvents(processInputCallback);
        },

        /**
         * Keydown 이벤트 처리 콜백(Enter, Backspace 등) 객체를 주입받아 바인딩합니다.
         * @param {Object} handlers - { handleEnter: Function, handleBackspace: Function }
         */
        bindKeydown(handlers) {
            assertAlive();
            keyService.bindEvents(handlers);
        },

        /**
         * Input 모듈 전체 생명주기를 종료합니다.
         * 하위 바인딩 서비스들의 이벤트를 모두 해제합니다.
         */
        destroy() {
            if (destroyed) return;
            destroyed = true;

            inputService.destroy?.();
            keyService.destroy?.();
        },

        isComposing() {
            return inputService.isComposing();
        },        
    };
}

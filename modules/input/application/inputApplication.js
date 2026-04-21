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


    /**
     * 바인드 (Facade)
     * @param {Object} config
     * {
     *   input?: Function,
     *   keydown?: Object
     * }
     */
    function bind({ input, keydown } = {}) {
        assertAlive();

        if (input) {
            inputService.bindEvents(input);
        }

        if (keydown) {
            keyService.bindEvents(keydown);
        }
    }


    /**
     * Input 모듈 전체 생명주기를 종료합니다.
     * 하위 바인딩 서비스들의 이벤트를 모두 해제합니다.
     */
    function destroy() {
        if (destroyed) return;
        destroyed = true;

        inputService.destroy?.();
        keyService.destroy?.();
    }

    function isComposing() {
        return inputService.isComposing();
    }          

    return {
        bind,
        /**
         * Input 모듈 전체 생명주기를 종료합니다.
         * 하위 바인딩 서비스들의 이벤트를 모두 해제합니다.
         */
        destroy,

        isComposing,        
    };
}

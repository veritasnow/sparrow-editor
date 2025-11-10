// /module/inputModule/application/inputApplication.js
import { createInputBindingService } from "../service/inputBindingService.js";
import { createKeyBindingService   } from "../service/keyBindingService.js";

/**
 * 에디터의 DOM 이벤트 바인딩 서비스를 통합하는 애플리케이션입니다.
 * @param {Object} config - { editorEl: HTMLElement }
 */
export function createInputApplication({ editorEl }) {
    const inputService = createInputBindingService(editorEl);
    const keyService   = createKeyBindingService(editorEl);
    
    return {
        /**
         * Input/Composition 이벤트 처리 콜백을 주입받아 바인딩합니다.
         * @param {Function} processInputCallback - Core의 입력 처리 로직 함수
         */
        bindInput: (processInputCallback) => inputService.bindEvents(processInputCallback),
        
        /**
         * Keydown 이벤트 처리 콜백(Enter, Backspace 등) 객체를 주입받아 바인딩합니다.
         * @param {Object} handlers - { handleEnter: Function, handleBackspace: Function }
         */
        bindKeydown: (handlers) => keyService.bindEvents(handlers),
    };
}
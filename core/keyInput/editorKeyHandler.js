import { executePaste } from './processors/keyPasteProcessors.js';
import { executeEnter } from '../../core/keyInput/enter/processors/keyEnterProcessors.js';
import { executeDelete } from './processors/keyDeleteProcessors.js';
import { executeBackspace } from './processors/keyBackspaceProcessors.js';
import { executeHistory } from '../../core/keyInput/historyProcessor.js';

/**
 * EditorKeyHandler
 */
export function createEditorKeyHandler(context) {
    const { stateAPI, uiAPI, selectionAPI } = context;

    // 엔터 키 처리
    const processEnter = () => {
        executeEnter({ stateAPI, uiAPI, selectionAPI });
    };

    // 백스페이스 키 처리
    const processBackspace = (e) => {
        executeBackspace(e, { stateAPI, uiAPI, selectionAPI });
    };

    // 델 키 처리
    const processDelete = (e) => {
        executeDelete(e, { stateAPI, uiAPI, selectionAPI });
    };    

    // 📋 붙여넣기 처리 추가
    const processPaste = (e) => {
        executePaste(e, { stateAPI, uiAPI, selectionAPI });
    };    

    // 실행 취소
    const callUndo = () => {
        executeHistory('undo', { stateAPI, uiAPI, selectionAPI });
    };

    // 다시 실행
    const callRedo = () => {
        executeHistory('redo', { stateAPI, uiAPI, selectionAPI });
    };

    return {
        processEnter,
        processBackspace,
        processDelete,
        processPaste,
        undo: callUndo,
        redo: callRedo
    };
}
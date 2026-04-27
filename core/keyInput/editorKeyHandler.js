import { executePaste } from './paste/keyPasteProcessors.js';
import { executeEnter } from '../keyInput/enter/processors/keyEnterProcessors.js'
import { executeDelete } from '../keyInput/delete/processors/keyDeleteProcessors.js';
import { executeBackspace } from '../keyInput/delete/processors/keyBackspaceProcessors.js';
import { executeHistory } from '../../core/keyInput/historyProcessor.js';
import { executeInput } from '../keyInput/input/process/editorInputProcessor.js';



/**
 * EditorKeyHandler
 */
export function createEditorKeyHandler(context) {
    const { stateAPI, uiAPI, selectionAPI } = context;

    // 🔥 input (adapter 역할)
    const processInput = (skipRender = false) => {
        executeInput({ stateAPI, uiAPI, selectionAPI, skipRender, skipHistory: true });
    };

    const syncInput = () => {
        executeInput({ stateAPI, uiAPI, selectionAPI, skipRender: true, skipHistory: false });
    };


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

    // 붙여넣기 처리 추가
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
        processInput,
        syncInput,
        processEnter,
        processBackspace,
        processDelete,
        processPaste,
        undo: callUndo,
        redo: callRedo
    };
}
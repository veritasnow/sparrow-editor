import { executePaste } from './processors/keyPasteProcessors.js';
import { executeEnter } from '../../core/keyInput/processors/keyEnterProcessors.js';
import { executeDelete } from '../../core/keyInput/processors/keyDeleteProcessors.js';
import { executeBackspace } from '../../core/keyInput/processors/keyBackspaceProcessors.js';
import { executeHistory } from '../../core/keyInput/historyProcessor.js';

/**
 * 💚 EditorKeyHandler
 * 모든 핵심 로직은 core/keyInput의 프로세서들이 처리합니다.
 */
export function createEditorKeyHandler(context) {
    const { state, ui, domSelection } = context;

    // 엔터 키 처리
    const processEnter = () => {
        executeEnter({ state, ui, domSelection });
    };

    // 백스페이스 키 처리
    const processBackspace = (e) => {
        executeBackspace(e, { state, ui, domSelection });
    };

    // 델 키 처리
    const processDelete = (e) => {
        executeDelete(e, { state, ui, domSelection });
    };    

    // 📋 붙여넣기 처리 추가
    const processPaste = (e) => {
        executePaste(e, { state, ui, domSelection });
    };    

    // 실행 취소
    const callUndo = () => {
        executeHistory('undo', { state, ui, domSelection });
    };

    // 다시 실행
    const callRedo = () => {
        executeHistory('redo', { state, ui, domSelection });
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
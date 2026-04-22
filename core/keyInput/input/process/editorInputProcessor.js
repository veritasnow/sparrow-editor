// /core/keyInput/input/processors/keyInputProcessor.js

import { EditorLineModel } from '../../../../model/editorLineModel.js';
import { calculateInputUpdate } from '../service/calculateInputService.js';
import { handleSplitInput } from '../service/splitInputService.js';
import { applyInputState } from '../service/applyInputService.js';
import { executeInputRendering } from '../service/renderInputService.js';
import { normalizeCursorData } from '../../../../utils/cursorUtils.js';

/**
 * 🔥 input 공통 처리 (기존 processInput 그대로)
 */
function processInputCore({
    stateAPI,
    uiAPI,
    selectionAPI,
    defaultKey,
    skipRender  = false,
    skipHistory = true
}) {
    const activeKey = selectionAPI.getActiveKey() || defaultKey;
    const selection = selectionAPI.getSelectionContext();

    if (!selection || selection.lineIndex < 0) return;

    uiAPI.ensureFirstLine(activeKey);

    const currentState = stateAPI.get(activeKey);
    const currentLine  = currentState[selection.lineIndex] || EditorLineModel();

    const result = calculateInputUpdate({
        currentLine,
        selection,
        activeKey,
        uiAPI
    });

    if (!result || !result.flags.hasChange) return;

    if (result.isSplit) {
        handleSplitInput({
            stateAPI,
            uiAPI,
            selectionAPI,
            activeKey,
            lineIndex: selection.lineIndex,
            result,
            currentState
        });
        return;
    }

    applyInputState({
        stateAPI,
        key: activeKey,
        lineIndex: selection.lineIndex,
        updatedLine: result.updatedLine,
        restoreData: result.restoreData,
        skipHistory
    });

    if (skipRender) return;

    const finalRestoreData = normalizeCursorData(result.restoreData, activeKey);

    executeInputRendering({
        uiAPI,
        selectionAPI,
        updatedLine: result.updatedLine,
        lineIndex: selection.lineIndex,
        flags: result.flags,
        restoreData: finalRestoreData
    });
}

/**
 * ✨ execute 스타일로 래핑
 */
export function executeInput({
    stateAPI,
    uiAPI,
    selectionAPI,
    skipRender  = false,
    skipHistory = true
}) {
    const defaultKey = selectionAPI.getMainKey();

    processInputCore({
        stateAPI,
        uiAPI,
        selectionAPI,
        defaultKey,
        skipRender,
        skipHistory
    });
}
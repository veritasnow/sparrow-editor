// /core/input/processors/inputProcessor.js
import { EditorLineModel } from '../../../../model/editorLineModel.js';
import { calculateInputUpdate } from '../service/calculateInputService.js';
import { handleSplitInput } from '../service/splitInputService.js';
import { applyInputState } from '../service/applyInputService.js';
import { executeInputRendering } from '../service/renderInputService.js';
import { normalizeCursorData } from '../../../../utils/cursorUtils.js';

export function createEditorInputProcessor(stateAPI, uiAPI, selectionAPI, defaultKey) {

    function processInput(skipRender = false, skipHistory = true) {
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

        if (!result || !result.flags.hasChange) {
            console.log("No Change Detected");
            return;
        }

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

    return {
        processInput,
        syncInput: () => processInput(true, false)
    };
}
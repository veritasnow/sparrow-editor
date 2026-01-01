// extensions/table/service/tableInsertService.js
import { applyTableBlock } from '../utils/tableBlockUtil.js';

export function createTableInsertService(stateAPI, uiAPI) {
    function insertTable(rows, cols, cursorPos) {
        if (!rows || !cols) return false;

        const editorState = stateAPI.get();
        const pos = cursorPos ?? uiAPI.getSelectionPosition();

        let lineIndex = pos?.lineIndex ?? editorState.length;
        let offset    = pos?.offset    ?? 0;

        if (lineIndex >= editorState.length) {
            lineIndex = Math.max(0, editorState.length - 1);
            offset = editorState[lineIndex]?.chunks.reduce((sum, c) =>
                sum + (c.text?.length || 0)
            , 0);
        }

        const { newState, restoreLineIndex, restoreOffset } =
            applyTableBlock(editorState, rows, cols, lineIndex, offset);

        stateAPI.save(newState);
        stateAPI.saveCursor({ lineIndex: restoreLineIndex, offset: restoreOffset });

        if (stateAPI.isLineChanged(lineIndex)) {
            uiAPI.renderLine(lineIndex, newState[lineIndex]);
        }

        uiAPI.restoreCursor({ lineIndex: restoreLineIndex, offset: restoreOffset });

        return true;
    }

    return { insertTable };
}

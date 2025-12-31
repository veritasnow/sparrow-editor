// extensions/image/service/imageInsertService.js

import { applyImageBlock } from '../utils/imageBlockUtil.js';

export function createImageInsertService(stateAPI, uiAPI) {
    function insertImage(src, cursorPos) {
        if (!src) {
            alert('이미지 URL 또는 파일을 선택하세요.');
            return false;
        }

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
            applyImageBlock(editorState, src, lineIndex, offset);

        // 상태/커서
        stateAPI.save(newState);
        stateAPI.saveCursor({ lineIndex: restoreLineIndex, offset: restoreOffset });

        // UI
        if (stateAPI.isLineChanged(lineIndex)) {
            uiAPI.renderLine(lineIndex, newState[lineIndex]);
        }

        uiAPI.restoreCursor({ lineIndex: restoreLineIndex, offset: restoreOffset });

        return true;
    }

    return { insertImage };
}

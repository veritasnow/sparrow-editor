// extensions/image/service/imageInsertService.js

export function createImageInsertService(stateAPI, uiAPI) {
    function insertImage(src, cursorPos) {
        if (!src) {
            alert('이미지 URL 또는 파일을 선택하세요.');
            return false;
        }

        const editorState = stateAPI.get();
        const pos = cursorPos ?? uiAPI.getSelectionPosition();

        const lineIndex = pos.lineIndex;
        const offset    = pos.offset;

        const chunk = {
            type: 'image',
            src: src,
        };

        // 기존 라인에 인라인 삽입 (applyVideoBlock과 동일 패턴)
        const currentLine = editorState[lineIndex];
        const chunks = currentLine.chunks;

        const beforeChunks = chunks.slice(0, offset);
        const afterChunks  = chunks.slice(offset);

        const newChunks = [...beforeChunks, chunk, ...afterChunks];
        editorState[lineIndex] = { ...currentLine, chunks: newChunks };

        stateAPI.save(editorState);
        uiAPI.renderLine(lineIndex, editorState[lineIndex]);

        return true;
    }

    return { insertImage };
}

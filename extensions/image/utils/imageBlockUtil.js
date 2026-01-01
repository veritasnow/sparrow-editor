// extensions/image/utils/imageBlockUtil.js
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { DEFAULT_LINE_STYLE } from '../../../constants/styleConstants.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

export function applyImageBlock(editorState, src, currentLineIndex, cursorOffset) {
    const newState = [...editorState];
    const currentLine = editorState[currentLineIndex];

    const handler = chunkRegistry.get('image');
    const imageChunk = handler.create(src);

    const { beforeChunks, afterChunks } =
        splitLineChunks(currentLine.chunks, cursorOffset);

    // ---------------------------------------------------
    // 1) 빈 줄 → 블록 이미지 삽입
    // ---------------------------------------------------
    const isEmptyLine =
        beforeChunks.length === 0 &&
        afterChunks.length === 1 &&
        afterChunks[0].type === 'text' &&
        afterChunks[0].text === '';

    if (isEmptyLine) {
        const newLine = EditorLineModel('center', [imageChunk]);
        newState[currentLineIndex] = newLine;

        const textHandler = chunkRegistry.get('text');
        const nextLine = EditorLineModel(DEFAULT_LINE_STYLE.align, [
            textHandler.create('', {})
        ]);
        newState.splice(currentLineIndex + 1, 0, nextLine);

        return {
            newState,
            restoreLineIndex: currentLineIndex + 1,
            restoreOffset: 0
        };
    }

    // ---------------------------------------------------
    // 2) 텍스트가 있으면 인라인 삽입
    // ---------------------------------------------------
    const mergedChunks = [...beforeChunks, imageChunk, ...afterChunks];
    const newLine = EditorLineModel(currentLine.align, mergedChunks);
    newState[currentLineIndex] = newLine;

    const beforeTextLength = beforeChunks.reduce((sum, chunk) =>
        chunk.type === 'text' ? sum + chunk.text.length : sum
    , 0);

    return {
        newState,
        restoreLineIndex: currentLineIndex,
        restoreOffset: beforeTextLength + 1
    };
}

// extensions/table/utils/tableBlockUtil.js
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { DEFAULT_LINE_STYLE } from '../../../constants/styleConstants.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../utils/splitLineChunksUtils.js';

export function applyTableBlock(editorState, rows, cols, currentLineIndex, cursorOffset) {
    const newState = [...editorState];
    const currentLine = editorState[currentLineIndex];

    const handler = chunkRegistry.get('table');
    const tableChunk = handler.create(rows, cols);

    const { beforeChunks, afterChunks } =
        splitLineChunks(currentLine.chunks, cursorOffset);

    const isEmptyLine =
        beforeChunks.length === 0 &&
        afterChunks.length === 1 &&
        afterChunks[0].type === 'text' &&
        afterChunks[0].text === '';

    if (isEmptyLine) {
        const newLine = EditorLineModel('left', [tableChunk]);
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

    const mergedChunks = [...beforeChunks, tableChunk, ...afterChunks];
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

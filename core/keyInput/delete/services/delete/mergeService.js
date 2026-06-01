import { getLineLengthFromState } from '../../../../../utils/editorStateUtils.js';
import { EditorLineModel } from '../../../../../model/editorLineModel.js';
import { cloneChunk, normalizeLineChunks } from '../../../../../utils/mergeUtils.js';


/**
 * 다음 줄을 현재 줄로 병합하는 처리
 */
export function performNextLineMerge(currentState, lineIndex) {
    const nextState   = [...currentState];
    const currentLine = nextState[lineIndex];
    const nextLine    = nextState[lineIndex + 1];

    const mergedChunks = [
        ...currentLine.chunks.map(cloneChunk),
        ...nextLine.chunks.map(cloneChunk)
    ];

    nextState[lineIndex] = EditorLineModel(currentLine.align, normalizeLineChunks(mergedChunks));
    nextState.splice(lineIndex + 1, 1);

    return {
        newState: nextState,
        newPos: {
            lineIndex,
            anchor: {
                chunkIndex: Math.max(0, currentLine.chunks.length - 1),
                type: currentLine.chunks[currentLine.chunks.length - 1].type,
                offset: getLineLengthFromState(currentLine)
            }
        },
        deletedLineIndex: lineIndex + 1,
        updatedLineIndex: lineIndex
    };
}


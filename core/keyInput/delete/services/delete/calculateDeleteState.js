import { getLineLengthFromState } from '../../../../../utils/editorStateUtils.js';
import { calculateDeleteSelectionState } from '../common/calculateDeleteSelectionState.js';
import { performInternalDelete } from '../common/performInternalDelete.js';
import { EditorLineModel } from '../../../../../model/editorLineModel.js';
import { cloneChunk, normalizeLineChunks } from '../../../../../utils/mergeUtils.js';

/**
 * [Step 3] 실제 데이터 상태(State) 계산 메인
 */
export function calculateDeleteState(currentState, lineIndex, offset, ranges = []) {
    // 1. 선택 영역 삭제
    if (ranges?.length > 0 && (ranges.length > 1 || ranges[0].startIndex !== ranges[0].endIndex)) {
        return calculateDeleteSelectionState(currentState, ranges);
    }

    const currentLine = currentState[lineIndex];
    const currentLineLen = getLineLengthFromState(currentLine);

    // 2. 줄 병합 (줄의 맨 끝에서 삭제 시 아랫줄을 끌어올림)
    if (offset === currentLineLen && lineIndex < currentState.length - 1) {
        return performNextLineMerge(currentState, lineIndex);
    }

    // 3. 현재 줄 내부 삭제
    return performInternalDelete(currentState, lineIndex, offset, {
        isTargetChunk    : (offset, acc, len) => offset >= acc && offset < acc + len,
        getNewText       : (text, cut) => text.slice(0, cut) + text.slice(cut + 1),
        getStayAnchor    : (i, cut) => ({ chunkIndex: i, type: 'text', offset: cut }),
        getFallbackAnchor: (chunks, i, offset) => ({ chunkIndex: i, type: 'text', offset: offset })
    });
}

function performNextLineMerge(currentState, lineIndex) {
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
                type      : currentLine.chunks[currentLine.chunks.length - 1].type,
                offset    : getLineLengthFromState(currentLine)
            }
        },
        deletedLineIndex: lineIndex + 1,
        updatedLineIndex: lineIndex
    };
}
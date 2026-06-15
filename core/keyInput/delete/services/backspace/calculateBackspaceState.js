// /core/keyInput/services/backspace/backspaceStateService.js
import { performInternalDelete } from '../common/performInternalDelete.js';
import { calculateDeleteSelectionState } from '../common/calculateDeleteSelectionState.js'
import { EditorLineModel } from '../../../../../model/editorLineModel.js';
import { chunkRegistry } from '../../../../chunk/chunkRegistry.js';
import { cloneChunk, normalizeLineChunks } from '../../../../../utils/mergeUtils.js';



export function calculateBackspaceState(currentState, lineIndex, offset, ranges = [], stateAPI) {
    // 1. 선택 영역 삭제
    if (ranges.length > 0 && (ranges.length > 1 || ranges[0].startIndex !== ranges[0].endIndex)) {
        return calculateDeleteSelectionState(currentState, ranges);
    }

    // 2. 줄 병합 (줄의 맨 앞에서 삭제 시)
    if (offset === 0 && lineIndex > 0) {
        // 2-1. 전 라인이 리스트인 경우(전 라인이 root인지 검증하는 로직이 필요할 수도?)
        const prevLineType = currentState[lineIndex - 1].chunks[0].type;
        if(prevLineType === 'unorderedList') {
            const lineActiveKey = currentState[lineIndex - 1].chunks[0].id;
            const prevLineState = stateAPI.get(lineActiveKey);
            return performListLineMerge(currentState, lineIndex, prevLineState, lineActiveKey);
        }else {
            // 2-2. 그 외인 경우
            return performLineMerge(currentState, lineIndex);
        }

    }

    // 3. 현재 줄 내부 삭제
    return performInternalDelete(currentState, lineIndex, offset, {
        isTargetChunk    : (offset, acc, len) => offset > acc && offset <= acc + len,
        getNewText       : (text, cut) => text.slice(0, cut - 1) + text.slice(cut),
        getStayAnchor    : (i, cut) => ({ chunkIndex: i, type: 'text', offset: cut - 1 }),
        getFallbackAnchor: (chunks, i) => {
            const prevIdx   = Math.max(0, i - 1);
            const prevChunk = chunks[prevIdx];
            return {
                chunkIndex: prevIdx,
                type      : i > 0 ? prevChunk.type : 'text',
                offset    : i > 0 ? chunkRegistry.get(prevChunk.type).getLength(prevChunk) : 0
            };
        }
    });
}


/**
 * 줄 병합 세부 처리
 */
function performLineMerge(currentState, lineIndex) {
    const nextState    = [...currentState];
    const prevLine     = nextState[lineIndex - 1];
    const currentLine  = nextState[lineIndex];
    
    const lastChunkIdx = Math.max(0, prevLine.chunks.length - 1);
    const lastChunk    = prevLine.chunks[lastChunkIdx];
    const lastChunkLen = chunkRegistry.get(lastChunk.type).getLength(lastChunk);

    const mergedChunks = [
        ...prevLine.chunks.map(cloneChunk), 
        ...currentLine.chunks.map(cloneChunk)
    ];

    nextState[lineIndex - 1] = EditorLineModel(prevLine.align, normalizeLineChunks(mergedChunks));
    nextState.splice(lineIndex, 1);

    return {
        newState: nextState,
        newPos: {
            lineIndex: lineIndex - 1,
            anchor: { chunkIndex: lastChunkIdx, type: lastChunk.type, offset: lastChunkLen }
        },
        deletedLineIndex: lineIndex,
        updatedLineIndex: lineIndex - 1,
        isListLineMerge : false        
    };
}

/**
 * 줄 병합 세부 처리
 */
function performListLineMerge(currentState, lineIndex, prevLineState, lineActiveKey) {
    const nextState     = [...currentState];
    const currentLine   = nextState[lineIndex];
    const nextLineState = [...prevLineState];

    const prevLine     = nextLineState[nextLineState.length - 1];
    const lastChunkIdx = Math.max(0, prevLine.chunks.length - 1);
    const lastChunk    = prevLine.chunks[lastChunkIdx];
    const lastChunkLen = chunkRegistry.get(lastChunk.type).getLength(lastChunk);

    const mergedChunks = [
        ...prevLine.chunks.map(cloneChunk), 
        ...currentLine.chunks.map(cloneChunk)
    ];

    nextLineState[nextLineState.length - 1] = EditorLineModel(prevLine.align, normalizeLineChunks(mergedChunks));
    nextState.splice(lineIndex, 1);

    return {
        newState     : nextState,
        nextLineState: nextLineState,
        lineActiveKey : lineActiveKey,
        newPos: {
            lineIndex: lineIndex - 1,
            anchor: { chunkIndex: lastChunkIdx, type: lastChunk.type, offset: lastChunkLen }
        },
        deletedLineIndex: lineIndex,
        updatedLineIndex: lineIndex - 1,
        isListLineMerge : true
    };
}
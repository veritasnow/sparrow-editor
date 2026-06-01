// /core/keyInput/services/backspace/backspaceMergeService.js

import { EditorLineModel } from '../../../../../model/editorLineModel.js';
import { chunkRegistry } from '../../../../chunk/chunkRegistry.js';
import { cloneChunk, normalizeLineChunks } from '../../../../../utils/mergeUtils.js';

/**
 * 줄 병합 세부 처리
 */
export function performLineMerge(currentState, lineIndex) {
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
export function performListLineMerge(currentState, lineIndex, prevLineState, lineActiveKey) {
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
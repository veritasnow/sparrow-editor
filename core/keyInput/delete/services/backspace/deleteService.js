// /core/keyInput/services/backspace/backspaceDeleteService.js

import { chunkRegistry } from '../../../../chunk/chunkRegistry.js';
import { EditorLineModel } from '../../../../../model/editorLineModel.js';
import { cloneChunk, normalizeLineChunks } from '../../../../../utils/mergeUtils.js';

/**
 * 줄 내부 청크 삭제 세부 처리 (Text/Atomic)
 */
export function performInternalDelete(currentState, lineIndex, offset) {
    const currentLine = currentState[lineIndex];
    let targetIndex   = -1;
    let acc           = 0;

    // 타겟 청크 탐색
    for (let i = 0; i < currentLine.chunks.length; i++) {
        const len = chunkRegistry.get(currentLine.chunks[i].type).getLength(currentLine.chunks[i]);
        if (offset > acc && offset <= acc + len) {
            targetIndex = i;
            break;
        }
        acc += len;
    }

    if (targetIndex === -1) return { newState: currentState };

    const newChunks  = [];
    let targetAnchor = null;
    let deleted      = false;
    let currentAcc   = 0;

    currentLine.chunks.forEach((chunk, i) => {
        const handler = chunkRegistry.get(chunk.type);
        if (i === targetIndex && !deleted) {
            if (handler.canSplit) {
                const cut     = offset - currentAcc;
                const newText = chunk.text.slice(0, cut - 1) + chunk.text.slice(cut);
                if (newText.length > 0) {
                    newChunks.push(handler.create(newText, chunk.style));
                    targetAnchor = { chunkIndex: i, type: 'text', offset: cut - 1 };
                } else {
                    targetAnchor = getFallbackAnchor(currentLine.chunks, i);
                }
            } else {
                targetAnchor = getFallbackAnchor(currentLine.chunks, i);
            }
            deleted = true;
        } else {
            newChunks.push(cloneChunk(chunk));
        }
        currentAcc += handler.getLength(chunk);
    });

    const nextState      = [...currentState];
    nextState[lineIndex] = EditorLineModel(currentLine.align, normalizeLineChunks(newChunks));

    return {
        newState: nextState,
        newPos  : { lineIndex, anchor: targetAnchor },
        updatedLineIndex: lineIndex,
        isListLineMerge : false
    };
}

function getFallbackAnchor(chunks, i) {
    const prevIdx   = Math.max(0, i - 1);
    const prevChunk = chunks[prevIdx];
    return {
        chunkIndex: prevIdx,
        type: i > 0 ? prevChunk.type : 'text',
        offset: i > 0 ? chunkRegistry.get(prevChunk.type).getLength(prevChunk) : 0
    };
}
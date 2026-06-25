// /core/keyInput/services/backspace/backspaceDeleteService.js

import { chunkRegistry } from '../../../../chunk/chunkRegistry.js';
import { EditorLineModel } from '../../../../../model/editorLineModel.js';
import { cloneChunk, normalizeLineChunks } from '../../../../../utils/mergeUtils.js';

/**
 * 줄 내부 청크 삭제 처리 (Delete: 현재 위치의 뒷 글자 삭제)
 */
export function performInternalDelete(currentState, lineIndex, offset) {
    const currentLine = currentState[lineIndex];
    const { chunks }  = currentLine;
    let targetIndex   = -1;
    let acc           = 0;

    for (let i = 0; i < chunks.length; i++) {
        const len = chunkRegistry.get(chunks[i].type).getLength(chunks[i]);
        if (offset >= acc && offset < acc + len) {
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

    chunks.forEach((chunk, i) => {
        const handler = chunkRegistry.get(chunk.type);
        if (i === targetIndex && !deleted) {
            if (handler.canSplit) {
                const cut = offset - currentAcc;
                const newText = chunk.text.slice(0, cut) + chunk.text.slice(cut + 1);
                if (newText.length > 0) {
                    newChunks.push(handler.create(newText, chunk.style));
                }
                targetAnchor = { chunkIndex: i, type: 'text', offset: cut };
            } else {
                targetAnchor = { chunkIndex: i, type: 'text', offset: offset };
            }
            deleted = true;
        } else {
            newChunks.push(cloneChunk(chunk));
        }
        currentAcc += handler.getLength(chunk);
    });

    const nextState = [...currentState];
    nextState[lineIndex] = EditorLineModel(currentLine.align, normalizeLineChunks(newChunks));

    return {
        newState: nextState,
        newPos: { lineIndex, anchor: targetAnchor },
        updatedLineIndex: lineIndex
    };
}
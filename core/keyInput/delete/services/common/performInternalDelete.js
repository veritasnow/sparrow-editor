// /core/keyInput/services/common/performInternalDelete.js
import { chunkRegistry } from '../../../../chunk/chunkRegistry.js';
import { EditorLineModel } from '../../../../../model/editorLineModel.js';
import { cloneChunk, normalizeLineChunks } from '../../../../../utils/mergeUtils.js';

export function performInternalDelete(currentState, lineIndex, offset, strategy) {
    const currentLine = currentState[lineIndex];
    const { chunks }  = currentLine;
    let targetIndex   = -1;
    let acc           = 0;

    // 1. [전략 주입] 타겟 청크 탐색
    for (let i = 0; i < chunks.length; i++) {
        const len = chunkRegistry.get(chunks[i].type).getLength(chunks[i]);
        if (strategy.isTargetChunk(offset, acc, len)) {
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
                // 2. [전략 주입] 글자 자르기
                const newText = strategy.getNewText(chunk.text, cut);
                
                if (newText.length > 0) {
                    newChunks.push(handler.create(newText, chunk.style));
                    // 3. [전략 주입] 텍스트가 남았을 때의 커서 위치 계산
                    targetAnchor = strategy.getStayAnchor(i, cut);
                } else {
                    // 4. [전략 주입] 청크가 완전히 사라졌을 때의 커서 위치 계산
                    targetAnchor = strategy.getFallbackAnchor(chunks, i, offset);
                }
            } else {
                // 원자적(Atomic) 청크 삭제 시 커서 처리
                targetAnchor = strategy.getFallbackAnchor(chunks, i, offset);
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
        updatedLineIndex: lineIndex,
        isListLineMerge: false // 백스페이스 내부 삭제 호환용
    };
}
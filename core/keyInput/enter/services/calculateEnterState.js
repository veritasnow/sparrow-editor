import { cloneChunk, normalizeLineChunks } from '../../../../utils/mergeUtils.js';
import { EditorLineModel } from '../../../../model/editorLineModel.js';
import { chunkRegistry } from '../../../chunk/chunkRegistry.js';
/**
 * [Step 2] 현재 라인을 분할하여 새로운 상태(State) 계산
 */
export function calculateEnterState(currentState, lineIndex, offset, containerId) {
    const currentLine  = currentState[lineIndex];
    const beforeChunks = [];
    const afterChunks  = [];
    let acc = 0;

    currentLine.chunks.forEach(chunk => {
        const handler  = chunkRegistry.get(chunk.type);
        const chunkLen = handler ? handler.getLength(chunk) : (chunk.text?.length || 0);
        
        if (handler && !handler.canSplit) {
            if (acc + chunkLen <= offset) {
                beforeChunks.push(cloneChunk(chunk));
            } else {
                afterChunks.push(cloneChunk(chunk));
            }
        } else {
            const start = acc;
            const end   = acc + chunkLen;

            if (offset <= start) {
                afterChunks.push(cloneChunk(chunk));
            } else if (offset >= end) {
                beforeChunks.push(cloneChunk(chunk));
            } else {
                const cut = offset - start;
                const beforeText = chunk.text.slice(0, cut);
                const afterText  = chunk.text.slice(cut);
                
                if (beforeText) {
                    beforeChunks.push(handler ? handler.create(beforeText, chunk.style) : { type: 'text', text: beforeText, style: chunk.style });
                }
                if (afterText) {
                    afterChunks.push(handler ? handler.create(afterText, chunk.style) : { type: 'text', text: afterText, style: chunk.style });
                }
            }
        }
        acc += chunkLen;
    });

    const finalBeforeChunks = normalizeLineChunks(beforeChunks);
    const finalAfterChunks  = normalizeLineChunks(afterChunks);

    const nextState      = [...currentState];
    nextState[lineIndex] = EditorLineModel(currentLine.align, finalBeforeChunks);
    
    const newLineData    = EditorLineModel(currentLine.align, finalAfterChunks);
    nextState.splice(lineIndex + 1, 0, newLineData);

    const newPos = {
        containerId, // 커서가 돌아갈 컨테이너 명시
        lineIndex: lineIndex + 1,
        anchor: {
            chunkIndex: 0,
            type      : 'text',
            offset    : 0
        }
    };

    return { newState: nextState, newPos, newLineData, lineIndex };
}
// /core/keyInput/services/backspace/backspacePositionService.js
import { getRanges } from '../../../../../utils/rangeUtils.js';
import { getLineLengthFromState } from '../../../../../utils/editorStateUtils.js';
import { chunkRegistry } from '../../../../chunk/chunkRegistry.js';

/**
 * [Step 2] 입력된 Selection 정보를 바탕으로 논리적 삭제 위치를 도출
 */
export function resolveTargetPosition(currentState, selectionAPI, domRanges, isSelection) {
    if (isSelection) {
        const ranges = getRanges(currentState, domRanges);
        return {
            ranges,
            lineIndex: ranges[0].lineIndex,
            offset   : ranges[0].endIndex // Atomic 삭제 로직을 위해 endIndex 사용
        };
    }

    let lineIndex = domRanges[0].lineIndex;
    let offset    = domRanges[0].endIndex;
    const currentLine = currentState[lineIndex];

    // 커서가 0인데 Atomic 청크 뒤에 있는 경우 offset 보정
    const context = selectionAPI.getSelectionContext();
    if (context.dataIndex !== null && currentLine) {
        const targetChunk = currentLine.chunks[context.dataIndex];
        const handler     = chunkRegistry.get(targetChunk.type);
        if (handler && !handler.canSplit && offset === 0) {
            offset = 1; 
        }
    }

    const lineLen = getLineLengthFromState(currentLine);
    return { 
        lineIndex, 
        offset: Math.max(0, Math.min(offset, lineLen)), 
        ranges: [] 
    };
}
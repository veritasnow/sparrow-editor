import { getLineLengthFromState } from '../../../../../utils/editorStateUtils.js';
import { getRanges } from "../../../../../utils/rangeUtils.js";

/**
 * [Step 2] 논리적 삭제 위치 도출
 */
export function resolveTargetPosition(currentState, domRanges, isSelection) {
    if (isSelection) {
        const ranges = getRanges(currentState, domRanges);
        return {
            ranges,
            lineIndex: ranges[0].lineIndex,
            offset: ranges[0].startIndex
        };
    }

    const lineIndex   = domRanges[0].lineIndex;
    const offset      = domRanges[0].startIndex; // Delete는 시작 지점 기준
    const currentLine = currentState[lineIndex];
    const lineLen     = getLineLengthFromState(currentLine);

    return { 
        lineIndex, 
        offset: Math.max(0, Math.min(offset, lineLen)), 
        ranges: [] 
    };
}
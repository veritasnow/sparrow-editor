import { getLineLengthFromState } from '../../../../utils/editorStateUtils.js';

/**
 * [Step 1] 엔터가 발생한 논리적 위치 계산
 */
export function resolveEnterPosition(currentState, domRanges) {
    const { lineIndex, endIndex: domOffset } = domRanges[0];
    const lineState = currentState[lineIndex];
    const lineLen   = lineState ? getLineLengthFromState(lineState) : 0;
    
    return {
        lineIndex,
        offset: Math.max(0, Math.min(domOffset, lineLen))
    };
}

// 공통 커서 처리 헬퍼
export function commitCursor(finalPos, stateAPI, selectionAPI) {
    if (!finalPos) return;
    stateAPI.saveCursor(finalPos);
    requestAnimationFrame(() => {
        selectionAPI.restoreCursor(finalPos);
    });
}
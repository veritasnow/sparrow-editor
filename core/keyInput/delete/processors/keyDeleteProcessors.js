// /core/keyInput/processors/keyDeleteProcessors.js
import { shouldPreventDeletion } from '../services/common/shouldPreventDeletion.js';
import { resolveTargetPosition } from '../services/delete/resolveTargetPosition.js';
import { calculateDeleteState } from '../services/delete/calculateDeleteState.js';
import { updateLine } from '../services/common/updateLine.js';

/**
 * ⌦ Delete 키 실행 메인 함수
 */
export function executeDelete(e, { stateAPI, uiAPI, selectionAPI }) {
    const activeKey = selectionAPI.getActiveKey();
    if (!activeKey) return;

    const currentState = stateAPI.get(activeKey);
    const domRanges    = selectionAPI.getDomSelection(activeKey);
    if (!domRanges || domRanges.length === 0) return;

    const firstDomRange = domRanges[0];
    const isSelection = domRanges.length > 1 || firstDomRange.startIndex !== firstDomRange.endIndex;

    // 1. [검증] 삭제 방지 가드 (마지막 라인 끝, 테이블 셀 경계 등)
    if (shouldPreventDeletion(currentState, activeKey, firstDomRange, isSelection, 'delete', e)) {
        return;
    }

    // 2. [위치 파악] 삭제할 위치(lineIndex, offset) 도출
    const { lineIndex, offset, ranges } = resolveTargetPosition(currentState, domRanges, isSelection);

    // 3. [상태 계산] 비즈니스 로직 수행
    const result = calculateDeleteState(currentState, lineIndex, offset, ranges);
    if (result.newState === currentState) return;

    // 4. [UI 반영] 상태 저장 및 DOM 업데이트
    updateLine(activeKey, result, { stateAPI, uiAPI, selectionAPI });
}
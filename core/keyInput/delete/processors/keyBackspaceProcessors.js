// /core/keyInput/processors/keyBackspaceProcessors.js

import { shouldPreventDeletion } from '../services/guard/guardService.js';
import { resolveTargetPosition } from '../services/backspace/positionService.js';
import { calculateBackspaceState } from '../services/backspace/stateService.js';
import { applyBackspaceResult, applyBackspaceLineResult } from '../services/backspace/applyService.js';
import { removeList } from '../services/backspace/lstService.js';

export function executeBackspace(e, { stateAPI, uiAPI, selectionAPI }) {

    const activeKey = selectionAPI.getActiveKey();
    if (!activeKey) return;

    const currentState = stateAPI.get(activeKey);

    // 리스트 삭제 특수 로직
    if (activeKey.startsWith('list-') && currentState.length === 1) {
        const container = document.getElementById(activeKey);
        if (container) {
            const removed = removeList(e, { stateAPI, uiAPI, selectionAPI }, currentState, activeKey,  container);
            if (removed) return;
        }
    }

    const domRanges = selectionAPI.getDomSelection(activeKey);

    if (!domRanges || domRanges.length === 0) return;

    const firstDomRange = domRanges[0];
    const isSelection =  domRanges.length > 1 || firstDomRange.startIndex !== firstDomRange.endIndex;

    // 1. 삭제 방지
    if (shouldPreventDeletion(currentState, activeKey, firstDomRange, isSelection, 'backspace', e)) {
        return;
    }

    // 2. 위치 계산
    const { lineIndex, offset, ranges } = resolveTargetPosition(currentState, selectionAPI, domRanges, isSelection);  );

    // 3. 상태 계산
    const result = calculateBackspaceState(currentState, lineIndex, offset, ranges, stateAPI);

    if (result.newState === currentState) return;

    // 4. UI 반영
    if (result.isListLineMerge) {
        applyBackspaceLineResult(activeKey, result, { stateAPI, uiAPI, selectionAPI });
    } else {
        applyBackspaceResult(activeKey, result, { stateAPI, uiAPI, selectionAPI });
    }
}
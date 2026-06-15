// /core/keyInput/processors/keyBackspaceProcessors.js

import { shouldPreventDeletion } from '../services/common/shouldPreventDeletion.js';
import { resolveBackspacePosition } from '../services/backspace/resolveBackspacePosition.js';
import { calculateBackspaceState } from '../services/backspace/calculateBackspaceState.js';
import { updateLine } from '../services/common/updateLine.js';
import { mergeListLine } from '../services/backspace/mergeListLine.js';
import { removeListContainer } from '../services/backspace/removeListContainer.js';

export function executeBackspace(e, { stateAPI, uiAPI, selectionAPI }) {

    const activeKey = selectionAPI.getActiveKey();
    if (!activeKey) return;

    const currentState = stateAPI.get(activeKey);

    // 리스트 삭제 특수 로직
    if (activeKey.startsWith('list-') && currentState.length === 1) {
        const container = document.getElementById(activeKey);
        if (container) {
            const removed = removeListContainer(e, { stateAPI, uiAPI, selectionAPI }, currentState, activeKey,  container);
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
    const { lineIndex, offset, ranges } = resolveBackspacePosition(currentState, selectionAPI, domRanges, isSelection);

    // 3. 상태 계산
    const result = calculateBackspaceState(currentState, lineIndex, offset, ranges, stateAPI);

    if (result.newState === currentState) return;

    // 4. UI 반영
    if (result.isListLineMerge) {
        mergeListLine(activeKey, result, { stateAPI, uiAPI, selectionAPI });
    } else {
        updateLine(activeKey, result, { stateAPI, uiAPI, selectionAPI });
    }
}
// /core/keyInput/services/backspace/backspaceStateService.js

import { performLineMerge, performListLineMerge } from './mergeService.js';
import { performInternalDelete } from './deleteService.js';
import { calculateDeleteSelectionState } from '../calculateDeleteService.js'

export function calculateBackspaceState(currentState, lineIndex, offset, ranges = [], stateAPI) {
    // 1. 선택 영역 삭제
    if (ranges.length > 0 && (ranges.length > 1 || ranges[0].startIndex !== ranges[0].endIndex)) {
        return calculateDeleteSelectionState(currentState, ranges);
    }

    // 2. 줄 병합 (줄의 맨 앞에서 삭제 시)
    if (offset === 0 && lineIndex > 0) {
        // 2-1. 전 라인이 리스트인 경우(전 라인이 root인지 검증하는 로직이 필요할 수도?)
        const prevLineType = currentState[lineIndex - 1].chunks[0].type;
        if(prevLineType === 'unorderedList') {
            const lineActiveKey = currentState[lineIndex - 1].chunks[0].id;
            const prevLineState = stateAPI.get(lineActiveKey);
            return performListLineMerge(currentState, lineIndex, prevLineState, lineActiveKey);
        }else {
            // 2-2. 그 외인 경우
            return performLineMerge(currentState, lineIndex);
        }

    }

    // 3. 현재 줄 내부 삭제
    return performInternalDelete(currentState, lineIndex, offset);
}
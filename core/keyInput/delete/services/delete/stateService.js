import { getLineLengthFromState } from '../../../../../utils/editorStateUtils.js';
import { calculateDeleteSelectionState } from '../calculateDeleteService.js';
import { performInternalDelete } from './deleteService.js';
import { performNextLineMerge } from './mergeService.js';

/**
 * [Step 3] 실제 데이터 상태(State) 계산 메인
 */
export function calculateDeleteState(currentState, lineIndex, offset, ranges = []) {
    // 1. 선택 영역 삭제
    if (ranges?.length > 0 && (ranges.length > 1 || ranges[0].startIndex !== ranges[0].endIndex)) {
        return calculateDeleteSelectionState(currentState, ranges);
    }

    const currentLine = currentState[lineIndex];
    const currentLineLen = getLineLengthFromState(currentLine);

    // 2. 줄 병합 (줄의 맨 끝에서 삭제 시 아랫줄을 끌어올림)
    if (offset === currentLineLen && lineIndex < currentState.length - 1) {
        return performNextLineMerge(currentState, lineIndex);
    }

    // 3. 현재 줄 내부 삭제
    return performInternalDelete(currentState, lineIndex, offset);
}

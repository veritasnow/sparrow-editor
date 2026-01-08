// features/inline/inlineServiceBase.js
import { getRanges } from "../../utils/rangeUtils.js";

export function createInlineServiceBase(stateAPI, uiAPI) {
    /**
     * @param {Function} updateFn - (state, ranges) => newState (주로 toggleInlineStyle이나 applyStylePatch)
     * @param {Object} options - { saveCursor: boolean }
     */
    function applyInline(updateFn, options = { saveCursor: true }) {
        // 1. 현재 에디터 상태와 상세 선택 위치(Table detail 포함)를 가져옵니다.
        const currentState = stateAPI.get();
        const currentPos = uiAPI.getSelectionPosition();
        
        console.log('[applyInline] 시작 - 현재 포지션:', currentPos);

        if (!currentPos) return;

        // 2. DOM Selection 범위를 가져옵니다.
        const domRanges = uiAPI.getDomSelection();
        if (!domRanges || domRanges.length === 0) return;

        // 3. ✨ [개선] getRanges에 currentPos를 넘겨 detail이 포함된 범위를 한 번에 생성합니다.
        // 이제 rangesWithDetail에는 테이블의 행, 열, 셀 내부 오프셋 정보가 모두 포함됩니다.
        const rangesWithDetail = getRanges(currentState, domRanges, currentPos);

        console.log('[applyInline] 가공된 정밀 범위:', rangesWithDetail);

        // 4. 상태 업데이트 함수 실행 (예: applyStylePatch 실행)
        const newState = updateFn(currentState, rangesWithDetail);

        // 5. 변경된 상태 저장
        stateAPI.save(newState);

        // 6. 커서 정보 저장 (필요 시)
        if (options.saveCursor) {
            stateAPI.saveCursor(currentPos);
        }

        // 7. 렌더링: 변경된 라인만 선별적으로 리렌더링
        rangesWithDetail.forEach(({ lineIndex }) => {
            // 상태가 실제로 변했는지 확인 후 해당 라인만 다시 그립니다.
            if (stateAPI.isLineChanged(lineIndex)) {
                uiAPI.renderLine(lineIndex, newState[lineIndex]);
            }
        });

        // 8. 🚀 커서 복원: 상태 업데이트 후 DOM이 새로 그려졌으므로 커서를 다시 잡아줍니다.
        // setTimeout을 사용하여 브라우저 렌더링 사이클 이후에 실행되도록 보장합니다.
        setTimeout(() => {
            uiAPI.restoreCursor(currentPos);
        }, 0);
    }

    return { applyInline };
}
/*
export function createInlineServiceBase(stateAPI, uiAPI) {
     // updateFn: (currentState, ranges) => newState
     // options: { saveCursor: boolean }
    function applyInline(updateFn, options = { saveCursor: true }) {
        const currentState = stateAPI.get();
        
        // 1. 통합 커서 포지션 정보를 가져옴 (테이블 여부 등 포함)
        const currentPos = uiAPI.getSelectionPosition();
        console.log('currentPos:',currentPos);
        if (!currentPos) return;

        // 2. 다중 선택 영역 분석 (기존 텍스트 오프셋 기반 유지하되 보정용으로 사용)
        const domRanges = uiAPI.getDomSelection();
        console.log('domRanges:',domRanges);

        if (!domRanges || domRanges.length === 0) return;
        const ranges = getRanges(currentState, domRanges);

        // 3. 상태 변경 (굵게/기울임 등 처리)
        const newState = updateFn(currentState, ranges);

        // 4. 상태 저장
        stateAPI.save(newState);

        // 5. 커서 상태 저장 (통합 모델 규격으로 저장)
        if (options.saveCursor) {
            stateAPI.saveCursor(currentPos);
        }

        // 6. 변경된 라인 렌더링
        ranges.forEach(({ lineIndex }) => {
            if (stateAPI.isLineChanged(lineIndex)) {
                uiAPI.renderLine(lineIndex, newState[lineIndex]);
            }
        });

        // 7. 커서 복원 (통합 복원 함수 활용)
        // [개선] 단순히 숫자 offset이 아니라, 작업 전 유지했던 청크 정보(currentPos)를 기반으로 복원
        // 만약 스타일 적용 후 청크가 쪼개졌다면, restoreCursor 내부에서 유연하게 대응함
        uiAPI.restoreCursor(currentPos);
    }

    return { applyInline };
}    */
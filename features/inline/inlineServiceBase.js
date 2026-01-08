// features/inline/inlineServiceBase.js
import { getRanges } from "../../utils/rangeUtils.js";

export function createInlineServiceBase(stateAPI, uiAPI) {
    /**
     * updateFn: (currentState, ranges) => newState
     * options: { saveCursor: boolean }
     */
    function applyInline(updateFn, options = { saveCursor: true }) {
        const currentState = stateAPI.get();
        const currentPos = uiAPI.getSelectionPosition();
        
        // 🔍 로그 추가: 현재 커서 위치 확인
        console.log('[applyInline] currentPos:', currentPos);

        if (!currentPos) return;

        const domRanges = uiAPI.getDomSelection();
        if (!domRanges || domRanges.length === 0) return;

        const baseRanges = getRanges(currentState, domRanges);

        const rangesWithDetail = baseRanges.map(range => ({
            ...range,
            detail: currentPos.anchor.type === 'table' ? currentPos.anchor.detail : null
        }));

        // 🔍 로그 추가: 가공된 ranges 확인
        console.log('[applyInline] rangesWithDetail:', rangesWithDetail);

        const newState = updateFn(currentState, rangesWithDetail);

        stateAPI.save(newState);

        if (options.saveCursor) {
            stateAPI.saveCursor(currentPos);
        }

        rangesWithDetail.forEach(({ lineIndex }) => {
            if (stateAPI.isLineChanged(lineIndex)) {
                uiAPI.renderLine(lineIndex, newState[lineIndex]);
            }
        });

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
// features/inline/inlineServiceBase.js
import { getRanges } from "../../utils/rangeUtils.js";

export function createInlineServiceBase(stateAPI, uiAPI) {
    
    /**
     * updateFn: (currentState, ranges) => newState
     * options: { saveCursor: boolean }
     */
    function applyInline(updateFn, options = { saveCursor: true }) {
        // 1. 현재 활성화된 영역의 Key 확보
        const activeKey = uiAPI.getActiveKey();
        if (!activeKey) return;

        // 2. 해당 영역(Key)의 상태만 가져오기
        const currentState = stateAPI.get(activeKey);
        
        // 3. 통합 커서 포지션 정보 (테이블 셀 정보 등 포함)
        const currentPos = uiAPI.getSelectionPosition();
        if (!currentPos) return;

        // 4. 다중 선택 영역 분석 (activeKey 영역 내의 P태그들 기준)
        const domRanges = uiAPI.getDomSelection();
        if (!domRanges || domRanges.length === 0) return;

        // 5. 스타일을 적용할 구체적인 모델 범위(ranges) 계산
        const ranges = getRanges(currentState, domRanges);

        // 6. 비즈니스 로직 실행 (상태 변경)
        const newState = updateFn(currentState, ranges);

        // 7. 상태 저장 (Key 기반 저장)
        stateAPI.save(activeKey, newState);

        // 8. 커서 상태 저장
        if (options.saveCursor) {
            stateAPI.saveCursor({ ...currentPos, containerId: activeKey });
        }

        // 9. 변경된 라인만 렌더링
        ranges.forEach(({ lineIndex }) => {
            // 해당 영역의 특정 라인이 변경되었는지 체크 후 렌더링
            // (isLineChanged 구현에 따라 activeKey 전달이 필요할 수 있음)
            uiAPI.renderLine(lineIndex, newState[lineIndex]);
        });

        // 10. 커서 복원 (어떤 컨테이너인지 알려주어 TD 내부에서도 정확히 복원)
        uiAPI.restoreCursor({ ...currentPos, containerId: activeKey });
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
}
*/
// features/inline/inlineServiceBase.js
import { getRanges } from "../../utils/rangeUtils.js";
import { normalizeCursorData } from "../../utils/cursorUtils.js"; // 💡 유틸리티 추가

export function createInlineServiceBase(stateAPI, uiAPI) {
    
    /**
     * updateFn: (currentState, ranges) => newState
     * options: { saveCursor: boolean }
     */
    function applyInline(updateFn, options = { saveCursor: true }) {
        // 1. 현재 활성화된 영역의 Key 확보 (본문 or TD ID)
        const activeKey = uiAPI.getActiveKey();
        if (!activeKey) return;

        // 2. 해당 영역의 상태 확보
        const currentState = stateAPI.get(activeKey);
        
        // 3. 현재 포지션 정보 가져오기
        const currentPos = uiAPI.getSelectionPosition();
        if (!currentPos) return;

        // 💡 [개선] 가져온 포지션 정보를 즉시 표준 규격으로 정규화
        const normalizedPos = normalizeCursorData({
            ...currentPos,
            containerId: activeKey
        }, activeKey);

        // 4. 다중 선택 영역 분석
        const domRanges = uiAPI.getDomSelection();
        if (!domRanges || domRanges.length === 0) return;

        // 5. 스타일을 적용할 구체적인 모델 범위(ranges) 계산
        const ranges = getRanges(currentState, domRanges);

        // 6. 비즈니스 로직 실행 (스타일 적용 등)
        const newState = updateFn(currentState, ranges);

        // 7. 상태 저장 (Key 기반)
        stateAPI.save(activeKey, newState);

        // 8. 커서 상태 저장
        if (options.saveCursor && normalizedPos) {
            stateAPI.saveCursor(normalizedPos); // 정규화된 데이터 저장
        }

        // 9. 변경된 라인만 렌더링
        ranges.forEach(({ lineIndex }) => {
            // UI 렌더링 시 activeKey를 함께 넘겨 정확한 컨테이너를 타겟팅
            uiAPI.renderLine(lineIndex, newState[lineIndex], activeKey);
        });

        // 10. 커서 복원 (정규화된 지도를 보고 TD 내부까지 정밀 복원)
        if (normalizedPos) {
            uiAPI.restoreCursor(normalizedPos);
        }
    }

    return { applyInline };
}
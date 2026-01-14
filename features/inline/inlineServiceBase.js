// features/inline/inlineServiceBase.js
import { getRanges } from "../../utils/rangeUtils.js";
import { normalizeCursorData } from "../../utils/cursorUtils.js";

/**
 * 인라인 스타일(Bold, Italic 등)을 적용하는 공통 서비스 베이스
 */
export function createInlineServiceBase(stateAPI, uiAPI) {
    
    /**
     * updateFn: (currentState, ranges) => newState
     * options: { saveCursor: boolean }
     */
    function applyInline(updateFn, options = { saveCursor: true }) {
        // 1. 현재 활성화된 영역의 Key 확보 (본문 root 혹은 특정 TD/TH ID)
        // 💡 팝업이나 버튼 클릭으로 포커스를 잃었을 경우를 대비해 LastActiveKey도 고려
        const activeKey = uiAPI.getActiveKey() || uiAPI.getLastActiveKey();

        console.log('[InlineService] applyInline ActiveKey:', activeKey);

        if (!activeKey) return;

        // 2. 해당 영역의 상태 확보 (Key 기반)
        const currentState = stateAPI.get(activeKey);
        console.log('currentState:', currentState);
        if (!currentState) return;
        
        // 3. 현재 포지션 정보 가져오기
        const currentPos = uiAPI.getDomSelection();
        console.log('currentPos:', currentPos);        
        if (!currentPos) return;

        // 4. 가져온 포지션 정보를 즉시 표준 규격으로 정규화 (어느 컨테이너인지 명시)
        const normalizedPos = normalizeCursorData({
            ...currentPos,
            containerId: activeKey
        }, activeKey);

        // 5. 다중 선택 영역 분석 (DOM Selection 데이터)
        const domRanges = uiAPI.getDomSelection();
        if (!domRanges || domRanges.length === 0) return;
        console.log("domRanges:", domRanges);

        // 6. 스타일을 적용할 구체적인 모델 범위(ranges) 계산
        const ranges = getRanges(currentState, domRanges);

        // 7. 비즈니스 로직 실행 (스타일 적용 모델 생성)
        const newState = updateFn(currentState, ranges);
        console.log("New State:", newState);
        if (!newState || newState === currentState) return;

        // 8. 상태 저장 (해당 activeKey 저장소에 반영)
        stateAPI.save(activeKey, newState);

        // 9. 커서 상태 저장 (Undo/Redo 시 복원용)
        if (options.saveCursor && normalizedPos) {
            stateAPI.saveCursor(normalizedPos);
        }

        // 10. 변경된 라인만 렌더링
        // 💡 UI 렌더링 시 activeKey를 전달하여 테이블 셀 등 올바른 컨테이너를 타겟팅합니다.
        ranges.forEach(({ lineIndex }) => {
            const lineData = newState[lineIndex];
            if (lineData) {
                uiAPI.renderLine(lineIndex, lineData, activeKey);
            }
        });

        // 11. 커서 복원 (정규화된 정보를 바탕으로 해당 셀 내부 위치로 복귀)
        if (normalizedPos) {
            uiAPI.restoreCursor(normalizedPos);
        }
    }

    return { applyInline };
}
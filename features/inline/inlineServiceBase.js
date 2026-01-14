// features/inline/inlineServiceBase.js
import { getRanges } from "../../utils/rangeUtils.js";
import { normalizeCursorData } from "../../utils/cursorUtils.js";

/**
 * 인라인 스타일(Bold, Italic 등)을 적용하는 공통 서비스 베이스
 * [다중 셀 선택 지원 버전]
 */
export function createInlineServiceBase(stateAPI, uiAPI) {
    
    /**
     * updateFn: (currentState, ranges) => newState
     * options: { saveCursor: boolean }
     */
    function applyInline(updateFn, options = { saveCursor: true }) {
        // 1. 실제로 텍스트가 선택된 모든 영역의 Keys 확보
        const activeKeys = uiAPI.getActiveKeys();
        
        // 만약 선택된 영역이 없다면 lastActiveKey라도 시도
        const targets = activeKeys.length > 0 ? activeKeys : [uiAPI.getLastActiveKey()].filter(Boolean);
        
        if (targets.length === 0) return;

        console.log('[InlineService] Targets to apply:', targets);

        let lastNormalizedPos = null;

        // 2. 각 셀(Container)별로 루프를 돌며 스타일 적용
        targets.forEach(activeKey => {
            // A. 해당 영역의 상태 확보
            const currentState = stateAPI.get(activeKey);
            if (!currentState) return;
            
            // B. 해당 셀 내부의 구체적인 드래그 범위(domRanges) 추출
            // 개편된 uiAPI.getDomSelection은 인자로 넘긴 ID 내부만 계산합니다.
            const domRanges = uiAPI.getDomSelection(activeKey);
            if (!domRanges || domRanges.length === 0) return;

            // C. 스타일을 적용할 구체적인 모델 범위(ranges) 계산
            const ranges = getRanges(currentState, domRanges);

            // D. 비즈니스 로직 실행 (스타일 적용 모델 생성)
            const newState = updateFn(currentState, ranges);
            if (!newState || newState === currentState) return;

            // E. 상태 저장
            stateAPI.save(activeKey, newState);

            // F. 변경된 라인만 렌더링 (해당 activeKey 컨테이너 타겟팅)
            ranges.forEach(({ lineIndex }) => {
                const lineData = newState[lineIndex];
                if (lineData) {
                    uiAPI.renderLine(lineIndex, lineData, activeKey);
                }
            });

            // G. 커서 정보 정규화 (나중에 복원하기 위해 마지막 셀 정보를 보관)
            // 보통 드래그의 끝점이 포함된 셀이 마지막으로 처리되도록 설계되었습니다.
            const currentPos = uiAPI.getSelectionPosition(); // 현재 포커스 기준 좌표
            if (currentPos && currentPos.containerId === activeKey) {
                lastNormalizedPos = normalizeCursorData(currentPos, activeKey);
            }
        });

        // 3. 커서 상태 저장 및 복원 (모든 셀 업데이트 완료 후)
        if (lastNormalizedPos) {
            if (options.saveCursor) {
                stateAPI.saveCursor(lastNormalizedPos);
            }
            uiAPI.restoreCursor(lastNormalizedPos);
        }
    }

    return { applyInline };
}
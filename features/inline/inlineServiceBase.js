// features/inline/inlineServiceBase.js
import { getRanges } from "../../utils/rangeUtils.js";
import { normalizeCursorData } from "../../utils/cursorUtils.js";

/**
 * 인라인 스타일(Bold, Italic 등)을 적용하는 공통 서비스 베이스
 */
export function createInlineServiceBase(stateAPI, uiAPI) {
    function applyInline(updateFn, options = { saveCursor: true }) {
        const activeKeys = uiAPI.getActiveKeys();
        const targets = activeKeys.length > 0 ? activeKeys : [uiAPI.getLastActiveKey()].filter(Boolean);
        if (targets.length === 0) return;

        const updates = [];
        const allNormalizedPositions = [];

        targets.forEach((activeKey) => {
            const currentState = stateAPI.get(activeKey);
            if (!currentState) return;

            const domRanges = uiAPI.getDomSelection(activeKey);
            if (!domRanges || domRanges.length === 0) return;

            // 1. DOM의 오프셋을 그대로 State 인덱스로 사용 (1:1 매핑)
            const ranges = getRanges(currentState, domRanges);
            const newState = updateFn(currentState, ranges);

            if (newState && newState !== currentState) {
                updates.push({ key: activeKey, newState, ranges });
            }

            // 2. 커서 위치 저장 
            const normalized = normalizeCursorData(domRanges, activeKey); 
            allNormalizedPositions.push(normalized);
        });

        // 3. 일괄 업데이트 실행 및 렌더링
        if (updates.length > 0) {
            stateAPI.saveBatch(updates, { saveHistory: true });

            updates.forEach(update => {
                const container = document.getElementById(update.key);
                if (!container) return;
                const lineElements = Array.from(container.querySelectorAll(':scope > .text-block'));

                update.ranges.forEach(({ lineIndex }) => {
                    const lineData = update.newState[lineIndex];
                    const lineEl = lineElements[lineIndex];
                    // 테이블 유지 로직
                    const tablePool = lineEl ? Array.from(lineEl.querySelectorAll('.chunk-table')) : null;
                    uiAPI.renderLine(lineIndex, lineData, update.key, tablePool);
                });
            });
        }

        console.log('allNormalizedPositions: ', allNormalizedPositions);

        // 4. 다중 커서 복원 (이제 데이터와 DOM의 오차가 없음)
        if (allNormalizedPositions.length > 0 && options.saveCursor) {
            stateAPI.saveCursor(allNormalizedPositions); 
            uiAPI.restoreMultiBlockCursor(allNormalizedPositions);
        }
    }
    return { applyInline };
}
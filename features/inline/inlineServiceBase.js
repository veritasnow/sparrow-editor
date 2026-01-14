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
        let lastNormalizedPos = null;

        // 1. 먼저 모든 변경사항을 계산해서 모음
        targets.forEach((activeKey, index) => {
            const currentState = stateAPI.get(activeKey);
            if (!currentState) return;

            const domRanges = uiAPI.getDomSelection(activeKey);
            if (!domRanges || domRanges.length === 0) return;

            const ranges = getRanges(currentState, domRanges);
            const newState = updateFn(currentState, ranges);

            if (newState && newState !== currentState) {
                updates.push({ key: activeKey, newState, ranges });
            }

            if (index === targets.length - 1) {
                const currentPos = uiAPI.getDomSelection(activeKey);
                if (currentPos) {
                    console.log('currentPos111111111111111:', currentPos);
                    lastNormalizedPos = normalizeCursorData(currentPos, activeKey);
                }
            }
        });

        // 2. 💡 단 한 번만 Store에 명령을 내림
        if (updates.length > 0) {
            // stateAPI에 새로 만든 batchSave를 호출 (saveHistory는 기본 true)
            stateAPI.saveBatch(updates, { saveHistory: true });

            // 3. UI 렌더링은 별도로 수행
            updates.forEach(update => {
                update.ranges.forEach(({ lineIndex }) => {
                    const lineData = update.newState[lineIndex];
                    uiAPI.renderLine(lineIndex, lineData, update.key);
                });
            });
        }

        console.log('lastNormalizedPos:', lastNormalizedPos);
        // 4. 커서 복원
        if (lastNormalizedPos) {
            console.log('applyInline lastNormalizedPos:', lastNormalizedPos);
            if (options.saveCursor) stateAPI.saveCursor(lastNormalizedPos);
            uiAPI.restoreBlockCursor(lastNormalizedPos);
        }
    }
    return { applyInline };
}
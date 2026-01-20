// features/inline/inlineServiceBase.js
import { getRanges } from "../../utils/rangeUtils.js";
import { normalizeCursorData, adjustRangesByChunks } from "../../utils/cursorUtils.js";

/**
 * 인라인 스타일(Bold, Italic 등)을 적용하는 공통 서비스 베이스
 */
export function createInlineServiceBase(stateAPI, uiAPI) {
    function applyInline(updateFn, options = { saveCursor: true }) {
        const activeKeys = uiAPI.getActiveKeys();
        const targets = activeKeys.length > 0 ? activeKeys : [uiAPI.getLastActiveKey()].filter(Boolean);
        if (targets.length === 0) return;

        const updates = [];
        const allNormalizedPositions = []; // 💡 모든 커서 정보를 담을 배열

        targets.forEach((activeKey) => {
            const currentState = stateAPI.get(activeKey);
            if (!currentState) return;

            const domRanges = uiAPI.getDomSelection(activeKey);
            if (!domRanges || domRanges.length === 0) return;

            const ranges = getRanges(currentState, domRanges);
            const newState = updateFn(currentState, ranges);

            if (newState && newState !== currentState) {
                updates.push({ key: activeKey, newState, ranges });
            }

            // 💡 각 target(셀/블록) 마다 현재 커서 위치를 계산해서 저장
            const currentPos = uiAPI.getDomSelection(activeKey);
            console.log();('currentPos11111111111111111111 : ', currentPos);
            if (currentPos) {
                const lineIndex = currentPos[0].lineIndex;
                const lineModel = currentState[lineIndex];
                const adjustedPos = adjustRangesByChunks(currentPos, lineModel);
                const normalized = normalizeCursorData(adjustedPos, activeKey);
                allNormalizedPositions.push(normalized);
            }
        });

        // 2. 일괄 업데이트 실행
        if (updates.length > 0) {
            stateAPI.saveBatch(updates, { saveHistory: true });

            updates.forEach(update => {
                const container = document.getElementById(update.key);
                if (!container) return;
                const lineElements = Array.from(container.querySelectorAll(':scope > .text-block'));

                update.ranges.forEach(({ lineIndex }) => {
                    const lineData = update.newState[lineIndex];
                    const lineEl = lineElements[lineIndex];
                    const tablePool = lineEl ? Array.from(lineEl.querySelectorAll('.chunk-table')) : null;
                    uiAPI.renderLine(lineIndex, lineData, update.key, tablePool);
                });
            });
        }

        console.log('allNormalizedPositions11111111111111111111 : ', allNormalizedPositions);

        // 4. 다중 커서 복원 💡
        if (allNormalizedPositions.length > 0 && options.saveCursor) {
            // State에는 마지막 혹은 대표 커서 하나를 저장할 수 있지만, 
            // UI 복원은 전체 배열을 전달하여 수행합니다.
            if (options.saveCursor) {
                stateAPI.saveCursor(allNormalizedPositions); 
            }
            uiAPI.restoreMultiBlockCursor(allNormalizedPositions); // 💡 새로 만들 함수
        }
    }
    return { applyInline };
}
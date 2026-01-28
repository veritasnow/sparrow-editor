import { getRanges } from "../../utils/rangeUtils.js";
import { normalizeCursorData } from "../../utils/cursorUtils.js";

/**
 * 인라인 스타일(Bold, Italic 등) 적용 서비스 베이스 (최적화 버전)
 */
export function createInlineServiceBase(stateAPI, uiAPI) {
    function applyInline(updateFn, options = { saveCursor: true }) {
        const activeKeys = uiAPI.getActiveKeys();
        console.log("activeKeys:", activeKeys);
        const targets    = activeKeys.length > 0 ? activeKeys : [uiAPI.getLastActiveKey()].filter(Boolean);
        if (targets.length === 0) return;

        const updates                = [];
        const allNormalizedPositions = [];

        targets.forEach((activeKey) => {
            const currentState = stateAPI.get(activeKey);
            if (!currentState) return;

            const domRanges = uiAPI.getDomSelection(activeKey);
            console.log("domRanges : ", domRanges);
            if (!domRanges || domRanges.length === 0) return;

            const ranges = getRanges(currentState, domRanges);
            const newState = updateFn(currentState, ranges);

            if (newState && newState !== currentState) {
                // 🔥 [최적화] 중복 줄 번호 제거 (한 줄에 여러 선택 영역이 있을 경우 대비)
                const affectedLineIndices = Array.from(new Set(ranges.map(r => r.lineIndex)));
                updates.push({ key: activeKey, newState, affectedLineIndices });
            }

            const normalized = normalizeCursorData(domRanges, activeKey); 
            allNormalizedPositions.push(normalized);
        });

        // 3. 일괄 업데이트 실행 및 렌더링
        if (updates.length > 0) {
            stateAPI.saveBatch(updates, { saveHistory: true });

            updates.forEach(update => {
                const container = document.getElementById(update.key);
                if (!container) return;

                // 🔥 [최적화] 전체 DOM 스캔 제거. 인덱스로 즉시 접근
                update.affectedLineIndices.forEach((lineIndex) => {
                    const lineData = update.newState[lineIndex];
                    const lineEl = container.children[lineIndex]; // O(1) 접근
                    
                    if (!lineEl) return;

                    // 💡 테이블 유지 로직 최적화 (getElementsByClassName 사용)
                    const tablePool = Array.from(lineEl.getElementsByClassName('chunk-table'));
                    
                    // 해당 라인만 정밀 렌더링
                    uiAPI.renderLine(lineIndex, lineData, update.key, tablePool);
                });
            });
        }

        console.log('allNormalizedPositions:', allNormalizedPositions);

        // 4. 다중 커서 복원
        if (allNormalizedPositions.length > 0 && options.saveCursor) {
            stateAPI.saveCursor(allNormalizedPositions); 
            uiAPI.restoreMultiBlockCursor(allNormalizedPositions);
        }
    }
    return { applyInline };
}
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
                    const lineIndex = currentPos[0].lineIndex;
                    const lineModel = currentState[lineIndex];                    
                    const adjustedPos = adjustRangesByChunks(currentPos, lineModel);
                    lastNormalizedPos = normalizeCursorData(adjustedPos, activeKey);

                    //lastNormalizedPos = normalizeCursorData(currentPos, activeKey);
                }
            }
        });

        // 2. 💡 단 한 번만 Store에 명령을 내림
        if (updates.length > 0) {
            // stateAPI에 새로 만든 batchSave를 호출 (saveHistory는 기본 true)
            stateAPI.saveBatch(updates, { saveHistory: true });

            // 3. UI 렌더링 수행
            updates.forEach(update => {
                // 해당 컨테이너 엘리먼트 확보
                const container = document.getElementById(update.key);
                if (!container) return;
                
                const lineElements = Array.from(container.querySelectorAll(':scope > .text-block'));

                update.ranges.forEach(({ lineIndex }) => {
                    const lineData = update.newState[lineIndex];
                    const lineEl = lineElements[lineIndex];

                    // 💡 [추가] 해당 라인에 테이블이 있는지 확인하고 있으면 Pool 생성
                    // 인라인 스타일 적용 시 테이블 자체가 타겟은 아니더라도, 
                    // 테이블이 포함된 라인 전체를 새로 그릴 때 테이블 DOM을 보존해야 합니다.
                    const tablePool = lineEl ? Array.from(lineEl.querySelectorAll('.chunk-table')) : null;

                    // 💡 세 번째 인자로 activeKey, 네 번째 인자로 tablePool 전달
                    uiAPI.renderLine(lineIndex, lineData, update.key, tablePool);
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
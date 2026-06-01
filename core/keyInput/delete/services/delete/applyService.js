import { normalizeCursorData } from '../../../../../utils/cursorUtils.js';

/**
 * [Step 4] UI 및 에디터 상태 반영
 */
export function applyDeleteResult(activeKey, result, { stateAPI, uiAPI, selectionAPI }) {
    const { newState, newPos, deletedLineIndex, updatedLineIndex } = result;

    // 1. 상태 저장
    stateAPI.save(activeKey, newState);

    const container = document.getElementById(activeKey);
    if (!container) return;

    // 2. 테이블 Pool 확보 및 DOM 탐색 최소화
    let movingTablePool = [];
    
    if (updatedLineIndex !== null && updatedLineIndex !== undefined) {
        const currentLineEl = container.children[updatedLineIndex];
        if (currentLineEl) {
            movingTablePool.push(...currentLineEl.getElementsByClassName('chunk-table'));
        }
    }

    if (deletedLineIndex !== null && deletedLineIndex !== undefined) {
        const startIdx = typeof deletedLineIndex === 'object' ? deletedLineIndex.start : deletedLineIndex;
        const count    = typeof deletedLineIndex === 'object' ? (deletedLineIndex.count || 1) : 1;

        for (let i = count - 1; i >= 0; i--) {
            const targetIdx = startIdx + i;
            const lineToDeleteEl = container.children[targetIdx];

            if (lineToDeleteEl) {
                movingTablePool.push(...lineToDeleteEl.getElementsByClassName('chunk-table'));
                uiAPI.removeLine(targetIdx, activeKey);
            }
        }
    }

    // 3. 병합된 줄 리렌더링 (Pool 주입)
    if (updatedLineIndex !== null && newState[updatedLineIndex]) {
        uiAPI.renderLine(updatedLineIndex, newState[updatedLineIndex], {
            key : activeKey,
            pool: movingTablePool
        });
    }

    // 4. 공통 마무리
    uiAPI.ensureFirstLine(activeKey);
    
    const finalPos = normalizeCursorData({ ...newPos, containerId: activeKey }, activeKey);
    if (finalPos) {
        stateAPI.saveCursor(finalPos);
        selectionAPI.restoreCursor(finalPos);
    }

    movingTablePool.length = 0;
}
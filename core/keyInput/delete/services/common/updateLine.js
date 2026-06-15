// /core/keyInput/services/common/updateLine.js

import { normalizeCursorData } from '../../../../../utils/cursorUtils.js';

/**
 * [Step 4] UI 및 에디터 상태 반영
 */
export function updateLine(activeKey, result, { stateAPI, uiAPI, selectionAPI }) {
    const { newState, newPos, deletedLineIndex, updatedLineIndex } = result;

    // 1. 상태 저장
    stateAPI.save(activeKey, newState);

    const container = document.getElementById(activeKey);
    if (!container) return;

    let movingTablePool = [];

    // 2. 업데이트될 라인에서 미리 테이블 수거 (Delete 대응)
    if (updatedLineIndex !== null && updatedLineIndex !== undefined) {
        const currentLineEl = container.children[updatedLineIndex];
        if (currentLineEl) {
            movingTablePool.push(...currentLineEl.getElementsByClassName('chunk-table'));
        }
    }

    // 3. 라인 삭제 및 테이블 수거 (뒤에서부터 삭제)
    if (deletedLineIndex !== null && deletedLineIndex !== undefined) {
        const startIdx = typeof deletedLineIndex === 'object' ? deletedLineIndex.start : deletedLineIndex;
        const count    = typeof deletedLineIndex === 'object' ? (deletedLineIndex.count || 1) : 1;

        for (let i = count - 1; i >= 0; i--) {
            const targetIdx = startIdx + i;
            const lineEl = container.children[targetIdx];

            if (lineEl) {
                const tables = Array.from(lineEl.getElementsByClassName('chunk-table'));
                if (tables.length > 0) movingTablePool.push(...tables);

                uiAPI.removeLine(targetIdx, activeKey);
            }
        }
    }

    // 4. 라인 업데이트 (최적화 버전 적용)
    if (updatedLineIndex !== null && newState[updatedLineIndex]) {
        const targetElement = container.children[updatedLineIndex];
        uiAPI.renderLine(updatedLineIndex, newState[updatedLineIndex], {
            key          : activeKey,
            targetElement: targetElement, 
            pool         : movingTablePool
        });
    }

    // 5. 공통 마무리
    uiAPI.ensureFirstLine(activeKey);
    
    const finalPos = normalizeCursorData({ ...newPos, containerId: activeKey }, activeKey);
    if (finalPos) {
        stateAPI.saveCursor(finalPos);
        selectionAPI.restoreCursor(finalPos);
    }

    movingTablePool.length = 0;
}
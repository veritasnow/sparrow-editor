// /core/keyInput/services/backspace/backspaceListService.js

import { normalizeCursorData } from '../../../../../utils/cursorUtils.js';

export function removeList(e, { stateAPI, uiAPI, selectionAPI }, currentState, activeKey, container) {

    // 1. 기본 검사 (✅ 수정된 부분)
    const rawText = (currentState[0]?.chunks || [])
        .filter(chunk => chunk.type === 'text')
        .map(chunk => chunk.text || '')
        .join('');

    // zero-width 문자 제거
    const cleanedText = rawText.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
    const lineLen     = cleanedText.length;
    const isEmptyLine = lineLen === 0;

    if (!isEmptyLine) {
        return false; // 삭제 조건이 아니면 false 반환
    }

    // 2. 테이블 Pool 수거
    const movingTablePool = [];
    const tables = Array.from(container.getElementsByClassName('chunk-table'));
    if (tables.length > 0) {
        movingTablePool.push(...tables);
    }

    const lineIndexInParent = parseInt(container.getAttribute('data-line-index'));
    const parentKey         = selectionAPI.getMainKey();

    // 3. 데이터 처리
    stateAPI.deleteLine(lineIndexInParent, parentKey, { saveHistory: false });
    stateAPI.delete(activeKey, { saveHistory: true });

    // 4. DOM 처리
    uiAPI.removeLine(lineIndexInParent, parentKey);

    // 5. 리렌더링
    const mainEditor         = document.getElementById(parentKey);
    const updatedParentState = stateAPI.get(parentKey);

    if (mainEditor) {
        Array.from(mainEditor.children).forEach((child, idx) => {
            child.setAttribute('data-line-index', idx);
            if (idx === lineIndexInParent && updatedParentState[idx]) {
                uiAPI.renderLine(idx, updatedParentState[idx], {
                    key: parentKey,
                    targetElement: child,
                    pool: movingTablePool
                });
            }
        });
    }

    // 6. 커서 복구 위치 계산
    let targetPos;

    if (updatedParentState[lineIndexInParent]) {
        targetPos = { lineIndex: lineIndexInParent, offset: 0 };
    } else {
        const prevIdx     = Math.max(0, lineIndexInParent - 1);
        const prevLine    = updatedParentState[prevIdx];
        const prevRawText = (prevLine?.chunks || [])
            .filter(c => c.type === 'text')
            .map(c => c.text || '')
            .join('')
            .replace(/[\u200B\u200C\u200D\uFEFF]/g, '');

        targetPos = {
            lineIndex: prevIdx,
            offset: prevRawText.length
        };
    }

    // 7. 마무리
    uiAPI.ensureFirstLine(parentKey);
    const finalPos = normalizeCursorData(
        { ...targetPos, containerId: parentKey },
        parentKey
    );

    selectionAPI.refreshActiveKeys();
    if (finalPos) {
        stateAPI.saveCursor(finalPos);
        selectionAPI.restoreCursor(finalPos);
    }

    movingTablePool.length = 0;
    e.preventDefault();
    return true;
}
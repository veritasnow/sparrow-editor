// /core/keyInput/services/backspace/backspaceApplyService.js

import { normalizeCursorData } from '../../../../../utils/cursorUtils.js';

export function applyBackspaceLineResult(activeKey, result, { stateAPI, uiAPI, selectionAPI }) {
    const { 
        newState,       // 메인 에디터의 새 상태 (라인이 하나 삭제된 상태)
        nextLineState,  // 리스트의 새 상태 (마지막 LI에 텍스트가 추가된 상태)
        newPos, 
        deletedLineIndex, 
        lineActiveKey   
    } = result;

    // 1. [데이터 저장] 두 컨테이너의 상태를 각각 저장
    stateAPI.save(activeKey, newState);
    stateAPI.save(lineActiveKey, nextLineState);

    const mainContainer = document.getElementById(activeKey);
    const listContainer = document.getElementById(lineActiveKey);
    if (!mainContainer || !listContainer) return;

    let movingTablePool = [];

    // 2. [라인 삭제] 메인 에디터에서 리스트 뒤에 붙어버린 그 라인을 DOM에서 제거
    if (deletedLineIndex !== null) {
        const lineEl = mainContainer.children[deletedLineIndex];
        if (lineEl) {
            // 삭제 전 테이블 수거 (리스트 마지막 LI로 옮겨주기 위함)
            const tables = Array.from(lineEl.getElementsByClassName('chunk-table'));
            if (tables.length > 0) movingTablePool.push(...tables);
            
            uiAPI.removeLine(deletedLineIndex, activeKey);
        }
    }

    // 3. [리스트 렌더링] 데이터가 합쳐진 리스트의 마지막 LI를 다시 그림
    const lastLiIndex = nextLineState.length - 1;
    const targetLi = listContainer.children[lastLiIndex];
    
    uiAPI.renderLine(lastLiIndex, nextLineState[lastLiIndex], {
        key: lineActiveKey,
        targetElement: targetLi, // 기존 마지막 LI 교체
        pool: movingTablePool    // 수거한 테이블 주입
    });

    // 4. [메인 인덱스 동기화] 라인이 삭제되었으므로 뒤따르는 라인들의 data-index 갱신
    Array.from(mainContainer.children).forEach((child, idx) => {
        child.setAttribute('data-line-index', idx);
    });

    // 5. [커서 복구] 이제 커서는 메인이 아니라 '리스트 내부'로 들어가야 함
    // newPos에 containerId를 리스트 키로 명시해줘야 합니다.
    const finalPos = normalizeCursorData({ 
        ...newPos, 
        lineIndex: lastLiIndex, // 리스트의 마지막 줄
        containerId: lineActiveKey 
    }, lineActiveKey);

    if (finalPos) {
        stateAPI.saveCursor(finalPos);
        selectionAPI.refreshActiveKeys(); // 활성 키를 리스트로 전환
        selectionAPI.restoreCursor(finalPos);
    }

    movingTablePool.length = 0;
}
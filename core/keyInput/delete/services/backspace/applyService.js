// /core/keyInput/services/backspace/backspaceApplyService.js

import { normalizeCursorData } from '../../../../../utils/cursorUtils.js';

/**
 * [Step 4] UI 및 에디터 상태 반영 (최적화 버전)
 */
export function applyBackspaceResult(activeKey, result, { stateAPI, uiAPI, selectionAPI }) {
    const { newState, newPos, deletedLineIndex, updatedLineIndex } = result;

    // 1. 상태 저장
    stateAPI.save(activeKey, newState);

    const container = document.getElementById(activeKey);
    if (!container) return;

    let movingTablePool = [];
    
    // 2. [라인 삭제] 해당 인덱스의 줄(LI 또는 P)을 DOM에서 제거
    if (deletedLineIndex !== null && deletedLineIndex !== undefined) {
        const startIdx = typeof deletedLineIndex === 'object' ? deletedLineIndex.start : deletedLineIndex;
        const count    = typeof deletedLineIndex === 'object' ? (deletedLineIndex.count || 1) : 1;

        // 🔥 뒤에서부터 삭제
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

    // 3. [라인 업데이트] 업데이트된 데이터를 기반으로 다시 렌더링
    if (updatedLineIndex !== null && newState[updatedLineIndex]) {
        // 기존 엘리먼트 찾기
        const targetElement = container.children[updatedLineIndex];
        // ✅ 줄 병합 등 구조 변경 시: uiAPI.renderLine이 
        // activeKey가 리스트면 <li>를, 아니면 <p>를 생성하도록 설계되어 있어야 함
        uiAPI.renderLine(updatedLineIndex, newState[updatedLineIndex], {
            key          : activeKey,
            targetElement: targetElement, // 기존 줄이 있으면 교체, 없으면 삽입
            pool         : movingTablePool
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

export function applyBackspaceLineResult(activeKey, result, { stateAPI, uiAPI, selectionAPI }) {
    const { 
        newState,       // 메인 에디터의 새 상태 (라인이 하나 삭제된 상태)
        nextLineState,  // 리스트의 새 상태 (마지막 LI에 텍스트가 추가된 상태)
        newPos, 
        deletedLineIndex, 
        lineActiveKey   // 업데이트될 리스트의 ID (예: 'list-123')
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
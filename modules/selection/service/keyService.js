/**
 * 활성 컨테이너(ID) 추출 및 분석 서비스
 */
export function createKeyService(root) {
    
    /**
     * 1. 실제로 콘텐츠가 선택된 모든 컨테이너 ID 반환
     */ 
    function syncActiveKeys(lastActiveKey) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return [lastActiveKey].filter(Boolean);

        const ids = new Set();

        // 1. UI 기반 선택된 셀 수집 (순수하게 선택된 하위 셀들)
        const selectedCells = document.querySelectorAll('.se-table-cell.is-selected:not(.is-not-selected)');
        selectedCells.forEach(el => {
            const id = el.getAttribute('data-container-id');
            if (id) ids.add(id);
        });

        // 2. 브라우저 Selection 범위 기준 상위 컨테이너 추적
        for (let i = 0; i < sel.rangeCount; i++) {
            const range = sel.getRangeAt(i);
            let ancestor = range.commonAncestorContainer;
            if (ancestor.nodeType === Node.TEXT_NODE) ancestor = ancestor.parentElement;

            // 기존 로직: 현재 선택 영역을 감싸고 있는 가장 가까운 상위 컨테이너 추적
            const mainContainer = ancestor.closest('[data-container-id]:not(.is-not-selected)');
            
            if (mainContainer) {
                const id = mainContainer.getAttribute('data-container-id');
                if (id) ids.add(id);
            }

            // 🔥 [리스트 전용 추가 로직] 드래그의 시작점과 끝점이 리스트 아이템인지 직접 계산
            const startEl = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer;
            const endEl   = range.endContainer.nodeType   === Node.TEXT_NODE ? range.endContainer.parentElement   : range.endContainer;

            // 시작점이나 끝점이 리스트(.se-list-item) 내부에 있다면 해당 리스트의 ID를 강제 수집
            const startList = startEl?.closest('.se-list-item[data-container-id]');
            const endList   = endEl?.closest('.se-list-item[data-container-id]');

            if (startList) {
                const id = startList.getAttribute('data-container-id');
                if (id) ids.add(id);
            }
            if (endList) {
                const id = endList.getAttribute('data-container-id');
                if (id) ids.add(id);
            }
        }

        // 3. 드래그 중인 부모 셀 강제 포함 (is-dragging)
        const draggingContainers = document.querySelectorAll('.se-table-cell.is-dragging, .sparrow-contents.is-dragging');
        draggingContainers.forEach(el => {
            const id = el.getAttribute('data-container-id');
            if (id) ids.add(id);
        });

        const result = Array.from(ids);
        return result.length > 0 ? result : [lastActiveKey].filter(Boolean);
    }

    /*
    function syncActiveKeys(lastActiveKey) {
        const sel = window.getSelection();
        console.log('syncActiveKeys called. Selection:', sel);
        if (!sel || sel.rangeCount === 0) return [lastActiveKey].filter(Boolean);

        const ids = new Set();

        // 1. UI 기반 선택된 셀 수집 (순수하게 선택된 하위 셀들)
        const selectedCells = document.querySelectorAll('.se-table-cell.is-selected:not(.is-not-selected)');
        selectedCells.forEach(el => {
            const id = el.getAttribute('data-container-id');
            if (id) ids.add(id);
        });

        // 2. 브라우저 Selection 범위 기준 상위 컨테이너 추적
        for (let i = 0; i < sel.rangeCount; i++) {
            const range = sel.getRangeAt(i);
            let ancestor = range.commonAncestorContainer;
            if (ancestor.nodeType === Node.TEXT_NODE) ancestor = ancestor.parentElement;

            // 🔥 핵심 수정: 현재 선택 영역을 감싸고 있는 가장 가까운 컨테이너를 찾음
            // 'is-not-selected'가 아닌 모든 컨테이너를 찾습니다.
            const mainContainer = ancestor.closest('[data-container-id]:not(.is-not-selected)');
            console.log("mainContainer11111111111111111 ", mainContainer);
            
            if (mainContainer) {
                const id = mainContainer.getAttribute('data-container-id');
                if (id) ids.add(id);
            }
        }

        // 3. 드래그 중인 부모 셀 강제 포함 (is-dragging)
        // 질문하신 상황처럼 부모 셀 내부에서 드래그가 일어날 때 부모 ID가 누락되는 것을 방지
        const draggingContainers = document.querySelectorAll('.se-table-cell.is-dragging, .sparrow-contents.is-dragging');
        draggingContainers.forEach(el => {
            const id = el.getAttribute('data-container-id');
            if (id) ids.add(id);
        });

        const result = Array.from(ids);
        console.log('result result IDs:', result);
        return result.length > 0 ? result : [lastActiveKey].filter(Boolean);
    }
    */



    function findParentContainerId(containerId) {
        const currentEl = document.getElementById(containerId);
        if (!currentEl) return null;
        const parentContainer = currentEl.parentElement?.closest('[data-container-id]');
        return parentContainer ? parentContainer.getAttribute('data-container-id') : null;
    }    

    function getSelectedCellIdsByActive(activeContainer) {
        if (!activeContainer) return [];

        // 현재 컨테이너 기준 가장 가까운 테이블 영역 탐색
        const tableRoot =
            activeContainer.closest('.se-table') || activeContainer;

        const selectedCells = tableRoot.querySelectorAll(
            '.se-table-cell.is-selected'
        );

        const ids = [];
        for (let i = 0; i < selectedCells.length; i++) {
            const el = selectedCells[i];
            const id =
                el.getAttribute('data-container-id') ||
                el.id;

            if (id) ids.push(id);
        }

        return ids;
    }

    return { syncActiveKeys, findParentContainerId, getSelectedCellIdsByActive };
}
/**
 * 활성 컨테이너(ID) 추출 및 분석 서비스
 */
export function createKeyService(root) {
    
    /**
     * 1. 실제로 콘텐츠가 선택된 모든 컨테이너 ID 반환
     */ 
    function syncActiveKeys(lastActiveKey) {

        const sel = window.getSelection();
        console.log("syncActiveKeys called, selection: ", sel);
        console.log("syncActiveKeys called, lastActiveKey: ", lastActiveKey);

        if (!sel || sel.rangeCount === 0) {
            return [lastActiveKey].filter(Boolean);
        }

        const ids = new Set();

        // 1. 실제 선택된 셀
        const selectedCells = document.querySelectorAll(
            '.se-table-cell.is-selected'
        );

        selectedCells.forEach(el => {
            const id = el.getAttribute('data-container-id');
            if (id) ids.add(id);
        });

        // 2. anchor/focus 기준 컨테이너 추적
        [
            sel.anchorNode,
            sel.focusNode
        ].forEach(node => {

            if (!node) return;

            const el =
                node.nodeType === Node.TEXT_NODE
                    ? node.parentElement
                    : node;

            if (!el) return;

            const container = el.closest('[data-container-id]');

            if (!container) return;

            const isTableCell = container.classList.contains('se-table-cell');

            if (isTableCell) {

                const selectedCount = document.querySelectorAll('.se-table-cell.is-selected').length;

                // 멀티 셀 드래그 선택이면 무시
                if (selectedCount > 1) {
                    return;
                }
            }

            const id = container.getAttribute('data-container-id');

            if (id) ids.add(id);
        });

        const result = Array.from(ids);

        if (result.length > 0) {
            lastActiveKey = result[result.length - 1];
            return result;
        }

        return [lastActiveKey].filter(Boolean);
    }

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
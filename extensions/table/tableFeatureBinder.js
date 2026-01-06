// extensions/table/tableFeatureBinder.js
import { createTablePopupView } from './componets/tablePopupView.js';
import { createTableInsertService } from './service/tableInsertService.js';

export function bindTableButton(tableBtn, stateAPI, uiAPI, rootId) {
    const rootEl = document.getElementById(rootId);
    const toolbar = rootEl.querySelector('.toolbar');

    // 1. View & Service 초기화
    const { popup, grid, sizeText, open, close } 
        = createTablePopupView(rootEl, toolbar, tableBtn);
    const { insertTable } = createTableInsertService(stateAPI, uiAPI);

    let lastCursorPos = null;
    let hoverRows = 0;
    let hoverCols = 0;

    // 2. Event Handlers
    const updateSelection = (r, c) => {
        hoverRows = r;
        hoverCols = c;
        sizeText.textContent = `${r} x ${c}`;

        grid.querySelectorAll('.table-cell').forEach(cell => {
            const row = parseInt(cell.dataset.row, 10);
            const col = parseInt(cell.dataset.col, 10);
            cell.classList.toggle('selected', row <= r && col <= c);
        });
    };

    const onMouseOverCell = (e) => {
        const cell = e.target.closest('.table-cell');
        if (!cell) return;
        updateSelection(parseInt(cell.dataset.row, 10), parseInt(cell.dataset.col, 10));
    };

    const onClickCell = (e) => {
        e.stopPropagation();
        if (hoverRows > 0 && hoverCols > 0) {
            // lastCursorPos는 이미 onBtnClick 시점에 확보됨
            if (insertTable(hoverRows, hoverCols, lastCursorPos)) {
                close();
            }
        }
    };

    const onBtnClick = (e) => {
        e.stopPropagation();
        
        if (popup.style.display === 'block') {
            close();
        } else {
            // ✨ 핵심: 팝업 열기 전 현재 커서 위치를 확실히 캡처
            uiAPI.updateLastValidPosition(); 
            lastCursorPos = uiAPI.getSelectionPosition();
            open();
        }
    };

    const onDocumentClick = (e) => {
        if (!popup.contains(e.target) && e.target !== tableBtn) {
            close();
        }
    };

    // 3. Event Binding
    tableBtn.addEventListener('click', onBtnClick);
    grid.addEventListener('mouseover', onMouseOverCell);
    grid.addEventListener('click', onClickCell);
    document.addEventListener('click', onDocumentClick);

    // 4. ✨ 통합 Disposer (청소부)
    return function destroy() {
        console.log("[TableFeature] Cleaning up...");
        tableBtn.removeEventListener('click', onBtnClick);
        grid.removeEventListener('mouseover', onMouseOverCell);
        grid.removeEventListener('click', onClickCell);
        document.removeEventListener('click', onDocumentClick);

        if (popup && popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
    };
}
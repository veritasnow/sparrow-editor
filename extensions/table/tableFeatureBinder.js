// extensions/table/tableFeatureBinder.js
import { TablePopup } from './componets/TablePopup.js';
import { resizeAttach } from './service/resizeTable.js';
import { insertTable } from './service/insertTable.js';
import { TableCellToolbar } from './componets/TableCellToolbar.js';
import { tableToolbar } from './service/tableToolbar.js';
import { showTableCellToolbar } from './service/showTableCellToolbar.js';



export function bindTableButton(tableBtn, stateAPI, uiAPI, selectionAPI, rootId) {
    const rootEl  = document.getElementById(rootId);
    const toolbar = rootEl.querySelector('.sparrow-toolbar');

    /* ---------------- 리사이징 이벤트 위임 ---------------- */

    const onMouseOver = (e) => {
        const table = e.target.closest('.se-table');
        if (!table) return;

        resizeAttach(table, stateAPI);
    };

    rootEl.addEventListener('mouseover', onMouseOver);

    /* ---------------- 기존 로직 유지 ---------------- */


    // 1. View & Service 초기화
    const { popup, grid, sizeText, open, close } = TablePopup(rootEl, toolbar, tableBtn);
    const tableToolbarService = tableToolbar(
        stateAPI,
        uiAPI,
        selectionAPI
    );

    const cellToolbar = TableCellToolbar(rootEl, {
        "add-row"    : tableToolbarService.addRow,
        "add-col"    : tableToolbarService.addCol,
        "merge"      : tableToolbarService.mergeCells,
        "delete"     : tableToolbarService.deleteTable,
        "delete-row" : tableToolbarService.deleteRow,
        "delete-col" : tableToolbarService.deleteCol,

    });

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
            if (insertTable(hoverRows, hoverCols, lastCursorPos, { stateAPI, uiAPI, selectionAPI })) {
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
            selectionAPI.updateLastValidPosition(); 
            lastCursorPos = selectionAPI.getSelectionPosition();
            open();
        }
    };

    const onDocumentClick = (e) => {
        if (!popup.contains(e.target) && e.target !== tableBtn) {
            close();
        }
    };

    const handleTableClick = (cellEl) => {
        showTableCellToolbar(rootEl, cellEl, cellToolbar);
    };

    const hideCellToolbar = () => {
        cellToolbar.style.display = 'none';
        cellToolbar.classList.remove("active");        
    };

    // 에디터 본문 내 테이블 클릭 감지
    const onContentClick = (e) => {
        const cell = e.target.closest('.se-table-cell');
        
        if (cell) {
            handleTableClick(cell);
        } else if (!cellToolbar.contains(e.target)) {
            hideCellToolbar();
        }
    };

    const onToolbarAction = (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const action = btn.dataset.action;
        const tableId = cellToolbar.dataset.targetTableId;
        
        console.log(`실행: ${action}, 대상: ${tableId}`);
        // TODO: action에 따른 service 로직 실행
    };
    // ---------------------------------



    // 3. Event Binding
    tableBtn.addEventListener('click', onBtnClick);
    grid.addEventListener('mouseover', onMouseOverCell);
    grid.addEventListener('click', onClickCell);
    document.addEventListener('click', onDocumentClick);

    // 🆕 신규 이벤트 추가
    rootEl.addEventListener('mousedown', onContentClick);
    cellToolbar.addEventListener('click', onToolbarAction);    

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

        cellToolbar.removeEventListener('click', onToolbarAction);
        if (cellToolbar.parentNode) cellToolbar.parentNode.removeChild(cellToolbar);        
    };
}
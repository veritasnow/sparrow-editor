// extensions/table/tableFeatureBinder.js
import { createTablePopupView } from './componets/tablePopupView.js';
import { createTableInsertService } from './service/tableInsertService.js';

export function bindTableButton(tableBtn, stateAPI, uiAPI, rootId) {
    const rootEl = document.getElementById(rootId);
    const toolbar = rootEl.querySelector('.toolbar');

    const { popup, grid, sizeText, open, close }
        = createTablePopupView(rootEl, toolbar, tableBtn);
    const { insertTable } = createTableInsertService(stateAPI, uiAPI);

    let lastCursorPos = null;
    let hoverRows = 0;
    let hoverCols = 0;

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

    const onClickCell = () => {
        if (insertTable(hoverRows, hoverCols, lastCursorPos)) {
            close();
        }
    };

    const onBtnClick = (e) => {
        e.stopPropagation();
        lastCursorPos = uiAPI.getSelectionPosition();
        popup.style.display === 'block' ? close() : open();
    };

    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && e.target !== tableBtn) {
            close();
        }
    });

    tableBtn.addEventListener('click', onBtnClick);
    grid.addEventListener('mouseover', onMouseOverCell);
    grid.addEventListener('click', onClickCell);
}

// extensions/table/componets/tablePopupView.js

export function createTablePopupView(rootEl, toolbar, tableBtn) {
    let popup = rootEl.querySelector('.table-input-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.className = 'table-input-popup';
        popup.innerHTML = `
            <div class="table-grid"></div>
            <div class="table-size-text">0 x 0</div>
        `;
        toolbar.appendChild(popup);

        const grid = popup.querySelector('.table-grid');

        // 10 x 10 grid 만들기
        for (let r = 1; r <= 10; r++) {
            for (let c = 1; c <= 10; c++) {
                const cell = document.createElement('div');
                cell.className = 'table-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                grid.appendChild(cell);
            }
        }
    }

    const grid       = popup.querySelector('.table-grid');
    const sizeText   = popup.querySelector('.table-size-text');

    const open = () => {
        popup.style.display = 'block';
        const rect = tableBtn.getBoundingClientRect();
        const toolbarRect = toolbar.getBoundingClientRect();
        popup.style.top = `${rect.bottom - toolbarRect.top + 6}px`;
        popup.style.left = `${rect.left - toolbarRect.left}px`;
    };

    const close = () => {
        popup.style.display = 'none';
    };

    return {
        popup,
        grid,
        sizeText,
        open,
        close
    };
}

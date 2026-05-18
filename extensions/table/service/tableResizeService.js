export function createTableResizeService({ stateAPI }) {

    function attach(tableEl) {
        if (!tableEl) return;

        tableEl.style.tableLayout = "fixed";

        if (!tableEl.style.width || tableEl.style.width === "100%") {
            tableEl.style.width = tableEl.offsetWidth + "px";
        }

        ensureColGroup(tableEl);

        tableEl.querySelectorAll('.se-table-cell').forEach(td => {
            if (td.querySelector('.table-resizer')) return;

            const resizer = createResizer(td);
            td.appendChild(resizer);
        });
    }

    function ensureColGroup(table) {
        let colgroup = table.querySelector("colgroup");
        if (colgroup) return;

        const firstRow = table.querySelector("tr");
        if (!firstRow) return;

        colgroup = document.createElement("colgroup");

        const cols = firstRow.children.length;

        for (let i = 0; i < cols; i++) {
            const col = document.createElement("col");
            col.style.width = firstRow.children[i].offsetWidth + "px";
            colgroup.appendChild(col);
        }

        table.prepend(colgroup);
    }

    function createResizer(td) {
        const el = document.createElement("div");

        el.className = "table-resizer";
        el.setAttribute("contenteditable", "false");

        Object.assign(el.style, {
            position  : "absolute",
            right     : "0",
            top       : "0",
            width     : "8px",
            height    : "100%",
            cursor    : "col-resize",
            zIndex    : "100",
            background: "transparent",
            userSelect: "none"
        });

        el.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            startResize(e, td);
        });

        return el;
    }

    function startResize(e, td) {
        const table = td.closest("table");

        const startCol = Number(td.dataset.col);
        const span = td.colSpan || 1;

        // 🔥 병합 대응: "오른쪽 끝 컬럼"
        const colIndex = startCol + span - 1;

        const colgroup = table.querySelector("colgroup");
        const col = colgroup.children[colIndex];
        const nextCol = colgroup.children[colIndex + 1];

        if (!nextCol) return;

        const startX = e.pageX;
        const startWidth = col.offsetWidth;
        const nextStartWidth = nextCol.offsetWidth;

        const onMouseMove = (moveEvent) => {
            const diff = moveEvent.pageX - startX;

            const newWidth = Math.max(40, startWidth + diff);
            const newNextWidth = Math.max(40, nextStartWidth - diff);

            if (newNextWidth <= 40) return;

            col.style.width = newWidth + "px";
            nextCol.style.width = newNextWidth + "px";
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.userSelect = "";

            updateStateByCol(table, colIndex, col.offsetWidth);
        };

        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }    
    /*
    function startResize(e, td) {
        const table = td.closest("table");
        const colIndex = Number(td.dataset.col);

        const colgroup = table.querySelector("colgroup");
        const col = colgroup.children[colIndex];
        const nextCol = colgroup.children[colIndex + 1];

        // 👉 마지막 컬럼이면 종료
        if (!nextCol) return;

        const startX = e.pageX;
        const startWidth = col.offsetWidth;
        const nextStartWidth = nextCol.offsetWidth;

        const onMouseMove = (moveEvent) => {
            const diff = moveEvent.pageX - startX;

            const newWidth = Math.max(40, startWidth + diff);
            const newNextWidth = Math.max(40, nextStartWidth - diff);

            if (newNextWidth <= 40) return;

            // 🔥 핵심: col 기준으로 변경
            col.style.width = newWidth + "px";
            nextCol.style.width = newNextWidth + "px";
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.userSelect = "";

            updateStateByCol(table, colIndex, col.offsetWidth);
        };

        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }
    */

    // 🔥 핵심: td 기준 ❌ → col 기준으로 저장
    function updateStateByCol(table, colIndex, width) {
        const tableId = table.id;

        const rootState = stateAPI.get();
        if (!Array.isArray(rootState)) return;

        const line = rootState.find(line =>
            line.chunks?.some(c => c.type === 'table' && c.tableId === tableId)
        );

        if (!line) return;

        const tableChunk = line.chunks.find(c => c.tableId === tableId);
        if (!tableChunk) return;

        // 👉 모든 row에 대해 colIndex 기준으로 width 반영
        tableChunk.data.forEach(row => {
            let currentCol = 0;

            for (let i = 0; i < row.length; i++) {
                const cell = row[i];
                if (!cell) continue;

                const span = cell.colspan || 1;

                // 🔥 병합 셀 포함 계산
                if (currentCol <= colIndex && colIndex < currentCol + span) {
                    if (!cell.style) cell.style = {};
                    cell.style.width = width + "px";
                    break;
                }

                currentCol += span;
            }
        });

        stateAPI.save(tableId, rootState);
    }

    return {
        attach
    };
}
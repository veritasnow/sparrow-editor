// extensions/table/service/tableResizeService.js

export function createTableResizeService({ stateAPI }) {

    function attach(tableEl) {
        if (!tableEl) return;

        // ✅ table-layout 고정
        tableEl.style.tableLayout = "fixed";

        // ✅ width를 px로 고정 (최초 1회만)
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
        const startX = e.pageX;

        const tr = td.parentElement;
        const tdIndex = Array.from(tr.children).indexOf(td);

        const nextTd = tr.children[tdIndex + 1];

        // 👉 오른쪽 셀 없으면 종료
        if (!nextTd) return;

        const startWidth     = td.offsetWidth;
        const nextStartWidth = nextTd.offsetWidth;

        const onMouseMove = (moveEvent) => {
            const diff = moveEvent.pageX - startX;

            const newWidth     = Math.max(40, startWidth + diff);
            const newNextWidth = Math.max(40, nextStartWidth - diff);

            if (newNextWidth <= 40) return;

            td.style.width     = newWidth + "px";
            nextTd.style.width = newNextWidth + "px";
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.userSelect = "";

            updateStateByTd(td, nextTd);
        };

        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }
    /*
    function startResize(e, td) {
        const startX    = e.pageX;
        const table     = td.closest("table");
        const colIndex  = Number(td.dataset.col);

        const colgroup  = table.querySelector("colgroup");
        const col       = colgroup.children[colIndex];
        const nextCol   = colgroup.children[colIndex + 1];

        // ✅ 마지막 컬럼은 resize 막기 (선택)
        if (!nextCol) return;

        const startWidth      = col.offsetWidth;
        const nextStartWidth  = nextCol.offsetWidth;

        const onMouseMove = (moveEvent) => {
            const diff = moveEvent.pageX - startX;

            const newWidth     = Math.max(40, startWidth + diff);
            const newNextWidth = Math.max(40, nextStartWidth - diff);

            // ✅ 다음 컬럼이 최소보다 작아지면 막기
            if (newNextWidth <= 40) return;

            col.style.width      = newWidth + "px";
            nextCol.style.width  = newNextWidth + "px";
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.userSelect = "";

            updateState(table, colIndex, col.offsetWidth);
        };

        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }
    */

    function updateState(table, colIndex, width) {
        const tableId = table.id;

        const rootState = stateAPI.get();
        if (!Array.isArray(rootState)) return;

        const line = rootState.find(line =>
            line.chunks?.some(c => c.type === 'table' && c.tableId === tableId)
        );

        if (!line) return;

        const tableChunk = line.chunks.find(c => c.tableId === tableId);
        if (!tableChunk) return;

        tableChunk.data.forEach(row => {
            const cell = row[colIndex];
            if (!cell) return;

            if (!cell.style) cell.style = {};
            cell.style.width = width + "px";
        });

        stateAPI.save(undefined, rootState);
    }

    return {
        attach
    };
}
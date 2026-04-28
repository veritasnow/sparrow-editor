// extensions/table/service/tableResizeService.js

export function createTableResizeService({ stateAPI }) {

    function attach(tableEl) {
        if (!tableEl) return;

        tableEl.querySelectorAll('.se-table-cell').forEach(td => {
            if (td.querySelector('.table-resizer')) return;

            const resizer = createResizer(td);
            td.appendChild(resizer);
        });
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
        const startX     = e.pageX;
        const startWidth = td.offsetWidth;

        const table = td.closest("table");
        const colIndex = Number(td.dataset.col);

        const onMouseMove = (moveEvent) => {
            const diff  = moveEvent.pageX - startX;
            const width = Math.max(40, startWidth + diff);

            // 🔥 컬럼 전체 적용
            applyColumnWidth(table, colIndex, width);
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.userSelect = "";

            updateState(table, colIndex);
        };

        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }

    function applyColumnWidth(table, colIndex, width) {
        table.querySelectorAll(`td[data-col="${colIndex}"]`).forEach(td => {
            td.style.width = width + "px";
        });
    }

    function updateState(table, colIndex) {
        const tableId = table.id;

        // ✅ 전체 root state 가져오기
        const rootState = stateAPI.get();

        if (!Array.isArray(rootState)) return;

        // ✅ table chunk 찾기
        const line = rootState.find(line =>
            line.chunks?.some(c => c.type === 'table' && c.tableId === tableId)
        );

        if (!line) return;

        const tableChunk = line.chunks.find(c => c.tableId === tableId);
        if (!tableChunk) return;

        // ✅ 현재 width
        const width = table.querySelector(`td[data-col="${colIndex}"]`)?.offsetWidth;
        if (!width) return;

        // ✅ column 전체 반영
        tableChunk.data.forEach(row => {
            const cell = row[colIndex];
            if (!cell) return;

            if (!cell.style) cell.style = {};
            cell.style.width = width + "px";
        });

        // ✅ 전체 state 저장 (중요)
        stateAPI.save(undefined, rootState);
    }    
    /*
    function updateState(table, colIndex) {
        const tableId = table.id;
        const tableState = stateAPI.get(tableId);

        if (!Array.isArray(tableState)) return;

        const width = table.querySelector(`td[data-col="${colIndex}"]`)?.offsetWidth;

        tableState.forEach(row => {
            const cell = row[colIndex];
            if (!cell) return;

            if (!cell.style) cell.style = {};
            cell.style.width = width + "px";
        });

        stateAPI.save(tableId, tableState);
    }
    */

    return {
        attach
    };
}
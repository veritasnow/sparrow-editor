export const tableRenderer = {
    render(chunk, lineIndex, chunkIndex) {
        const data = chunk.data ?? [];
        const rows = data.length;
        const cols = data[0]?.length ?? 0;

        const table = document.createElement("table");
        table.id                 = chunk.tableId;
        table.className          = "se-table chunk-table";
        table.dataset.lineIndex  = lineIndex;
        table.dataset.chunkIndex = chunkIndex;
        table.dataset.type       = "table";
        table.dataset.index      = chunkIndex;
        table.dataset.hasResizer = "true";

        Object.assign(table.style, {
            borderCollapse: "collapse",
            border        : "1px solid #ccc",
            margin        : "4px 0",
            fontSize      : "14px",
            width         : "100%",
            tableLayout   : "fixed",
            boxSizing     : "border-box",
            ...(chunk.style || {})
        });

        for (let r = 0; r < rows; r++) {
            const tr = document.createElement("tr");
            for (let c = 0; c < cols; c++) {
                const cellData = data[r]?.[c];
                if (!cellData) continue;

                const td = document.createElement("td");
                if (cellData.id) {
                    td.id = cellData.id;
                    td.setAttribute("data-container-id", cellData.id);
                }

                td.className      = "se-table-cell";
                td.dataset.row    = r;
                td.dataset.col    = c;
                td.style.position = "relative"; 

                const rowspan = cellData.rowspan ?? 1;
                const colspan = cellData.colspan ?? 1;
                if (rowspan > 1) td.rowSpan = rowspan;
                if (colspan > 1) td.colSpan = colspan;

                Object.assign(td.style, {
                    border       : "1px solid #ddd",
                    padding      : "4px 6px",
                    minWidth     : "40px",
                    height       : "24px",
                    verticalAlign: "middle",
                    boxSizing    : "border-box",
                    ...(cellData.style || {})
                });

                tr.appendChild(td);
            }
            table.appendChild(tr);
        }

        // 렌더링 직후 배치
        this._ensureResizers(table);
        return table;
    },

    _ensureResizers(table) {
        if (!table.isConnected) return;
        table.querySelectorAll('.se-table-cell').forEach(td => {
            if (!td.querySelector('.table-resizer')) {
                this._addResizerToTd(td);
            }
        });
    },

    _addResizerToTd(td) {
        const resizer = document.createElement("div");
        resizer.className = "table-resizer";
        resizer.setAttribute("contenteditable", "false");
        
        Object.assign(resizer.style, {
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

        resizer.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._initiateResize(e, td);
        });

        td.appendChild(resizer);
    },

    _initiateResize(e, td) {
        const startX     = e.pageX;
        const startWidth = td.offsetWidth;

        const onMouseMove = (moveEvent) => {
            const diff = moveEvent.pageX - startX;
            td.style.width = `${Math.max(40, startWidth + diff)}px`;
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.userSelect = "";
        };

        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }
};
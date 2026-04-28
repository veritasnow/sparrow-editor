// extensions/table/components/tableRenderer.js
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

        /* =========================
         * 🔥 핵심: colgroup 추가
         * ========================= */
        const colgroup = document.createElement("colgroup");

        for (let c = 0; c < cols; c++) {
            const col = document.createElement("col");

            // 👉 첫 번째 row 기준으로 width 가져오기
            let width;

            for (let r = 0; r < rows; r++) {
                const cell = data[r]?.[c];
                if (cell?.style?.width) {
                    width = cell.style.width;
                    break;
                }
            }

            if (width) {
                col.style.width = width;
            }

            colgroup.appendChild(col);
        }

        table.appendChild(colgroup);

        /* =========================
         * 기존 td 렌더링
         * ========================= */
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
                    boxSizing    : "border-box"
                    // ❗ width는 여기서 안 믿어도 됨 (colgroup이 담당)
                });

                tr.appendChild(td);
            }

            table.appendChild(tr);
        }

        return table;
    }
};
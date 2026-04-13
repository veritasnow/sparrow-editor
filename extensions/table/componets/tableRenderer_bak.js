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
            tableLayout   : "fixed", // ⭐ 병합 안정성 (중요)
            ...(chunk.style || {})
        });

        for (let r = 0; r < rows; r++) {
            const tr = document.createElement("tr");

            for (let c = 0; c < cols; c++) {
                const cellData = data[r]?.[c];

                // ⭐ 병합으로 제거된 셀은 절대 렌더하면 안됨
                if (!cellData) continue;

                const td = document.createElement("td");

                // 1️⃣ 셀 ID (selection / 재귀 editor 핵심)
                if (cellData.id) {
                    td.id = cellData.id;
                    td.setAttribute("data-container-id", cellData.id);
                }

                td.className = "se-table-cell";
                td.dataset.row = r;
                td.dataset.col = c;

                // 2️⃣ 병합 스팬 (핵심 로직)
                const rowspan = cellData.rowspan ?? 1;
                const colspan = cellData.colspan ?? 1;

                if (rowspan > 1) {
                    td.rowSpan = rowspan;
                }
                if (colspan > 1) {
                    td.colSpan = colspan;
                }

                // 3️⃣ 스타일
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

        return table;
    }
};
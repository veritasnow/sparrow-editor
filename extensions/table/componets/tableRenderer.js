// extensions/table/components/tableRenderer.js
export const tableRenderer = {
  render(chunk, lineIndex, chunkIndex) {
    const { rows = 2, cols = 2, data = [] } = chunk;

    const table              = document.createElement("table");
    table.className          = "se-table";
    table.dataset.lineIndex  = lineIndex;
    table.dataset.chunkIndex = chunkIndex;

    table.style.borderCollapse = "collapse";
    table.style.border         = "1px solid #ccc";
    table.style.margin         = "4px 0";
    table.style.fontSize       = "14px";

    for (let r = 0; r < rows; r++) {
      const tr = document.createElement("tr");

      for (let c = 0; c < cols; c++) {
        const td = document.createElement("td");
        td.className      = "se-table-cell";
        td.style.border   = "1px solid #ddd";
        td.style.padding  = "4px 6px";
        td.style.minWidth = "40px";
        td.style.height   = "24px";

        if (data[r] && data[r][c]) {
          td.textContent = data[r][c];
        } else {
          td.innerHTML   = "&nbsp;";
        }

        tr.appendChild(td);
      }

      table.appendChild(tr);
    }

    return table;
  }
};

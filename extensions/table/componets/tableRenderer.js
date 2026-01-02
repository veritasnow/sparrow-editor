// extensions/table/components/tableRenderer.js
export const tableRenderer = {
  render(chunk, lineIndex, chunkIndex) {
    const data = chunk.data ?? [];
    const rows = data.length;
    const cols = data[0]?.length ?? 0;

    const table              = document.createElement("table");
    table.className          = "se-table chunk-table";
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

        const cellValue = data[r]?.[c];
        td.innerHTML = cellValue && cellValue !== ""
          ? cellValue
          : "&nbsp;";

        tr.appendChild(td);
      }

      table.appendChild(tr);
    }

    return table;
  }
};
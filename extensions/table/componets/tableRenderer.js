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

    // 테이블 기본 스타일 적용
    table.style.borderCollapse = "collapse";
    table.style.border         = "1px solid #ccc";
    table.style.margin         = "4px 0";
    table.style.fontSize       = "14px";
    
    // 테이블 청크 자체에 저장된 스타일이 있다면 추가 적용 (전체 배경색 등)
    if (chunk.style) Object.assign(table.style, chunk.style);

    for (let r = 0; r < rows; r++) {
      const tr = document.createElement("tr");

      for (let c = 0; c < cols; c++) {
        const td = document.createElement("td");
        td.className      = "se-table-cell";
        td.style.border   = "1px solid #ddd";
        td.style.padding  = "4px 6px";
        td.style.minWidth = "40px";
        td.style.height   = "24px";

        const cell = data[r]?.[c];

        // 💡 [수정 포인트] cell이 객체 구조이므로 분기 처리
        if (cell && typeof cell === 'object') {
          // 1. 텍스트 노출 (비어있으면 &nbsp;)
          td.textContent = (cell.text && cell.text.trim() !== "") ? cell.text : "";
          if (td.textContent === "") td.innerHTML = "&nbsp;";

          // 2. 스타일 적용 (fontWeight: 'bold' 등)
          if (cell.style) {
            Object.assign(td.style, cell.style);
          }
        } else {
          // 하위 호환성 유지 (혹시 문자열 데이터가 들어올 경우)
          td.innerHTML = cell && cell !== "" ? cell : "&nbsp;";
        }

        tr.appendChild(td);
      }
      table.appendChild(tr);
    }

    return table;
  }
};
export const tableRenderer = {
  render(chunk, lineIndex, chunkIndex) {
    const data = chunk.data ?? [];
    const rows = data.length;
    const cols = data[0]?.length ?? 0;

    const table = document.createElement("table");
    table.className = "se-table chunk-table";
    table.dataset.lineIndex = lineIndex;
    table.dataset.chunkIndex = chunkIndex;

    // 테이블 기본 스타일링
    Object.assign(table.style, {
      borderCollapse: "collapse",
      border: "1px solid #ccc",
      margin: "4px 0",
      fontSize: "14px",
      width: "auto",
      ...(chunk.style || {})
    });

    for (let r = 0; r < rows; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c < cols; c++) {
        const td = document.createElement("td");
        td.className = "se-table-cell";
        
        // td 기본 스타일
        Object.assign(td.style, {
          border: "1px solid #ddd",
          padding: "4px 6px",
          minWidth: "40px",
          height: "24px",
          verticalAlign: "middle"
        });

        const cell = data[r]?.[c];

        if (cell && typeof cell === 'object') {
          // 1. 셀 배경색 등 스타일 적용
          if (cell.style) Object.assign(td.style, cell.style);

          // 2. 부분 스타일(chunks)이 있는 경우 span 생성
          if (Array.isArray(cell.chunks) && cell.chunks.length > 0) {
            cell.chunks.forEach(sub => {
              const span = document.createElement("span");
              span.textContent = sub.text;
              if (sub.style) {
                // 인라인 스타일 적용 (fontWeight, color 등)
                Object.assign(span.style, sub.style);
              }
              td.appendChild(span);
            });
          } 
          // 3. 부분 스타일이 없으면 일반 텍스트 출력
          else {
            td.textContent = (cell.text !== undefined && cell.text !== null) ? cell.text : "";
          }
          
          // 빈 셀 높이 유지를 위한 처리
          if (td.innerHTML === "") td.innerHTML = "&nbsp;";
        } else {
          // 문자열 형태의 하위 호환 데이터 처리
          td.innerHTML = cell || "&nbsp;";
        }
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    return table;
  }
};
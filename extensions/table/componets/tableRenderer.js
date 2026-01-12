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
        const cell = data[r]?.[c];

        // 💡 핵심: 셀의 고유 ID를 DOM id에 할당
        // 이 id가 나중에 getActiveKey()에 잡히는 타겟이 됩니다.
        if (cell && cell.id) {
            td.id = cell.id;
        }
        
        td.className = "se-table-cell";
        // 💡 편집 가능하도록 설정
        td.setAttribute("contenteditable", "true"); 
        
        // td 기본 스타일
        Object.assign(td.style, {
          border: "1px solid #ddd",
          padding: "4px 6px",
          minWidth: "40px",
          height: "24px",
          verticalAlign: "middle",
          ...(cell?.style || {})
        });

        /**
         * 💡 중요한 변화: 
         * 이제 테이블 렌더러는 셀 안의 내용을 직접 그리지 않습니다.
         * 셀 안의 내용은 별도의 독립된 State로 관리되기 때문입니다.
         * 만약 셀 안에 데이터가 있다면, 나중에 별도의 render 호출이 이뤄질 것입니다.
         */
        if (td.innerHTML === "") {
            td.innerHTML = "<p><br></p>"; // 빈 줄 하나 보장
        }

        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    return table;
  }
};
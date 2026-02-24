export const tableRenderer = {
    /**
     * @param {Object} chunk - 테이블 청크 모델 ({ type: 'table', data: [...], style: {...} })
     * @param {number} lineIndex - 본문에서의 라인 위치
     * @param {number} chunkIndex - 본문 라인 내에서의 청크 인덱스
     */
    render(chunk, lineIndex, chunkIndex) {
        console.log("옴뇸뇸");
        const data = chunk.data ?? [];
        const rows = data.length;
        const cols = data[0]?.length ?? 0;

        const table = document.createElement("table");
        table.id                 = chunk.tableId;;
        table.className          = "se-table chunk-table";
        table.dataset.lineIndex  = lineIndex;
        table.dataset.chunkIndex = chunkIndex;
        table.dataset.type       = "table"; // 청크 타입 명시
        table.dataset.index      = chunkIndex; // getSelectionContext가 인식할 인덱스

        // 1. 테이블 기본 스타일 설정
        Object.assign(table.style, {
            borderCollapse: "collapse",
            border        : "1px solid #ccc",
            margin        : "4px 0",
            fontSize      : "14px",
            width         : "100%", // 기본 너비 100% 권장
            ...(chunk.style || {})
        });

        for (let r = 0; r < rows; r++) {
            const tr = document.createElement("tr");
            for (let c = 0; c < cols; c++) {
                const td       = document.createElement("td");
                const cellData = data[r]?.[c];

                // 2. 셀 고유 ID 설정 (재귀 에디터의 Key가 됨)
                if (cellData && cellData.id) {
                    td.id = cellData.id;
                    td.setAttribute("data-container-id", cellData.id);
                }
                
                td.className = "se-table-cell";
                //td.setAttribute("contenteditable", "true"); 
                
                // 3. 셀 기본 스타일 설정
                Object.assign(td.style, {
                    border       : "1px solid #ddd",
                    padding      : "4px 6px",
                    minWidth     : "40px",
                    height       : "24px",
                    verticalAlign: "middle",
                    ...(cellData?.style || {})
                });

                const p = document.createElement("p");
                p.className         = "text-block"; // 본문 클래스와 통일
                p.dataset.lineIndex = "0"; // ✅ 핵심 추가

                const span = document.createElement("span");
                span.className      = "chunk-text";
                span.dataset.index  = "0"; // 텍스트 청크 인덱스 부여
                span.innerHTML      = "&#x200B;"; 
                span.style.fontSize = "14px";

                p.appendChild(span);
                td.appendChild(p);
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }
        
        return table;
    }
};
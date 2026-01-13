export const tableRenderer = {
    /**
     * @param {Object} chunk - 테이블 청크 모델 ({ type: 'table', data: [...], style: {...} })
     * @param {number} lineIndex - 본문에서의 라인 위치
     * @param {number} chunkIndex - 본문 라인 내에서의 청크 인덱스
     */
    render(chunk, lineIndex, chunkIndex) {
        const data = chunk.data ?? [];
        const rows = data.length;
        const cols = data[0]?.length ?? 0;

        const table = document.createElement("table");
        table.className = "se-table chunk-table";
        table.dataset.lineIndex = lineIndex;
        table.dataset.chunkIndex = chunkIndex;
        table.dataset.type = "table"; // 청크 타입 명시
        table.dataset.index = chunkIndex; // getSelectionContext가 인식할 인덱스

        // 1. 테이블 기본 스타일 설정
        Object.assign(table.style, {
            borderCollapse: "collapse",
            border: "1px solid #ccc",
            margin: "4px 0",
            fontSize: "14px",
            width: "100%", // 기본 너비 100% 권장
            ...(chunk.style || {})
        });

        for (let r = 0; r < rows; r++) {
            const tr = document.createElement("tr");
            for (let c = 0; c < cols; c++) {
                const td = document.createElement("td");
                const cellData = data[r]?.[c];

                // 2. 셀 고유 ID 설정 (재귀 에디터의 Key가 됨)
                if (cellData && cellData.id) {
                    td.id = cellData.id;
                }
                
                td.className = "se-table-cell";
                td.setAttribute("contenteditable", "true"); 
                
                // 3. 셀 기본 스타일 설정
                Object.assign(td.style, {
                    border: "1px solid #ddd",
                    padding: "4px 6px",
                    minWidth: "40px",
                    height: "24px",
                    verticalAlign: "middle",
                    ...(cellData?.style || {})
                });

                /**
                 * 4. 💡 핵심 개선: 셀 내부 초기 DOM 구조 강제화
                 * 본문 에디터의 초기 상태인 <p><span data-index="0"></span></p> 구조를 
                 * 미리 생성하여 getSelectionContext가 activeNode를 즉시 잡을 수 있게 합니다.
                 */
                const p = document.createElement("p");
                p.className = "text-block"; // 본문 클래스와 통일

                const span = document.createElement("span");
                span.className = "chunk-text";
                span.dataset.index = "0"; // 텍스트 청크 인덱스 부여
                
                // 제로 너비 공백(&ZeroWidthSpace;)을 넣어 빈 셀에서도 커서가 잡히도록 함
                span.innerHTML = "&#x200B;"; 
                
                // 기본 스타일 (필요시 cellData의 폰트 정보 반영)
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
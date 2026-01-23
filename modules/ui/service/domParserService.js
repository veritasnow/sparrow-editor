export function createDOMParseService() {
    
    /**
     * [최적화 포인트]
     * 1. Array.from 제거: childNodes를 직접 for-loop로 순회하여 메모리 할당 방지
     * 2. textBuffer 최적화: 텍스트 노드가 연속될 때만 결합
     * 3. dataset 직접 참조: parseInt와 dataset 접근 속도 개선
     */
    function parseLineDOM(lineEl, currentLineChunks, selectionContainer, cursorOffset, lineIndex) {
        const newChunks = [];
        let textBuffer = '';
        let restoreData = null;
        let hasTable = false;

        const children = lineEl.childNodes;
        const len = children.length;

        for (let i = 0; i < len; i++) {
            const node = children[i];

            if (node.nodeType === 3) { // Node.TEXT_NODE
                textBuffer += node.textContent;
                
                if (node === selectionContainer) {
                    restoreData = { 
                        lineIndex, 
                        chunkIndex: newChunks.length, 
                        offset: cursorOffset 
                    };
                }
            } else if (node.nodeType === 1) { // Node.ELEMENT_NODE
                if (textBuffer.length > 0) {
                    newChunks.push({ type: 'text', text: textBuffer, style: {} });
                    textBuffer = '';
                }

                // 테이블 및 기타 청크 판단 로직 통합
                const oldIndexStr = node.getAttribute('data-index');
                if (oldIndexStr !== null) {
                    const oldIndex = Number(oldIndexStr);
                    const existingChunk = currentLineChunks[oldIndex];
                    if (existingChunk) {
                        if (existingChunk.type === 'table') hasTable = true;
                        newChunks.push(existingChunk);
                    }
                } else if (node.tagName === 'TABLE') {
                    // data-index가 없는 신규 테이블 대응
                    hasTable = true;
                    // 신규 테이블 파싱 로직 호출 (필요 시)
                }
            }
        }

        if (textBuffer.length > 0) {
            newChunks.push({ type: 'text', text: textBuffer, style: {} });
        }

        const shouldSplit = hasTable && newChunks.length > 1;

        if (!restoreData) {
            restoreData = { 
                lineIndex, 
                chunkIndex: Math.max(0, newChunks.length - 1), 
                offset: 0 
            };
        }

        return { newChunks, restoreData, shouldSplit };
    }

    /**
     * [최적화 포인트]
     * 1. querySelectorAll 대신 native rows/cells 컬렉션 사용 (압도적 속도 차이)
     * 2. 불필요한 객체 생성 및 배열 메서드(map) 최소화
     */
    function extractTableDataFromDOM(tableEl) {
        if (!tableEl || tableEl.tagName !== 'TABLE') {
            return { rows: 0, cols: 0, data: [] };
        }

        const rows = tableEl.rows;
        const rowCount = rows.length;
        const tableData = new Array(rowCount);

        for (let i = 0; i < rowCount; i++) {
            const row = rows[i];
            const cells = row.cells;
            const cellCount = cells.length;
            const rowData = new Array(cellCount);

            for (let j = 0; j < cellCount; j++) {
                const cell = cells[j];
                let text = cell.textContent || '\u00A0';
                
                // 스타일 추출 최적화 (존재하는 값만 할당)
                const style = {};
                const s = cell.style;
                if (s.fontWeight) style.fontWeight = s.fontWeight;
                if (s.fontSize) style.fontSize = s.fontSize;
                if (s.color) style.color = s.color;
                if (s.backgroundColor) style.backgroundColor = s.backgroundColor;

                rowData[j] = { text, style };
            }
            tableData[i] = rowData;
        }

        return { 
            rows: rowCount, 
            cols: rowCount > 0 ? tableData[0].length : 0, 
            data: tableData 
        };
    }

    return { parseLineDOM, extractTableDataFromDOM };
}
export function createDOMParseService() {
    
    /**
     * 라인 DOM을 분석하여 데이터 모델(Chunks)로 변환
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

            // 1. 텍스트 노드 처리
            if (node.nodeType === 3) { 
                textBuffer += node.textContent;
                
                // 커서 위치 파악 (텍스트 노드 직접 비교)
                if (node === selectionContainer) {
                    restoreData = { 
                        lineIndex, 
                        chunkIndex: newChunks.length, 
                        offset: cursorOffset 
                    };
                }
            } 
            // 2. 엘리먼트 노드 처리 (span.chunk-text, table.se-table 등)
            else if (node.nodeType === 1) { 
                if (textBuffer.length > 0) {
                    newChunks.push({ type: 'text', text: textBuffer, style: {} });
                    textBuffer = '';
                }

                const isTable = node.tagName === 'TABLE' || node.classList.contains('chunk-table');
                const oldIndexStr = node.getAttribute('data-index');
                
                if (oldIndexStr !== null) {
                    const oldIndex = Number(oldIndexStr);
                    // 🔥 [안전장치] 현재 라인의 원본 데이터와 인덱스가 일치하는지 확인
                    const existingChunk = currentLineChunks && currentLineChunks[oldIndex];
                    
                    if (existingChunk) {
                        if (isTable) {
                            hasTable = true;
                            // 테이블인 경우 최신 DOM 상태를 반영하여 데이터 업데이트
                            newChunks.push({ 
                                ...existingChunk, 
                                ...extractTableDataFromDOM(node) 
                            });
                        } else {
                            newChunks.push(existingChunk);
                        }
                    }
                } else if (isTable) {
                    // 인덱스가 없는 신규 테이블
                    hasTable = true;
                    newChunks.push({ type: 'table', ...extractTableDataFromDOM(node) });
                } else if (node.classList.contains('chunk-text')) {
                    // 인덱스가 유실된 텍스트 요소 (복사 등)
                    newChunks.push({ 
                        type: 'text', 
                        text: node.textContent, 
                        style: _extractStyleFromElement(node) 
                    });
                }

                // 커서 위치 파악 (엘리먼트 내부에 커서가 있는 경우 포함)
                if (node === selectionContainer || node.contains(selectionContainer)) {
                    if (!restoreData) { // 중복 설정 방지
                        restoreData = { 
                            lineIndex, 
                            chunkIndex: newChunks.length - 1, 
                            offset: cursorOffset 
                        };
                    }
                }
            }
        }

        // 남은 텍스트 처리
        if (textBuffer.length > 0) {
            newChunks.push({ type: 'text', text: textBuffer, style: {} });
        }

        // 빈 라인 방지
        if (newChunks.length === 0) {
            newChunks.push({ type: 'text', text: '', style: {} });
        }

        if (!restoreData) {
            restoreData = { lineIndex, chunkIndex: 0, offset: 0 };
        }

        return { newChunks, restoreData, shouldSplit: hasTable && newChunks.length > 1 };
    }

    /**
     * 테이블 DOM에서 데이터를 추출 (셀 내부 멀티라인 대응)
     */
    function extractTableDataFromDOM(tableEl) {
        if (!tableEl || tableEl.tagName !== 'TABLE') return { rows: 0, cols: 0, data: [] };

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
                
                // 🔥 [중요] cell.textContent 대신 줄바꿈(\n)을 보존하는 innerText 사용
                // 더 정교한 처리가 필요하면 여기서도 자식 P 태그들을 루프 돌아야 함
                rowData[j] = { 
                    text: cell.innerText.replace(/\n\n/g, '\n').trim() || '\u00A0', 
                    style: _extractStyleFromElement(cell)
                };
            }
            tableData[i] = rowData;
        }

        return { 
            rows: rowCount, 
            cols: rowCount > 0 ? tableData[0].length : 0, 
            data: tableData 
        };
    }

    // 스타일 추출 헬퍼 (중복 코드 제거)
    function _extractStyleFromElement(el) {
        const s = el.style;
        const style = {};
        if (s.fontWeight === 'bold' || parseInt(s.fontWeight) >= 700) style.fontWeight = 'bold';
        if (s.fontStyle === 'italic') style.fontStyle = 'italic';
        if (s.textDecoration.includes('underline')) style.textDecoration = 'underline';
        if (s.fontSize) style.fontSize = s.fontSize;
        if (s.color) style.color = s.color;
        if (s.backgroundColor) style.backgroundColor = s.backgroundColor;
        return style;
    }

    return { parseLineDOM, extractTableDataFromDOM };
}
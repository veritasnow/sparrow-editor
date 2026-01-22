export function createDOMParseService() {
    
    /**
     * DOM 구조(lineEl)를 읽어 청크 배열을 생성합니다.
     * @param {HTMLElement} lineEl - 현재 라인의 <div> (text-block) 엘리먼트
     */
    function parseLineDOM(lineEl, currentLineChunks, selectionContainer, cursorOffset, lineIndex) {
        const newChunks = [];
        let textBuffer = '';
        let restoreData = null;
        let hasTable = false;

        Array.from(lineEl.childNodes).forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                textBuffer += node.textContent;
                
                if (node === selectionContainer) {
                    restoreData = { 
                        lineIndex, 
                        chunkIndex: newChunks.length, // 현재까지 쌓인 청크 개수가 인덱스가 됨
                        offset: cursorOffset 
                    };
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // 텍스트 버퍼 비우기
                if (textBuffer.length > 0) {
                    newChunks.push({ type: 'text', text: textBuffer, style: {} });
                    textBuffer = '';
                }

                // 테이블 요소인 경우
                if (node.classList.contains('chunk-table') || node.tagName === 'TABLE') {
                    hasTable = true;
                    const oldIndex = parseInt(node.dataset.index, 10);
                    const existingChunk = currentLineChunks[oldIndex];
                    
                    if (existingChunk) {
                        newChunks.push(existingChunk);
                    }
                } 
                // 기타 다른 청크 처리
                else if (node.hasAttribute('data-index')) {
                    const oldIndex = parseInt(node.dataset.index, 10);
                    const existingChunk = currentLineChunks[oldIndex];
                    if (existingChunk) newChunks.push(existingChunk);
                }
            }
        });

        // 마지막 남은 텍스트 처리
        if (textBuffer.length > 0) {
            newChunks.push({ type: 'text', text: textBuffer, style: {} });
        }

        // 💡 [핵심] 텍스트와 테이블이 공존한다면 분리가 필요함
        const shouldSplit = hasTable && newChunks.length > 1;

        // 커서 복구 데이터 보정
        if (!restoreData) {
            const lastIdx = Math.max(0, newChunks.length - 1);
            restoreData = { lineIndex, chunkIndex: lastIdx, offset: 0 };
        }

        return { newChunks, restoreData, shouldSplit };
    }

    function extractTableDataFromDOM(tableEl) {
        if (!tableEl || tableEl.tagName !== 'TABLE') {
            return { rows: 0, cols: 0, data: [] };
        }

        const trList = Array.from(tableEl.querySelectorAll('tr'));
        const data = trList.map(tr => {
            return Array.from(tr.querySelectorAll('td, th')).map(cell => {
                let text = cell.textContent ?? '';
                if (text === '') text = '\u00A0';
                const style = {};
                if (cell.style.fontWeight) style.fontWeight = cell.style.fontWeight;
                if (cell.style.fontSize) style.fontSize = cell.style.fontSize;
                if (cell.style.color) style.color = cell.style.color;
                if (cell.style.backgroundColor) style.backgroundColor = cell.style.backgroundColor;

                return { text, style };
            });
        });

        return { rows: data.length, cols: data[0]?.length || 0, data };
    }

    return { parseLineDOM, extractTableDataFromDOM };
}
export function createDOMParseService() {
    
    /**
     * DOM 구조(lineEl)를 읽어 청크 배열을 생성합니다.
     * @param {HTMLElement} lineEl - 현재 라인의 <div> (text-block) 엘리먼트
     */
    function parseLineDOM(lineEl, currentLineChunks, selectionContainer, cursorOffset, lineIndex) {
        const newChunks = [];
        let textBuffer = '';
        let restoreData = null;
    
        Array.from(lineEl.childNodes).forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                textBuffer += node.textContent;
                
                if (node === selectionContainer) {
                    restoreData = { lineIndex, chunkIndex: newChunks.length, offset: cursorOffset };
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (textBuffer.length > 0) {
                    newChunks.push({ type: 'text', text: textBuffer, style: {} });
                    textBuffer = '';
                }
    
                if (node.hasAttribute('data-index')) {
                    const oldIndex = parseInt(node.dataset.index, 10);
                    const existingChunk = currentLineChunks[oldIndex] || 
                                          currentLineChunks.find(c => c.type !== 'text' && c.src === node.getAttribute('src')); 
                    
                    if (existingChunk) {
                        newChunks.push(existingChunk);
                    }
                }
            }
        });
    
        if (textBuffer.length > 0) {
            newChunks.push({ type: 'text', text: textBuffer, style: {} });
        }
        
        if (!restoreData && newChunks.length > 0 && newChunks[newChunks.length - 1].type === 'text') {
            restoreData = { 
                lineIndex, 
                chunkIndex: newChunks.length - 1, 
                offset: newChunks[newChunks.length - 1].text.length 
            };
        } else if (!restoreData) {
            restoreData = { lineIndex, chunkIndex: 0, offset: 0 };
        }
    
        return { newChunks, restoreData };
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
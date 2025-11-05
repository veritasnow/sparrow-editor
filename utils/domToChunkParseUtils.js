// /utils/domToChunkParseUtils.js

/**
 * DOM 구조(parentP)를 읽어 청크 배열을 생성하고 커서 복원 데이터를 반환합니다.
 * 이 서비스는 에디터 DOM (P 엘리먼트 내부)을 State 구조(청크 배열)로 변환하는 역할을 합니다.
 * @param {HTMLElement} parentP - 현재 라인의 <p> 엘리먼트
 * @param {Array<Object>} currentLineChunks - 현재 상태의 청크 배열 (비텍스트 청크 참조용)
 * @param {Node} selectionContainer - 커서가 위치한 DOM 노드
 * @param {number} cursorOffset - 커서가 위치한 DOM 노드 내의 오프셋
 * @param {number} lineIndex - 현재 라인 인덱스
 * @returns {{ newChunks: Array, restoreData: Object }}
 */
export function parseParentPToChunks(parentP, currentLineChunks, selectionContainer, cursorOffset, lineIndex) {
    const newChunks = [];
    let textBuffer = '';
    let restoreData = null;
    let newChunkIndex = 0; // 커서가 위치한 텍스트 청크의 최종 인덱스

    Array.from(parentP.childNodes).forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            textBuffer += node.textContent;
            
            if (node === selectionContainer) {
                newChunkIndex = newChunks.length;
                restoreData = { lineIndex, chunkIndex: newChunkIndex, offset: cursorOffset };
            }

        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // 텍스트 버퍼를 먼저 청크로 변환
            if (textBuffer.length > 0) {
                newChunks.push({ type: 'text', text: textBuffer, style: {} });
                textBuffer = '';
            }

            // [data-index]를 가진 청크 엘리먼트 처리
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

    // 순회 후 텍스트 버퍼 처리
    if (textBuffer.length > 0) {
        newChunks.push({ type: 'text', text: textBuffer, style: {} });
    }
    
    // 복원 데이터 안전 장치 로직
    if (!restoreData && newChunks.length > 0 && newChunks[newChunks.length - 1].type === 'text' && selectionContainer.nodeType === Node.TEXT_NODE) {
        restoreData = { 
            lineIndex, 
            chunkIndex: newChunks.length - 1, 
            offset: newChunks[newChunks.length - 1].text.length 
        };
    }

    return { newChunks, restoreData };
}
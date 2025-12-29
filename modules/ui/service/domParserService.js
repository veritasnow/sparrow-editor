/**
 * DOM 파싱 서비스를 생성합니다.
 * 이 서비스는 에디터 DOM (View)을 에디터 상태 모델 (Model)로 변환하는 경계층 역할을 수행합니다.
 * (기존의 domToChunkParseUtils 로직이 서비스 메서드로 통합되었습니다.)
 * * @returns {Object} 파싱 관련 공개 함수들
 */
export function createDOMParseService() {
    
    /**
     * DOM 구조(parentP)를 읽어 청크 배열을 생성하고 커서 복원 데이터를 반환합니다.
     * @param {HTMLElement} parentP - 현재 라인의 <p> 엘리먼트
     * @param {Array<Object>} currentLineChunks - 현재 상태의 청크 배열 (비텍스트 청크 참조용)
     * @param {Node} selectionContainer - 커서가 위치한 DOM 노드
     * @param {number} cursorOffset - 커서가 위치한 DOM 노드 내의 오프셋
     * @param {number} lineIndex - 현재 라인 인덱스
     * @returns {{ newChunks: Array, restoreData: Object }}
     */
    function parseLineDOM(parentP, currentLineChunks, selectionContainer, cursorOffset, lineIndex) {
        const newChunks = [];
        let textBuffer = '';
        let restoreData = null;
        let newChunkIndex = 0; // 커서가 위치한 텍스트 청크의 최종 인덱스
    
        Array.from(parentP.childNodes).forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                textBuffer += node.textContent;
                
                if (node === selectionContainer) {
                    // 커서가 텍스트 노드에 있을 때, 해당 텍스트 노드의 청크 인덱스 계산
                    newChunkIndex = newChunks.length;
                    restoreData = { lineIndex, chunkIndex: newChunkIndex, offset: cursorOffset };
                }
    
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // 텍스트 버퍼를 먼저 청크로 변환 (스타일이 없는 순수 텍스트 청크)
                if (textBuffer.length > 0) {
                    newChunks.push({ type: 'text', text: textBuffer, style: {} });
                    textBuffer = '';
                }
    
                // [data-index]를 가진 청크 엘리먼트 (비텍스트 청크) 처리
                if (node.hasAttribute('data-index')) {
                    const oldIndex = parseInt(node.dataset.index, 10);
                    // 기존 상태에서 청크를 참조하여 불변성 유지
                    const existingChunk = currentLineChunks[oldIndex] || 
                                          currentLineChunks.find(c => c.type !== 'text' && c.src === node.getAttribute('src')); 
                    
                    if (existingChunk) {
                        newChunks.push(existingChunk);
                    }
                }
            }
        });
    
        // 순회 후 남은 텍스트 버퍼 처리
        if (textBuffer.length > 0) {
            newChunks.push({ type: 'text', text: textBuffer, style: {} });
        }
        
        // 복원 데이터 안전 장치 로직
        if (!restoreData && newChunks.length > 0 && newChunks[newChunks.length - 1].type === 'text') {
             // selectionContainer가 <p> 태그이거나, <br> 태그 등으로 잡힐 경우, 마지막 텍스트 청크 끝으로 복원
            restoreData = { 
                lineIndex, 
                chunkIndex: newChunks.length - 1, 
                offset: newChunks[newChunks.length - 1].text.length 
            };
        } else if (!restoreData) {
            // 커서 위치를 찾지 못했으면 라인의 시작(0, 0)으로 기본값 설정 (커서 유실 방지)
            restoreData = { lineIndex, chunkIndex: 0, offset: 0 };
        }
    
        return { newChunks, restoreData };
    }

    return { 
        parseLineDOM
    };
}
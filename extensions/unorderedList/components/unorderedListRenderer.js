export const unorderedListRenderer = {
    /**
     * @param {Object} chunk - 리스트 데이터
     * @param {Number} lineIndex - 메인 에디터에서의 라인 인덱스
     * @param {Number} chunkIndex - 라인 내 청크 순서
     * @param {Function} subRenderCall - (liIndex, liLineData, ulEl) => void
     */
    render(chunk, lineIndex, ulEl) {

        ulEl.id                = chunk.id;
        ulEl.dataset.type      = "unorderedList";
        ulEl.dataset.lineIndex = lineIndex; 
        ulEl.innerHTML         = ""; 

        const items = chunk.data ?? []; 
        
        items.forEach((itemData, internalIdx) => {
            const li = document.createElement("li");
            li.className           = "se-list-item text-block";
            li.dataset.containerId = chunk.id; 
            li.dataset.lineIndex   = internalIdx;

            const liLineModel = itemData.line;

            if (liLineModel && liLineModel.chunks) {
                liLineModel.chunks.forEach((c, cIdx) => {
                    const span = document.createElement("span");
                    span.className         = "chunk-text";
                    span.dataset.index     = cIdx;
                    span.dataset.lineIndex = internalIdx; 

                    if (c.style) Object.assign(span.style, c.style);
                    const rawText    = c.text || "";
                    // 텍스트가 비어 있을 때만 유령 글자 삽입
                    span.textContent = rawText === "" ? "\u200B" : rawText;
                    li.appendChild(span);
                });
            } else {
                console.warn(`  [LI ${internalIdx}] No line data found, rendering empty.`);
                
                const emptySpan = document.createElement("span");
                emptySpan.className         = "chunk-text";
                emptySpan.dataset.index     = "0";
                emptySpan.dataset.lineIndex = internalIdx; // 여기도 추가해서 확인
                emptySpan.textContent       = "\u200B";
                li.appendChild(emptySpan);
            }
            
            ulEl.appendChild(li);
        });
        console.groupEnd();

        //return ulEl;
    }
};
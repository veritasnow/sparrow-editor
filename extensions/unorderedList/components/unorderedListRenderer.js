export const unorderedListRenderer = {
    /**
     * @param {Object} chunk - 리스트 데이터
     * @param {Number} lineIndex - 메인 에디터에서의 라인 인덱스
     * @param {Number} chunkIndex - 라인 내 청크 순서
     * @param {Function} subRenderCall - (liIndex, liLineData, ulEl) => void
     */
    render(chunk, lineIndex, ulEl) {

        console.group(`🎨 Rendering List: ${chunk.id}`);
        console.log("UL Target Index (Parent Level):", lineIndex);

        ulEl.id                = chunk.id;
        ulEl.dataset.type      = "unorderedList";
        ulEl.dataset.lineIndex = lineIndex; 
        ulEl.innerHTML         = ""; 
        console.log("UL Element after clear:", ulEl);

        const items = chunk.data ?? []; 
        
        items.forEach((itemData, internalIdx) => {
            const li = document.createElement("li");
            li.className           = "se-list-item text-block";
            li.dataset.containerId = chunk.id; 
            
            // 🔍 [체크포인트 1] internalIdx가 실제 0, 1, 2 순서대로 오는지 확인
            li.dataset.lineIndex = internalIdx;
            console.log(`  [LI ${internalIdx}] Assigned Index:`, li.dataset.lineIndex);

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
            
            // 🔍 [체크포인트 3] Append 직후 실제 DOM 상태 확인
            console.log(`  [LI ${internalIdx}] Final DOM Index after append:`, li.getAttribute('data-line-index'));
        });
        console.groupEnd();

        //return ulEl;
    }
};
export const unorderedListRenderer = {
    /**
     * @param {Object} chunk - 리스트 데이터
     * @param {Number} lineIndex - 메인 에디터에서의 라인 인덱스
     * @param {Number} chunkIndex - 라인 내 청크 순서
     * @param {Function} subRenderCall - (liIndex, liLineData, targetElement, options) => void
     */
    render(chunk, lineIndex, chunkIndex, subRenderCall) {
        const items = chunk.data ?? []; 

        const ul     = document.createElement("ul");
        ul.id        = chunk.id;
        ul.className = "se-list chunk-list chunk-unorderedList";
        
        ul.dataset.lineIndex  = lineIndex;
        ul.dataset.chunkIndex = chunkIndex;
        ul.dataset.type       = "unorderedList";

        Object.assign(ul.style, {
            margin: "8px 0 8px 25px",
            padding: "0",
            listStyleType: "disc",
            ...(chunk.style || {})
        });

        items.forEach((itemData, internalIdx) => {
            const li = document.createElement("li");
            
            // li는 에디터의 'Line'과 동일한 위상을 가집니다.
            li.className = "se-list-item text-block"; 
            li.setAttribute("data-container-id", chunk.id); 
            li.setAttribute("data-line-index", internalIdx); 

            // 💡 핵심: itemData.line이 존재할 때 subRenderCall을 통해 
            // 일반 텍스트 라인과 동일한 'span' 생성 로직을 태웁니다.
            if (subRenderCall && itemData.line) {
                subRenderCall(internalIdx, itemData.line, li, {
                    key                 : chunk.id,           // 컨테이너 ID 전달
                    shouldRenderSub: false   // 중첩 리스트 방지 (필요 시)
                });
            } else {
                // 데이터가 없을 때도 최소한의 구조 유지 (제로 너비 공백을 가진 span)
                const emptySpan = document.createElement("span");
                emptySpan.className     = "chunk-text";
                emptySpan.dataset.index = "0";
                emptySpan.textContent   = "\u200B";
                li.appendChild(emptySpan);
            }
            
            ul.appendChild(li);
        });

        return ul;
    }
};
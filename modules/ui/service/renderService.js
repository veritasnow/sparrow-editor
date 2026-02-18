export function createRenderService({ rootId, rendererRegistry }) { 

    // 1. 라인 데이터에 따른 태그 결정 (테이블 포함 시 DIV, 아니면 P)
    const getTagNameForLine = (lineData, targetKey) => {
        if (!lineData || !lineData.chunks) return "P";
        
        if (targetKey && targetKey.startsWith('list-')) {
            return "LI";
        }
        
        const firstChunk = lineData.chunks[0];
        if (firstChunk.type === 'unorderedList') return "UL"; // 리스트면 UL 반환
        if (lineData.chunks.some(c => c.type === 'table')) return "DIV";
        
        return "P";
    };

    // 2. 공통 라인 엘리먼트 생성
    const createLineElement = (lineData, lineIndex = null) => {
        const tagName = getTagNameForLine(lineData);
        const el = document.createElement(tagName);
        el.className = "text-block";
        if (lineIndex !== null) {
            el.dataset.lineIndex = lineIndex;
        }        
        return el;
    };

    const getTargetElement = (targetKey) => document.getElementById(targetKey || rootId);

    /**
     * 3. State와 DOM 개수 동기화
     */
    function syncParagraphCount(state, targetKey) {
        const container = getTargetElement(targetKey);
        if (!container) return;

        // 🔥 container.children는 직계 자식만 반환하므로 안전함
        const currentLines = container.children; 
        const stateLen = state.length;
        const domLen = currentLines.length;

        if (stateLen > domLen) {
            const fragment = document.createDocumentFragment();
            for (let i = domLen; i < stateLen; i++) {
                fragment.appendChild(createLineElement(state[i]));
            }
            container.appendChild(fragment);
        } else if (stateLen < domLen) {
            for (let i = domLen - 1; i >= stateLen; i--) {
                container.removeChild(currentLines[i]);
            }
        }
    }

    /**
     * 4. 개별 라인 렌더링
     */
    function renderLine(lineIndex, lineData, targetKey, externalPool = null, skipSync = false) {
        const container = getTargetElement(targetKey);
        console.log("targetKeytargetKeytargetKey : ", targetKey);
        if (!container) return;

        // 🔥 [중요] :scope > 를 사용하여 현재 컨테이너의 직계 자식인 라인만 찾음
        let lineEl = container.querySelector(`:scope > [data-line-index="${lineIndex}"]`);
        
        if (!lineEl) {
            // 인덱스 속성이 없는 초기 엘리먼트가 있는지 확인
            lineEl = Array.from(container.children).find(el => !el.hasAttribute('data-line-index'));
        }        
        
        const requiredTag = getTagNameForLine(lineData, targetKey);

        if (!lineEl) {
            lineEl = createLineElement(lineData, lineIndex);
            container.appendChild(lineEl);
        } else if (lineEl.tagName !== requiredTag) {
            const newLineEl = createLineElement(lineData, lineIndex);
            container.replaceChild(newLineEl, lineEl);
            lineEl = newLineEl;
        }

        lineEl.dataset.lineIndex = lineIndex;

        // 테이블 재사용 풀 확보
        const tablePool = externalPool || Array.from(lineEl.getElementsByClassName('chunk-table'));
        
        lineEl.style.textAlign = lineData.align || "left";

        if (requiredTag === "UL") {
            // 리스트면 내부를 싹 비우고 그리는 renderListIntoElement를 실행
            const listChunk = lineData.chunks[0];
            const renderer  = rendererRegistry['unorderedList'];
            if (!renderer) return;
            renderer.render(listChunk, lineIndex, lineEl);            
        } else {
            lineEl.innerHTML = ""; 

            if (!lineData.chunks || lineData.chunks.length === 0) {
                const br = document.createElement("br");
                br.dataset.marker = "empty";
                lineEl.appendChild(br);
            } else {        
                this.renderLineChunksWithReuse(lineData, lineIndex, lineEl, tablePool);
            }

            if (!skipSync) {
                syncLineIndexes(container);
            }

        }

    }

    /**
     * 5. 청크 렌더링 및 테이블 재사용
     */
    function renderLineChunksWithReuse(line, lineIndex, parentEl, tablePool) {
        line.chunks.forEach((chunk, chunkIndex) => {
            let el;
            if (chunk.type === 'table') {
                el = (tablePool && tablePool.length > 0) ? tablePool.shift() : null;
            }

            if (!el) {
                const renderer = rendererRegistry[chunk.type];
                if (!renderer) return;
                el = renderer.render(chunk, lineIndex, chunkIndex);
            }

            el.dataset.lineIndex = lineIndex;
            el.dataset.chunkIndex = chunkIndex;
            el.dataset.index = chunkIndex; 
            el.classList.add(`chunk-${chunk.type}`);
            parentEl.appendChild(el);
        });
    }

    /**
     * 6. 단순 텍스트 업데이트
     */
    function renderChunk(lineIndex, chunkIndex, chunkData, targetKey) {
        const container = getTargetElement(targetKey);
        // 🔥 [중요] :scope > 적용
        const lineEl = container.querySelector(`:scope > [data-line-index="${lineIndex}"]`);

        if (!lineEl) return;

        const chunkEl = Array.from(lineEl.children).find(el => el.dataset.chunkIndex == chunkIndex);

        if (chunkEl && chunkData.type === 'text') {
            if (chunkEl.textContent !== chunkData.text) {
                chunkEl.textContent = chunkData.text;
            }
            Object.assign(chunkEl.style, chunkData.style || {});
        } else {
            this.renderLine(lineIndex, chunkData, targetKey);
        }
    }

    /**
     * 7. 인덱스 동기화
     */
    function syncLineIndexes(container) {
        if (!container) return;

        //const directLines = container.querySelectorAll(':scope > [data-line-index]');
        const directLines = container.querySelectorAll(':scope > .text-block');
        
        directLines.forEach((line, idx) => {
            const newIdx = idx.toString();
            line.dataset.lineIndex = newIdx; // 여기서 새 라인에도 인덱스가 생김!

            if (line.tagName === 'UL') return; 

            // 내부 청크 동기화
            const chunks = line.querySelectorAll(':scope > [data-line-index]');
            chunks.forEach(chunk => {
                chunk.dataset.lineIndex = newIdx;
            });
        });
    }

    return {
        render(state, targetKey) {
            syncParagraphCount(state, targetKey);
            const container = getTargetElement(targetKey);
            if (!container) return;

            state.forEach((line, i) => {
                this.renderLine(i, line, targetKey, null, true);
            });
            
            syncLineIndexes(container);
        },

        ensureFirstLine(targetKey) {
            const container = getTargetElement(targetKey);
            if (!container || container.children.length > 0) return;
            container.appendChild(createLineElement());
        },

        insertLine(lineIndex, align = "left", targetKey, lineData = null) {
            const container = getTargetElement(targetKey);
            if (!container) return;
            
            const newEl = createLineElement(lineData);
            newEl.style.textAlign = align;
            
            // 🔥 [NotFoundError 해결의 핵심]
            // :scope > 를 사용해 현재 container의 '직계 자식'인 lineIndex를 찾습니다.
            // 그래야 insertBefore(newEl, target) 시 부모-자식 관계가 일치합니다.
            const target = container.querySelector(`:scope > [data-line-index="${lineIndex}"]`);

            if (target) {
                container.insertBefore(newEl, target);
            } else {
                container.appendChild(newEl);
            }
            syncLineIndexes(container);
        },

        insertLineAfter(refEl, newIndex, align, targetKey) {
            const container       = getTargetElement(targetKey);
            const newEl           = createLineElement();
            newEl.style.textAlign = align;
            newEl.setAttribute('data-line-index', newIndex);

            // 기준 노드 바로 다음 형제 앞에 삽입 = 기준 노드 바로 뒤에 삽입
            if (refEl && refEl.nextSibling) {
                container.insertBefore(newEl, refEl.nextSibling);
            } else {
                container.appendChild(newEl);
            }
            syncLineIndexes(container);
            return newEl;
        },

        removeLine(lineIndex, targetKey) {
            const container = getTargetElement(targetKey);
            const target = container.querySelector(`:scope > [data-line-index="${lineIndex}"]`);
            if (target) {
                container.removeChild(target);
            }
        },

        renderLine,
        renderLineChunksWithReuse,
        renderChunk
    };
}
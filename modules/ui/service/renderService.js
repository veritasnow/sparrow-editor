export function createRenderService({ rootId, rendererRegistry }) { 

    // 1. 라인 데이터에 따른 태그 결정 (테이블 포함 시 DIV, 아니면 P)
    const getTagNameForLine = (lineData) => {
        if (!lineData || !lineData.chunks) return "P";
        return lineData.chunks.some(c => c.type === 'table') ? "DIV" : "P";
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
        if (!container) return;

        // 🔥 [중요] :scope > 를 사용하여 현재 컨테이너의 직계 자식인 라인만 찾음
        let lineEl = container.querySelector(`:scope > [data-line-index="${lineIndex}"]`);
        
        if (!lineEl) {
            // 인덱스 속성이 없는 초기 엘리먼트가 있는지 확인
            lineEl = Array.from(container.children).find(el => !el.hasAttribute('data-line-index'));
        }        
        
        const requiredTag = getTagNameForLine(lineData);

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
        const lineEl = container?.querySelector(`:scope > [data-line-index="${lineIndex}"]`);

        if (!lineEl) return;

        const chunkEl = Array.from(lineEl.children).find(
            el => el.dataset.chunkIndex == chunkIndex
        );

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
        if (!container || !container.children.length) return;

        // 🔥 직계 자식 중 text-block만 필터링
        const lines = Array.from(container.children).filter(el => el.classList.contains('text-block'));
        if (lines.length === 0) return;

        let baseIndex = parseInt(lines[0].dataset.lineIndex);
        if (isNaN(baseIndex)) baseIndex = 0;

        lines.forEach((lineEl, i) => {
            const currentLineIndex = baseIndex + i;
            lineEl.dataset.lineIndex = currentLineIndex;

            for (const child of lineEl.children) {
                if (child.dataset) {
                    child.dataset.lineIndex = currentLineIndex;
                    // chunkIndex는 렌더링 시 부여된 값을 유지하거나 필요 시 여기서 재계산
                }
            }
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
        },

        removeLine(lineIndex, targetKey) {
            const container = getTargetElement(targetKey);
            // 🔥 :scope > 적용
            const target = container?.querySelector(`:scope > [data-line-index="${lineIndex}"]`);
            if (target) {
                container.removeChild(target);
            }
        },

        renderLine,
        renderLineChunksWithReuse,
        renderChunk
    };
}
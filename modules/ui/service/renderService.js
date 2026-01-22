export function createRenderService({ rootId, rendererRegistry }) { 
    
    // 1. [신규/개선] 데이터에 따라 태그를 결정하는 로직
    function getTagNameForLine(lineData) {
        if (!lineData || !lineData.chunks) return "p";
        const hasTable = lineData.chunks.some(chunk => chunk.type === 'table');
        return hasTable ? "div" : "p";
    }

    // 2. [신규/개선] 공통 엘리먼트 생성 로직
    function createLineElement(lineData) {
        const tagName = getTagNameForLine(lineData);
        const el = document.createElement(tagName);
        el.className = "text-block"; // 공통 클래스
        return el;
    }

    function getTargetElement(targetKey) {
        const id = targetKey || rootId;
        return document.getElementById(id);
    }

    /**
     * 3. [기존 유지/개선] State와 DOM 개수 동기화
     */
    function syncParagraphCount(state, targetKey) {
        const container = getTargetElement(targetKey);
        if (!container) return;

        const lines = Array.from(container.querySelectorAll(':scope > .text-block'));
        
        if (state.length > lines.length) {
            const diff = state.length - lines.length;
            const startIdx = lines.length;
            for (let i = 0; i < diff; i++) {
                // 추가될 라인의 데이터를 보고 p 또는 div 생성
                const newLine = createLineElement(state[startIdx + i]);
                container.appendChild(newLine);
            }
        } else if (state.length < lines.length) {
            for (let i = lines.length - 1; i >= state.length; i--) {
                container.removeChild(lines[i]);
            }
        }
    }

    /**
     * 4. [기존 유지/개선] 개별 라인 렌더링 (태그 교체 로직 포함)
     */
    function renderLine(lineIndex, lineData, targetKey, externalPool = null) {
        const container = getTargetElement(targetKey);
        if (!container) return;

        const lines = Array.from(container.querySelectorAll(':scope > .text-block'));
        let lineEl = lines[lineIndex];
        
        const requiredTagName = getTagNameForLine(lineData).toUpperCase();

        if (!lineEl) {
            lineEl = createLineElement(lineData);
            container.appendChild(lineEl);
        } 
        // 💡 기존 DOM의 태그가 데이터 형식과 맞지 않으면 교체
        else if (lineEl.tagName !== requiredTagName) {
            const newLineEl = createLineElement(lineData);
            container.replaceChild(newLineEl, lineEl);
            lineEl = newLineEl;
        }

        // 💡 기존의 테이블 재사용 로직 유지
        const tablePool = externalPool || Array.from(lineEl.querySelectorAll('.chunk-table'));
        lineEl.style.textAlign = lineData.align || "left";
        lineEl.innerHTML = ""; 

        if (!lineData.chunks || lineData.chunks.length === 0) {
            const br = document.createElement("br");
            br.dataset.marker = "empty";
            lineEl.appendChild(br);
        } else {
            this.renderLineChunksWithReuse(lineData, lineIndex, lineEl, tablePool);
        }
    }

    /**
     * 5. [기존 유지] 청크 렌더링 및 테이블 재사용
     */
    function renderLineChunksWithReuse(line, lineIndex, parentEl, tablePool) {
        line.chunks.forEach((chunk, chunkIndex) => {
            if (chunk.type === 'table') {
                const oldTable = tablePool.shift();
                if (oldTable) {
                    oldTable.dataset.lineIndex = lineIndex;
                    oldTable.dataset.chunkIndex = chunkIndex;
                    oldTable.dataset.index = chunkIndex;
                    parentEl.appendChild(oldTable);
                    return; 
                }
            }

            const renderer = rendererRegistry[chunk.type];
            if (!renderer) return;

            const el = renderer.render(chunk, lineIndex, chunkIndex);
            el.dataset.index = chunkIndex;
            el.classList.add(`chunk-${chunk.type}`);
            parentEl.appendChild(el);
        });
    }

    /**
     * 6. [기존 유지] 단순 텍스트 업데이트용 (최적화용)
     */
    function renderChunk(lineIndex, chunkIndex, chunkData, targetKey) {
        const container = getTargetElement(targetKey);
        const lineEl = container?.querySelectorAll(':scope > .text-block')[lineIndex];
        if (!lineEl) return;

        const chunkEl = Array.from(lineEl.children).find(
            (el) => parseInt(el.dataset.index, 10) === chunkIndex
        );

        const renderer = rendererRegistry[chunkData.type];
        if (!renderer || typeof renderer.render !== "function") return;

        if (chunkEl && chunkData.type === 'text') {
            if (chunkEl.textContent !== chunkData.text) {
                chunkEl.textContent = chunkData.text;
            }
            Object.entries(chunkData.style || {}).forEach(([key, value]) => {
                chunkEl.style[key] = value;
            });
        } else {
            // 텍스트가 아니거나 청크가 없으면 해당 라인 전체 리렌더링 (안정성)
            this.renderLine(lineIndex, state.getState(targetKey)[lineIndex], targetKey);
        }
    }

    return {
        // 기존 인터페이스 유지
        render(state, targetKey) {
            const container = getTargetElement(targetKey);
            if (!container) return;
            syncParagraphCount(state, targetKey);
            state.forEach((line, i) => this.renderLine(i, line, targetKey));
        },

        ensureFirstLine(targetKey) {
            const container = getTargetElement(targetKey);
            if (!container || container.querySelectorAll(':scope > .text-block').length > 0) return;
            const firstLine = document.createElement("p"); // 기본은 p
            firstLine.className = "text-block";
            container.appendChild(firstLine);
        },

        insertLine(lineIndex, align = "left", targetKey, lineData = null) {
            const container = getTargetElement(targetKey);
            if (!container) return;
            const lines = Array.from(container.querySelectorAll(':scope > .text-block'));
            const newEl = createLineElement(lineData);
            newEl.style.textAlign = align;
            if (lines[lineIndex]) container.insertBefore(newEl, lines[lineIndex]);
            else container.appendChild(newEl);
        },

        removeLine(lineIndex, targetKey) {
            const container = getTargetElement(targetKey);
            const lines = Array.from(container.querySelectorAll(':scope > .text-block'));
            if (lines[lineIndex]) container.removeChild(lines[lineIndex]);
        },

        shiftLinesDown(fromIndex, targetKey) {
            const container = getTargetElement(targetKey);
            if (!container) return;
            const lines = Array.from(container.querySelectorAll(':scope > .text-block'));
            for (let i = lines.length - 1; i >= fromIndex; i--) {
                const line = lines[i];
                if (line.nextSibling) container.insertBefore(line, line.nextSibling.nextSibling);
                else container.appendChild(line);
            }
        },

        renderLine,
        renderLineChunksWithReuse,
        renderChunk
    };
}
export function createRenderService({ rootId, rendererRegistry }) { 

    const getTagNameForLine = (lineData, targetKey) => {
        if (!lineData || !lineData.chunks) return "P";
        if (targetKey && (targetKey.startsWith('list-') || targetKey.includes('list'))) {
            return "LI";
        }
        const firstChunk = lineData.chunks[0];
        if (firstChunk.type === 'unorderedList') return "UL"; 
        if (lineData.chunks.some(c => c.type === 'table')) return "DIV";
        return "P";
    };

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

    function syncParagraphCount(state, targetKey) {
        const container = getTargetElement(targetKey);
        if (!container) return;

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
    function renderLine(lineIndex, lineData, targetKey, externalPool = null, skipSync = false, options = {}) {        
        const container = getTargetElement(targetKey);
        if (!container) return;

        let lineEl = container.querySelector(`:scope > [data-line-index="${lineIndex}"]`);
        
        if (!lineEl) {
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

        const tablePool = externalPool || Array.from(lineEl.getElementsByClassName('chunk-table'));
        
        lineEl.style.textAlign = lineData.align || "left";

        if (requiredTag === "UL") {
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
                if (options.tableStrategy === 'force') {
                    renderLineChunksWithTableForce(lineData, lineIndex, lineEl, tablePool);
                } else {
                    renderLineChunksWithReuse(lineData, lineIndex, lineEl, tablePool);
                }
            }

            // 🎯 [수정된 핵심 1] 
            // 현재 렌더링을 수행한 타겟 컨테이너 자체가 테이블 셀(td)이거나, 
            // 혹은 상위 부모 중에 테이블 셀이 있다면 해당 셀의 리사이저를 찾아 무조건 '맨 마지막 자식'으로 다시 재배치합니다.
            if (targetKey) {
                const cellEl = document.getElementById(targetKey);
                if (cellEl && cellEl.classList.contains('se-table-cell')) {
                    const resizer = cellEl.querySelector(':scope > .table-resizer');
                    if (resizer) {
                        cellEl.appendChild(resizer); // 자식 리스트의 최하단 트레일러로 강제 이동
                    }
                }
            }

            if (!skipSync) {
                syncLineIndexes(container);
            }
        }
    }

    function renderLineChunksWithTableForce(line, lineIndex, parentEl, tablePool) {
        line.chunks.forEach((chunk, chunkIndex) => {
            let el = null;
            if (chunk.type !== 'table') {
                if (tablePool && tablePool.length > 0) {
                    el = tablePool.shift();
                }
            }
            if (!el) {
                const renderer = rendererRegistry[chunk.type];
                if (!renderer) return;
                el = renderer.render(chunk, lineIndex, chunkIndex);
            }
            el.dataset.lineIndex  = lineIndex;
            el.dataset.chunkIndex = chunkIndex;
            el.dataset.index      = chunkIndex;
            el.classList.add(`chunk-${chunk.type}`);
            parentEl.appendChild(el);
        });
    }
    
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

    function renderChunk(lineIndex, chunkIndex, chunkData, targetKey) {
        const container = getTargetElement(targetKey);
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
     * 7. 인덱스 동기화 및 최종 레이어 샌드위치 방지 정렬
     */
    function syncLineIndexes(container) {
        if (!container) return;

        const directLines = container.querySelectorAll(':scope > .text-block');
        
        directLines.forEach((line, idx) => {
            const newIdx = idx.toString();
            line.dataset.lineIndex = newIdx;

            if (line.tagName === 'UL') return; 

            const chunks = line.querySelectorAll(':scope > [data-line-index]');
            chunks.forEach(chunk => {
                chunk.dataset.lineIndex = newIdx;
            });
        });

        // 🎯 [수정된 핵심 2]
        // 인덱스 동기화 단계가 끝나는 최종 시점에, 현재 컨테이너 내부 혹은 상위에 존재하는
        // 모든 테이블 셀을 싹 훑어서 리사이저 위치를 일괄적으로 맨 뒤 조치합니다. (중첩 테이블 스택 꼬임 원천 차단)
        const rootContainer = document.getElementById(rootId);
        if (rootContainer) {
            rootContainer.querySelectorAll('.se-table-cell').forEach(td => {
                const resizer = td.querySelector(':scope > .table-resizer');
                if (resizer) {
                    td.appendChild(resizer);
                }
            });
        }
    }

    function render(state, targetKey) {
        syncParagraphCount(state, targetKey);
        const container = getTargetElement(targetKey);
        if (!container) return;

        state.forEach((line, i) => {
            this.renderLine(i, line, targetKey, null, true);
        });
        
        syncLineIndexes(container);
    }

    function ensureFirstLine(targetKey) {
        const container = getTargetElement(targetKey);
        if (!container || container.children.length > 0) return;
        container.appendChild(createLineElement());
    } 

    function insertLine(lineIndex, align = "left", targetKey, lineData = null) {
        const container = getTargetElement(targetKey);
        if (!container) return;
        
        const newEl = createLineElement(lineData);
        newEl.style.textAlign = align;
        
        const target = container.querySelector(`:scope > [data-line-index="${lineIndex}"]`);

        if (target) {
            container.insertBefore(newEl, target);
        } else {
            container.appendChild(newEl);
        }
        syncLineIndexes(container);
    }

    function insertLineAfter(refEl, newIndex, align, targetKey) {
        const container       = getTargetElement(targetKey);
        const newEl           = createLineElement();
        newEl.style.textAlign = align;
        newEl.setAttribute('data-line-index', newIndex);

        if (refEl && refEl.nextSibling) {
            container.insertBefore(newEl, refEl.nextSibling);
        } else {
            container.appendChild(newEl);
        }
        syncLineIndexes(container);
        return newEl;
    }

    function removeLine(lineIndex, targetKey) {
        const container = getTargetElement(targetKey);
        const target = container.querySelector(`:scope > [data-line-index="${lineIndex}"]`);
        if (target) {
            container.removeChild(target);
        }
    }

    return {
        render,
        ensureFirstLine,
        insertLine,
        insertLineAfter,
        removeLine,
        renderLine,
        renderLineChunksWithReuse,
        renderChunk
    };
}
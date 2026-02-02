export function createRenderService({ rootId, rendererRegistry }) { 

    // 1. 라인 데이터에 따른 태그 결정 (p 또는 div)
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
     * 3. State와 DOM 개수 동기화 (최적화)
     */
    function syncParagraphCount(state, targetKey) {
        const container = getTargetElement(targetKey);
        if (!container) return;

        const currentLines = container.children; // Live HTMLCollection (빠름)
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
     * 4. 개별 라인 렌더링 (태그 교체 및 테이블 풀 관리)
     */
    function renderLine(lineIndex, lineData, targetKey, externalPool = null) {
        const container = getTargetElement(targetKey);
        if (!container) return;

        let lineEl = container.children[lineIndex];
        const requiredTag = getTagNameForLine(lineData);

        // 라인 엘리먼트가 없거나 태그가 다르면 교체
        if (!lineEl) {
            lineEl = createLineElement(lineData, lineIndex);
            container.appendChild(lineEl);
        } else if (lineEl.tagName !== requiredTag) {
            const newLineEl = createLineElement(lineData, lineIndex);
            container.replaceChild(newLineEl, lineEl);
            lineEl = newLineEl;
        }

        lineEl.dataset.lineIndex = lineIndex;

        // 테이블 재사용 풀 확보 (비우기 전에 추출)
        const tablePool = externalPool || Array.from(lineEl.getElementsByClassName('chunk-table'));
        
        lineEl.style.textAlign = lineData.align || "left";
        lineEl.innerHTML = ""; // 기존 내용 초기화

        if (!lineData.chunks || lineData.chunks.length === 0) {
            const br = document.createElement("br");
            br.dataset.marker = "empty";
            lineEl.appendChild(br);
        } else {
            this.renderLineChunksWithReuse(lineData, lineIndex, lineEl, tablePool);
        }

        syncLineIndexes(container);
    }

    /**
     * 5. 청크 렌더링 및 테이블 재사용 로직 (안전장치 강화)
     */
    function renderLineChunksWithReuse(line, lineIndex, parentEl, tablePool) {
        line.chunks.forEach((chunk, chunkIndex) => {
            let el;
            
            // 테이블 타입인 경우 풀에서 우선 추출
            if (chunk.type === 'table') {
                el = (tablePool && tablePool.length > 0) ? tablePool.shift() : null;
            }

            // 풀에 없거나 테이블이 아닌 경우 새로 렌더링
            if (!el) {
                const renderer = rendererRegistry[chunk.type];
                if (!renderer) return;
                el = renderer.render(chunk, lineIndex, chunkIndex);
            }

            // 공통 속성 부여
            el.dataset.index = chunkIndex; // 혹시몰라서 남김
            el.dataset.lineIndex = lineIndex;
            el.dataset.chunkIndex = chunkIndex;
            el.classList.add(`chunk-${chunk.type}`);
            parentEl.appendChild(el);
        });
    }

    /**
     * 6. 단순 텍스트 업데이트 (DOM 탐색 최적화)
     */
    function renderChunk(lineIndex, chunkIndex, chunkData, targetKey) {
        const container = getTargetElement(targetKey);
        const lineEl = container?.children[lineIndex];
        if (!lineEl) return;

        // dataset.index를 이용해 정확한 청크 엘리먼트 탐색
        const chunkEl = Array.from(lineEl.children).find(
            el => el.dataset.index == chunkIndex
        );

        if (chunkEl && chunkData.type === 'text') {
            if (chunkEl.textContent !== chunkData.text) {
                chunkEl.textContent = chunkData.text;
            }
            // 스타일 일괄 적용
            Object.assign(chunkEl.style, chunkData.style || {});
        } else {
            // 텍스트가 아니거나 청크가 없으면 전체 라인 리렌더링
            this.renderLine(lineIndex, chunkData, targetKey);
        }
    }

    /**
     * DOM 기준으로 lineIndex / chunkIndex 재동기화
     * ⚠️ 렌더링 아님 (dataset만 수정)
     */
    function syncLineIndexes(container) {
        if (!container) return;

        const lines = container.children;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const lineEl = lines[lineIndex];
            if (!lineEl || !lineEl.classList.contains('text-block')) continue;

            // 1️⃣ 라인 인덱스 재설정
            lineEl.dataset.lineIndex = lineIndex;

            // 2️⃣ 청크 인덱스 재설정
            let chunkIndex = 0;

            for (const child of lineEl.children) {
                if (!child.classList.contains('chunk-text') &&
                    !child.classList.contains('chunk-table') &&
                    !child.dataset.chunkIndex) {
                    continue;
                }

                child.dataset.lineIndex  = lineIndex;
                child.dataset.chunkIndex = chunkIndex++;
            }
        }
    }    

    return {
        render(state, targetKey) {
            syncParagraphCount(state, targetKey);
            state.forEach((line, i) => this.renderLine(i, line, targetKey));
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
            
            const target = container.children[lineIndex];
            if (target) container.insertBefore(newEl, target);
            else container.appendChild(newEl);
        },

        removeLine(lineIndex, targetKey) {
            const container = getTargetElement(targetKey);
            const target = container?.children[lineIndex];
            if (target) container.removeChild(target);
        },

        renderLine,
        renderLineChunksWithReuse,
        renderChunk
    };
}
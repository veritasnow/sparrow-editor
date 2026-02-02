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
        console.log("test..!! lineIndex :", lineIndex);
        console.log("test..!! lineData :", lineData);

        const container = getTargetElement(targetKey);
        if (!container) return;

        //let lineEl = container.children[lineIndex];
        let lineEl = container.querySelector(`[data-line-index="${lineIndex}"]`);
        // 🚩 [추가] 인덱스로 못 찾았다면, 아직 번호가 없는(초기 상태) 첫 번째 자식을 재활용
        if (!lineEl) {
            lineEl = Array.from(container.children).find(el => !el.hasAttribute('data-line-index'));
        }        
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
     * 부분 렌더링(Virtual Scroll) 대응 버전
     */
    function syncLineIndexes(container) {
        if (!container || !container.children.length) return;

        const lines = container.children;

        // 1️⃣ 기준점 찾기 (가장 중요)
        // DOM에 있는 첫 번째 요소가 가진 lineIndex를 시작점으로 잡습니다.
        // 만약 인덱스가 없는 요소라면 0으로 시작하게 유도합니다.
        let baseIndex = parseInt(lines[0].dataset.lineIndex);
        if (isNaN(baseIndex)) baseIndex = 0;

        for (let i = 0; i < lines.length; i++) {
            const lineEl = lines[i];
            
            // text-block이 아닌 요소(가령 임시 UI 등)는 건너뜁니다.
            if (!lineEl.classList.contains('text-block')) continue;

            // 2️⃣ 상대적 인덱스 부여
            // 'DOM의 첫 번째 요소 인덱스 + 현재 루프 순서'를 통해 
            // 전체 데이터상의 위치를 유지하면서 번호를 업데이트합니다.
            const currentLineIndex = baseIndex + i;
            lineEl.dataset.lineIndex = currentLineIndex;

            // 3️⃣ 자식 청크들의 인덱스도 동기화
            let chunkIndex = 0;
            for (const child of lineEl.children) {
                // 속성값이 존재하는 요소만 처리
                if (child.dataset) {
                    child.dataset.lineIndex = currentLineIndex;
                    
                    // chunk-text, chunk-table 등 실제 데이터 유닛인 경우만 chunkIndex 증가
                    if (child.classList.contains('chunk-text') || 
                        child.classList.contains('chunk-table') || 
                        child.dataset.chunkIndex !== undefined) {
                        child.dataset.chunkIndex = chunkIndex++;
                    }
                }
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
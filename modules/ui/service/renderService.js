/**
 * 에디터의 상태(State)를 DOM에 렌더링하고 DOM 구조를 관리하는 서비스 팩토리입니다.
 */
export function createRenderService({ rootId, rendererRegistry }) { 
    
    /**
     * 💡 내부 유틸: targetKey가 있으면 해당 ID의 엘리먼트를, 없으면 기본 rootId 엘리먼트를 반환합니다.
     */
    function getTargetElement(targetKey) {
        const id = targetKey || rootId;
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`[RenderService] Target element with ID '${id}' not found.`);
        }
        return el;
    }

    /**
     * 에디터의 State 배열 길이와 DOM의 P 태그 개수를 일치시켜 동기화합니다.
     */
    function syncParagraphCount(state, targetKey) {
        const container = getTargetElement(targetKey);
        if (!container) return;

        const lines = Array.from(container.children);
        if (state.length > lines.length) {
            const newLines = state.slice(lines.length);
            newLines.forEach(() => {
                const p = document.createElement("p");
                p.className = "text-block";
                container.appendChild(p);
            });
        } else if (state.length < lines.length) {
            while (container.children.length > state.length) {
                container.removeChild(container.lastChild);
            }
        }
    }

    /**
     * 라인 내부의 청크들을 순회하며 렌더러를 통해 DOM을 생성합니다.
     */
    function renderLineChunks(line, parentEl) {
        line.chunks.forEach((chunk, chunkIndex) => {
            const renderer = rendererRegistry[chunk.type];
            if (!renderer || typeof renderer.render !== "function") return;

            const el = renderer.render(chunk);
            el.dataset.index = chunkIndex;
            el.classList.add(`chunk-${chunk.type}`);
            parentEl.appendChild(el);
        });
    }

    // -----------------------------------------------------
    // 💡 구조적 DOM 조작 함수 (targetKey 지원)
    // -----------------------------------------------------

    function insertLine(lineIndex, align = "left", targetKey) {
        const container = getTargetElement(targetKey);
        if (!container) return;

        const children = container.children;
        const newP = document.createElement("p");
        newP.className = "text-block";
        newP.style.textAlign = align;

        if (children[lineIndex]) {
            container.insertBefore(newP, children[lineIndex]);
        } else {
            container.appendChild(newP);
        }
    }

    function removeLine(lineIndex, targetKey) {
        const container = getTargetElement(targetKey);
        if (!container) return;

        const lineToRemove = container.children[lineIndex];
        if (lineToRemove) {
            container.removeChild(lineToRemove);
        }
    }

    // -----------------------------------------------------
    // 💡 공개 API
    // -----------------------------------------------------

    return {
        /**
         * 전체 상태 렌더링
         */
        render(state, targetKey) {
            const container = getTargetElement(targetKey);
            if (!container) return;

            syncParagraphCount(state, targetKey);

            state.forEach((line, i) => {
                const p = container.children[i];
                if (!p) return;
                p.innerHTML = "";
                p.style.textAlign = line.align || "left";
                renderLineChunks(line, p);
            });
        },

        /**
         * 최소 1개 라인 보장
         */
        ensureFirstLineP(targetKey) {
            const container = getTargetElement(targetKey);
            if (!container || container.children.length > 0) return;

            const firstP = document.createElement("p");
            firstP.className = "text-block";
            container.appendChild(firstP);
        },

        /**
         * 특정 라인 업데이트
         */
        renderLine(lineIndex, lineData, targetKey) {
            const container = getTargetElement(targetKey);
            if (!container) return;

            const existingP = container.children[lineIndex];
            const p = existingP || document.createElement("p");
            if (!existingP) container.appendChild(p);

            p.className = "text-block";
            p.style.textAlign = lineData.align || "left";
            p.innerHTML = "";

            if (!lineData.chunks || lineData.chunks.length === 0) {
                const br = document.createElement("br");
                br.dataset.marker = "empty";
                p.appendChild(br);
            } else {
                renderLineChunks(lineData, p);
            }
        },
        
        /**
         * 특정 청크 부분 업데이트
         */
        renderChunk(lineIndex, chunkIndex, chunkData, targetKey) {
            const container = getTargetElement(targetKey);
            if (!container) return;

            const lineEl = container.children[lineIndex];
            if (!lineEl) return;

            const chunkEl = Array.from(lineEl.children).find(
                (el) => parseInt(el.dataset.index, 10) === chunkIndex
            );

            const renderer = rendererRegistry[chunkData.type];
            if (!renderer || typeof renderer.render !== "function") return;

            if (chunkEl) {
                // 텍스트 업데이트
                if (chunkEl.textContent !== chunkData.text) {
                    chunkEl.textContent = chunkData.text;
                }
                // 스타일 업데이트
                Object.entries(chunkData.style || {}).forEach(([key, value]) => {
                    chunkEl.style[key] = value;
                });
            } else {
                const newEl = renderer.render(chunkData);
                newEl.dataset.index = chunkIndex;
                newEl.classList.add(`chunk-${chunkData.type}`);
                lineEl.appendChild(newEl);
            }
        },

        /**
         * DOM 엘리먼트 순서 밀기 (기존 로직 유지)
         */
        shiftLinesDown(fromIndex, targetKey) {
            const container = getTargetElement(targetKey);
            if (!container) return;

            const children = Array.from(container.children);
            for (let i = children.length - 1; i >= fromIndex; i--) {
                const line = children[i];
                const nextSibling = line.nextSibling;
                if (nextSibling) {
                    container.insertBefore(line, nextSibling.nextSibling);
                } else {
                    container.appendChild(line);
                }
            }
        },

        insertLine,
        removeLine,
    };
}
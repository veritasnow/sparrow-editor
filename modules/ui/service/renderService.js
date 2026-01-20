/**
 * 에디터의 상태(State)를 DOM에 렌더링하고 DOM 구조를 관리하는 서비스 팩토리입니다.
 */
export function createRenderService({ rootId, rendererRegistry }) { 
    
    function getTargetElement(targetKey) {
        const id = targetKey || rootId;
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`[RenderService] Target element with ID '${id}' not found.`);
        }
        return el;
    }

    /**
     * 에디터의 State 배열 길이와 DOM의 .text-block 개수를 일치시켜 동기화합니다.
     */
    function syncParagraphCount(state, targetKey) {
        const container = getTargetElement(targetKey);
        if (!container) return;

        // p 태그 대신 클래스명으로 라인을 선택합니다.
        const lines = Array.from(container.querySelectorAll(':scope > .text-block'));
        
        if (state.length > lines.length) {
            const diff = state.length - lines.length;
            for (let i = 0; i < diff; i++) {
                const div = document.createElement("div");
                div.className = "text-block";
                container.appendChild(div);
            }
        } else if (state.length < lines.length) {
            for (let i = lines.length - 1; i >= state.length; i--) {
                container.removeChild(lines[i]);
            }
        }
    }

    //function renderLineChunks(line, parentEl) {
    function renderLineChunks(line, lineIndex, parentEl) {
        line.chunks.forEach((chunk, chunkIndex) => {
            const renderer = rendererRegistry[chunk.type];
            if (!renderer || typeof renderer.render !== "function") return;

            const el = renderer.render(chunk, lineIndex, chunkIndex);
            //const el = renderer.render(chunk);
            el.dataset.index = chunkIndex;
            el.classList.add(`chunk-${chunk.type}`);
            parentEl.appendChild(el);
        });
    }

    // -----------------------------------------------------
    // 💡 구조적 DOM 조작 함수
    // -----------------------------------------------------

    function insertLine(lineIndex, align = "left", targetKey) {
        const container = getTargetElement(targetKey);
        if (!container) return;

        const lines = Array.from(container.querySelectorAll(':scope > .text-block'));
        const newDiv = document.createElement("div");
        newDiv.className = "text-block";
        newDiv.style.textAlign = align;

        if (lines[lineIndex]) {
            container.insertBefore(newDiv, lines[lineIndex]);
        } else {
            container.appendChild(newDiv);
        }
    }

    function removeLine(lineIndex, targetKey) {
        const container = getTargetElement(targetKey);
        if (!container) return;

        const lines = Array.from(container.querySelectorAll(':scope > .text-block'));
        if (lines[lineIndex]) {
            container.removeChild(lines[lineIndex]);
        }
    }

    return {
        render(state, targetKey) {
            const container = getTargetElement(targetKey);
            if (!container) return;

            syncParagraphCount(state, targetKey);

            const updatedLines = Array.from(container.querySelectorAll(':scope > .text-block'));
            state.forEach((line, i) => {
                const lineEl = updatedLines[i];
                if (!lineEl) return;
                lineEl.innerHTML = "";
                lineEl.style.textAlign = line.align || "left";
                //renderLineChunks(line, lineEl);
                renderLineChunks(line, i, lineEl);
            });
        },

        ensureFirstLine(targetKey) {
            const container = getTargetElement(targetKey);
            if (!container) return;
            
            const lines = container.querySelectorAll(':scope > .text-block');
            if (lines.length > 0) return;

            const firstDiv = document.createElement("div");
            firstDiv.className = "text-block";
            container.appendChild(firstDiv);
        },

        renderLine(lineIndex, lineData, targetKey) {
            const container = getTargetElement(targetKey);
            if (!container) return;

            const lines = Array.from(container.querySelectorAll(':scope > .text-block'));
            let lineEl = lines[lineIndex];
            
            // 1. 해당 인덱스에 라인 엘리먼트가 없으면 생성
            if (!lineEl) {
                lineEl = document.createElement("div");
                lineEl.className = "text-block";
                container.appendChild(lineEl);
            }

            // 2. [중요] 기존 라인에 이미 존재하던 테이블 DOM들을 순서대로 백업 (Pool)
            // 클래스명(.chunk-table)을 기반으로 현재 DOM에 그려진 테이블들을 모두 가져옵니다.
            const tablePool = Array.from(lineEl.querySelectorAll('.chunk-table'));

            // 3. 라인 기본 스타일 설정 및 내부 초기화
            lineEl.className = "text-block";
            lineEl.style.textAlign = lineData.align || "left";
            
            // innerHTML을 비우기 전에 자식 노드들이 참조를 잃지 않도록 주의해야 하지만,
            // tablePool에 이미 담아두었으므로 메모리상에는 존재합니다.
            lineEl.innerHTML = "";

            // 4. 청크 데이터가 없는 경우 처리
            if (!lineData.chunks || lineData.chunks.length === 0) {
                const br = document.createElement("br");
                br.dataset.marker = "empty";
                lineEl.appendChild(br);
            } else {
                // 5. 백업된 Pool을 사용하여 청크 렌더링 실행
                this.renderLineChunksWithReuse(lineData, lineIndex, lineEl, tablePool);
            }
        },

        renderLineChunksWithReuse(line, lineIndex, parentEl, tablePool) {
            line.chunks.forEach((chunk, chunkIndex) => {
                // 💡 테이블 타입을 만났을 때
                if (chunk.type === 'table') {
                    // 💡 Pool에서 가장 앞에 있는 테이블 DOM을 하나 꺼냄 (Shift)
                    const oldTable = tablePool.shift();
                    
                    if (oldTable) {
                        // 💡 위치(인덱스) 정보만 최신 데이터로 업데이트
                        oldTable.dataset.lineIndex = lineIndex;
                        oldTable.dataset.chunkIndex = chunkIndex;
                        oldTable.dataset.index = chunkIndex;
                        
                        parentEl.appendChild(oldTable);
                        console.log(`[Reuse] 테이블 DOM 재사용 성공 (ChunkIndex: ${chunkIndex})`);
                        return; 
                    }
                }

                // 일반 텍스트나 새로 추가된 테이블(백업본이 없는 경우)은 새로 렌더링
                const renderer = rendererRegistry[chunk.type];
                if (!renderer) return;

                const el = renderer.render(chunk, lineIndex, chunkIndex);
                el.dataset.index = chunkIndex;
                el.classList.add(`chunk-${chunk.type}`);
                parentEl.appendChild(el);
            });
        },    
        
        renderChunk(lineIndex, chunkIndex, chunkData, targetKey) {
            const container = getTargetElement(targetKey);
            if (!container) return;

            const lines = Array.from(container.querySelectorAll(':scope > .text-block'));
            const lineEl = lines[lineIndex];
            if (!lineEl) return;

            const chunkEl = Array.from(lineEl.children).find(
                (el) => parseInt(el.dataset.index, 10) === chunkIndex
            );

            const renderer = rendererRegistry[chunkData.type];
            if (!renderer || typeof renderer.render !== "function") return;

            if (chunkEl) {
                if (chunkEl.textContent !== chunkData.text) {
                    chunkEl.textContent = chunkData.text;
                }
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

        shiftLinesDown(fromIndex, targetKey) {
            const container = getTargetElement(targetKey);
            if (!container) return;

            const lines = Array.from(container.querySelectorAll(':scope > .text-block'));
            for (let i = lines.length - 1; i >= fromIndex; i--) {
                const line = lines[i];
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
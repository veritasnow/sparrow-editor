/**
 * 에디터의 상태(State)를 DOM에 렌더링하고 DOM 구조를 관리하는 서비스 팩토리입니다.
 * @param {Object} config - { rootId: string, rendererRegistry: Object }
 * @returns {Object} 렌더링 관련 공개 함수들
 */
export function createRenderService({ rootId, rendererRegistry }) { 
    
    const editorEl = document.getElementById(rootId);
    if (!editorEl) {
      console.error(`Editor root element with ID '${rootId}' not found.`);
    }

    // ────────── 내부 유틸 ──────────
    /**
     * 에디터의 State 배열 길이와 DOM의 P 태그 개수를 일치시켜 동기화합니다.
     */
    function syncParagraphCount(state) {
      if (!editorEl) return;
      const lines = Array.from(editorEl.children);
      if (state.length > lines.length) {
        const newLines = state.slice(lines.length);
        newLines.forEach(() => {
          const p = document.createElement("p");
          p.className = "text-block";
          editorEl.appendChild(p);
        });
      } else if (state.length < lines.length) {
        while (editorEl.children.length > state.length) {
          editorEl.removeChild(editorEl.lastChild);
        }
      }
    }
    // ────────── 내부 유틸 끝 ──────────


    // -----------------------------------------------------
    // 💡 구조적 DOM 조작 함수 (Key Service에서 이관)
    // -----------------------------------------------------

    /**
     * DOM에 새로운 빈 라인 엘리먼트(<p>)를 지정된 위치에 삽입합니다.
     * Enter 키 로직의 DOM 반영 부분입니다.
     * @param {number} lineIndex - 삽입할 위치 (삽입 후 이 인덱스가 새 라인의 인덱스가 됨)
     * @param {string} align - 새로 생성될 라인의 정렬 속성
     */
    function insertNewLineElement(lineIndex, align = "left") {
        if (!editorEl) return;
        const children = editorEl.children;
        const newP = document.createElement("p");
        
        newP.className = "text-block";
        newP.style.textAlign = align;

        // 지정된 위치에 삽입
        if (children[lineIndex]) {
            editorEl.insertBefore(newP, children[lineIndex]);
        } else {
            editorEl.appendChild(newP);
        }
    }

    /**
     * DOM에서 지정된 인덱스의 라인 엘리먼트(<p>)를 제거합니다.
     * Backspace (줄 병합 또는 빈 줄 삭제) 로직의 DOM 반영 부분입니다.
     * @param {number} lineIndex - 제거할 라인의 인덱스
     */
    function removeLineElement(lineIndex) {
        if (!editorEl) return;
        const lineToRemove = editorEl.children[lineIndex];

        if (lineToRemove) {
            editorEl.removeChild(lineToRemove);
        }
    }


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

    return {
        /**
         * 전체 에디터 상태를 DOM에 렌더링하여 동기화합니다. (rootId 인자 제거)
         * @param {Array<Object>} state - 에디터의 현재 상태 배열 (Line 데이터)
         */
        render(state) {
            if (!editorEl) return;
            syncParagraphCount(state);

            state.forEach((line, i) => {
              const p = editorEl.children[i];
              p.innerHTML = "";
              p.style.textAlign = line.align || "left";
              renderLineChunks(line, p);
            });
        },

        /**
         * 에디터에 내용이 없을 때 최소한 하나의 <p> 태그를 유지하도록 보장합니다. (editorId 인자 제거)
         */    
        ensureFirstLineP() {
            if (!editorEl) return;
            if (editorEl.children.length === 0) {
              const firstP = document.createElement("p");
              firstP.className = "text-block";
              editorEl.appendChild(firstP);
            }
        },

        /**
         * 특정 라인(P 엘리먼트)만 업데이트하여 재렌더링합니다. (editorId 인자 제거)
         * @param {number} lineIndex - 업데이트할 라인의 인덱스
         * @param {Object} lineData - 업데이트할 라인의 데이터 (align, chunks 포함)
         */    
        renderLine(lineIndex, lineData) {
            if (!editorEl) return;
            const existingP = editorEl.children[lineIndex];
            const p = existingP || document.createElement("p");
            if (!existingP) editorEl.appendChild(p);

            p.className = "text-block";
            p.style.textAlign = lineData.align || "left";
            p.innerHTML = "";

            if (
              !lineData.chunks ||
              lineData.chunks.length === 0 ||
              (lineData.chunks.length === 1 && lineData.chunks[0].text === "")
            ) {
              // 내용이 완전히 비었을 때 <br>을 추가하여 커서 포지션을 잡을 수 있도록 함
              const br = document.createElement("br");
              br.dataset.marker = "empty";
              p.appendChild(br);
            } else {
              renderLineChunks(lineData, p);
            }
        },

        /**
         * 특정 라인의 특정 청크(span 등)만 부분적으로 업데이트합니다. (editorId 인자 제거)
         * @param {number} lineIndex - 청크가 속한 라인의 인덱스
         * @param {number} chunkIndex - 업데이트할 청크의 인덱스
         * @param {Object} chunkData - 업데이트할 청크의 데이터
         */    
        renderChunk(lineIndex, chunkIndex, chunkData) {
            if (!editorEl) return;
            const lineEl = editorEl.children[lineIndex];
            if (!lineEl) return;

            // dataset.index를 통해 청크 엘리먼트를 찾습니다.
            const chunkEl = Array.from(lineEl.children).find(
              (el) => parseInt(el.dataset.index, 10) === chunkIndex
            );

            const renderer = rendererRegistry[chunkData.type];
            if (!renderer || typeof renderer.render !== "function") return;

            if (chunkEl) {
              // 텍스트 내용만 업데이트 (성능 최적화)
              if (chunkEl.textContent !== chunkData.text) {
                chunkEl.textContent = chunkData.text;
              }

              // 스타일 업데이트
              Object.entries(chunkData.style || {}).forEach(([key, value]) => {
                chunkEl.style[key] = value;
              });
            } else {
              // 청크가 없는 경우 새로 생성하여 추가 (드문 케이스)
              const newEl = renderer.render(chunkData);
              newEl.dataset.index = chunkIndex;
              newEl.classList.add(`chunk-${chunkData.type}`);
              lineEl.appendChild(newEl);
            }
        },

        /**
         * 특정 인덱스부터 뒤쪽의 DOM P 엘리먼트들을 아래로 한 칸씩 이동시킵니다. (editorId 인자 제거)
         * @param {number} fromIndex - 이동을 시작할 라인 인덱스
         */
        shiftLinesDown(fromIndex) {
            if (!editorEl) return;
            const children = Array.from(editorEl.children);

            for (let i = children.length - 1; i >= fromIndex; i--) {
              const line = children[i];
              const nextSibling = line.nextSibling;
              if (nextSibling) {
                editorEl.insertBefore(line, nextSibling.nextSibling);
              } else {
                editorEl.appendChild(line);
              }
            }
        },

        
        // 💡 Key Processor Service에서 이관된 DOM 구조 조작 함수 공개
        insertNewLineElement,
        removeLineElement,
    };
}

// renderService.js

/**
 * 에디터의 상태(State)를 DOM에 렌더링하고 DOM 구조를 관리하는 서비스 팩토리입니다.
 * @param {Object} rendererRegistry - 청크 타입별 렌더링 함수를 담고 있는 레지스트리 (예: { text: textRenderer, image: imageRenderer })
 * @returns {Object} 렌더링 관련 공개 함수들
 */
export function createRenderService(rendererRegistry) {
  return {
    /**
     * 전체 에디터 상태를 DOM에 렌더링하여 동기화합니다.
     * renderLine 함수들을 사용하여 전체 상태를 초기 렌더링하거나 완전히 새로고침할 때 사용됩니다.
     * @param {Array<Object>} state - 에디터의 현재 상태 배열 (Line 데이터)
     * @param {string} id - 에디터 컨테이너 엘리먼트의 ID
     */
    render(state, id) {
      const editorEl = document.getElementById(id);
      syncParagraphCount(editorEl, state);

      state.forEach((line, i) => {
        const p = editorEl.children[i];
        p.innerHTML = "";
        p.style.textAlign = line.align || "left";

        line.chunks.forEach((chunk, chunkIndex) => {
          const renderer = rendererRegistry[chunk.type];
          if (renderer && typeof renderer.render === "function") {
            const el = renderer.render(chunk);

            // ✅ chunk 단위로 data-index 부여
            el.dataset.index = chunkIndex;

            // ✅ chunk.type에 따라 보조 class 부여 (선택 사항)
            el.classList.add(`chunk-${chunk.type}`);

            p.appendChild(el);
          }
        });
      });
    },

    /**
     * 에디터에 내용이 없을 때 최소한 하나의 <p> 태그를 유지하도록 보장합니다.
     * @param {string} editorId - 에디터 컨테이너 엘리먼트의 ID
     */    
    ensureFirstLineP(editorId) {
      const editorEl = document.getElementById(editorId);
      if (!editorEl) return;
      if (editorEl.children.length === 0) {
        const firstP = document.createElement("p");
        firstP.className = "text-block";
        editorEl.appendChild(firstP);
      }
    },

    /**
     * 특정 라인(P 엘리먼트)만 업데이트하여 재렌더링합니다.
     * 입력 이벤트 처리 후 해당 라인의 DOM을 상태에 동기화할 때 주로 사용됩니다.
     * @param {string} editorId - 에디터 컨테이너 엘리먼트의 ID
     * @param {number} lineIndex - 업데이트할 라인의 인덱스
     * @param {Object} lineData - 업데이트할 라인의 데이터 (align, chunks 포함)
     */    
    renderLine(editorId, lineIndex, lineData) {
      const editorEl = document.getElementById(editorId);
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
        // 내용 없는 줄 → <br>
        p.appendChild(document.createElement("br"));
      } else {
        lineData.chunks.forEach((chunk, chunkIndex) => {
          const renderer = rendererRegistry[chunk.type];
          if (renderer && typeof renderer.render === "function") {
            const el = renderer.render(chunk);

            // ✅ chunk-level data-index 부여
            el.dataset.index = chunkIndex;
            el.classList.add(`chunk-${chunk.type}`);

            p.appendChild(el);
          }
        });
      }
    },

    /**
     * 특정 라인의 특정 청크(span 등)만 부분적으로 업데이트합니다.
     * 주로 텍스트 입력 시 성능 향상을 위해 사용됩니다.
     * @param {string} editorId - 에디터 컨테이너 엘리먼트의 ID
     * @param {number} lineIndex - 청크가 속한 라인의 인덱스
     * @param {number} chunkIndex - 업데이트할 청크의 인덱스
     * @param {Object} chunkData - 업데이트할 청크의 데이터
     */    
    renderChunk(editorId, lineIndex, chunkIndex, chunkData) {
      const editorEl = document.getElementById(editorId);
      const lineEl = editorEl.children[lineIndex];
      if (!lineEl) return;

      // 기존 chunk span 찾기
      const chunkEl = Array.from(lineEl.children).find(
        (el) => parseInt(el.dataset.index, 10) === chunkIndex
      );

      const renderer = rendererRegistry[chunkData.type];
      if (!renderer || typeof renderer.render !== "function") return;

      if (chunkEl) {
        // ✅ 기존 span이 있으면 text만 업데이트
        if (chunkEl.textContent !== chunkData.text) {
          chunkEl.textContent = chunkData.text;
        }

        // 스타일 업데이트
        Object.entries(chunkData.style || {}).forEach(([key, value]) => {
          chunkEl.style[key] = value;
        });
      } else {
        // ❌ 없으면 새로 렌더링
        const newEl = renderer.render(chunkData);
        newEl.dataset.index = chunkIndex;
        newEl.classList.add(`chunk-${chunkData.type}`);
        lineEl.appendChild(newEl);
      }
    },

    /**
     * 특정 인덱스부터 뒤쪽의 DOM P 엘리먼트들을 아래로 한 칸씩 이동시킵니다.
     * 새로운 P 태그를 삽입(예: 엔터 키 입력)할 때 DOM 구조를 맞추는 데 사용됩니다.
     * @param {string} editorId - 에디터 컨테이너 엘리먼트의 ID
     * @param {number} fromIndex - 이동을 시작할 라인 인덱스
     */
    shiftLinesDown(editorId, fromIndex) {
      const editorEl = document.getElementById(editorId);
      const children = Array.from(editorEl.children);

      // 새 줄 바로 뒤부터 이동
      for (let i = children.length - 1; i >= fromIndex; i--) {
        const line = children[i];
        const nextSibling = line.nextSibling;
        if (nextSibling) {
          editorEl.insertBefore(line, nextSibling.nextSibling);
        } else {
          editorEl.appendChild(line);
        }
      }
    }
  };
}

// ────────── 내부 유틸 ──────────
/**
 * 에디터의 State 배열 길이와 DOM의 P 태그 개수를 일치시켜 동기화합니다.
 * State에 비해 P 태그가 부족하면 추가하고, 많으면 제거합니다.
 * @param {HTMLElement} editorEl - 에디터 컨테이너 엘리먼트
 * @param {Array<Object>} state - 에디터의 현재 상태 배열
 */
function syncParagraphCount(editorEl, state) {
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

// renderService.js
export function createRenderService(rendererRegistry) {
  return {
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

    ensureFirstLineP(editorId) {
      const editorEl = document.getElementById(editorId);
      if (!editorEl) return;
      if (editorEl.children.length === 0) {
        const firstP = document.createElement("p");
        firstP.className = "text-block";
        editorEl.appendChild(firstP);
      }
    },

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

    // ────────── 새 함수: 기존 줄 뒤 DOM 밀기 ──────────
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

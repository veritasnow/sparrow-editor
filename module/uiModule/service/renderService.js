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

        line.chunks.forEach(chunk => {
          const renderer = rendererRegistry[chunk.type];
          if (renderer && typeof renderer.render === "function") {
            const el = renderer.render(chunk);
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
        firstP.dataset.lineIndex = 0;
        editorEl.appendChild(firstP);
      }
    }
  };
}

function syncParagraphCount(editorEl, state) {
  const lines = Array.from(editorEl.children);
  if (state.length > lines.length) {
    const newLines = state.slice(lines.length);
    newLines.forEach((_, idx) => {
      const p = document.createElement("p");
      p.className = "text-block";
      p.dataset.lineIndex = lines.length + idx;
      editorEl.appendChild(p);
    });
  } else if (state.length < lines.length) {
    while (editorEl.children.length > state.length) {
      editorEl.removeChild(editorEl.lastChild);
    }
  }
}

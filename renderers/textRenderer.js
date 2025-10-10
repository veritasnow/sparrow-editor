// textRenderer.js
export const textRenderer = {
  render(chunk) {
    const span = document.createElement("span");
    span.textContent = chunk.text || "";
    if (chunk.style) Object.assign(span.style, chunk.style);
    return span;
  }
};
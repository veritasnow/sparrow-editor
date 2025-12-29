// textRenderer.js
export const textRenderer = {
  render(chunk, index) {
    const span = document.createElement("span");
    span.className = "chunk-text";
    span.dataset.index = index; // 인덱스 관리용

    // 💡 핵심: 텍스트가 없으면 \u200B (Zero-Width Space)를 넣어서 
    // 브라우저가 커서를 잡을 수 있게 합니다.
    const content = chunk.text === "" ? "\u200B" : chunk.text;
    span.textContent = content;

    if (chunk.style) {
        Object.assign(span.style, chunk.style);
    }
    return span;
  }
};
export function bindInputEvent(editorEl, app, ui) {
  editorEl.addEventListener('input', () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    ui.ensureFirstLine();

    const range = selection.getRangeAt(0);
    const container = range.startContainer;

    // 현재 입력이 속한 <p>
    const parentP = container.nodeType === Node.TEXT_NODE
      ? container.parentElement.closest('p')
      : container.closest('p');
    if (!parentP) return;

    const lineIndex = Array.prototype.indexOf.call(editorEl.children, parentP);
    if (lineIndex < 0) return;

    const currentState = app.getState().present.editorState;
    const currentLine = currentState[lineIndex] || { align: "left", chunks: [] };

    let updatedChunks = [...currentLine.chunks];
    let textNodeIndex = 0;
    let acc = 0;

    // <p> 안의 모든 자식 노드를 순회
    parentP.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const chunk = currentLine.chunks[textNodeIndex] || { type: 'text', text: '', style: {} };
        // chunk를 덮어쓰기 대신, 해당 텍스트 노드 내용으로 업데이트
        updatedChunks[textNodeIndex] = { ...chunk, text: node.textContent };
        textNodeIndex++;
      } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SPAN') {
        const chunk = currentLine.chunks[textNodeIndex] || { type: 'text', text: '', style: {} };
        updatedChunks[textNodeIndex] = { ...chunk, text: node.textContent };
        textNodeIndex++;
      } else {
        // iframe, img 등 non-text 요소는 chunk로 만들지 않고 패스
      }
    });

    const nextState = [...currentState];
    nextState[lineIndex] = { ...currentLine, chunks: updatedChunks };

    app.saveEditorState(nextState);
  });
}
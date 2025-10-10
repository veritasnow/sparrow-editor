export function bindInputEvent(editorEl, app, ui) {
  editorEl.addEventListener('input', () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    ui.ensureFirstLine();

    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    let parentP = container.nodeType === Node.TEXT_NODE
      ? container.parentElement.closest('p')
      : container.closest('p');
    if (!parentP) return;

    const lineIndex = parseInt(parentP.dataset.lineIndex, 10);
    const newText = parentP.textContent;

    const currentState = app.getState().present.editorState;
    const line = currentState[lineIndex];

    const newChunks = line.chunks.length
      ? line.chunks.map(chunk => ({ ...chunk, text: newText }))
      : [{ type: 'text', text: newText, style: {} }];

    const nextState = [...currentState];
    nextState[lineIndex] = { ...line, chunks: newChunks };

    app.saveEditorState(nextState);
  });
}
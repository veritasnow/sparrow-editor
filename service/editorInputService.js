export function bindInputEvent(editorEl, app, ui) {
  let composing = false;
  let lastCompositionEnd = 0;

  editorEl.addEventListener('compositionstart', () => {
    composing = true;
  });

  editorEl.addEventListener('compositionend', () => {
    composing = false;
    lastCompositionEnd = Date.now();
    handleInput();
  });

  editorEl.addEventListener('input', (e) => {
    // 개행 중복 방지
    if (e.inputType === 'insertParagraph') return;

    // --- ⭐ 수정된 부분 시작 ⭐ ---
    // 조합 직후 자동 input 무시 로직
    const timeSinceCompositionEnd = Date.now() - lastCompositionEnd;

    // e.data는 input 이벤트에 의해 삽입된 문자열을 포함합니다.
    const inputData = e.data || '';
    
    // 1. inputType이 'insertText'이고,
    // 2. 입력된 데이터가 마침표(.) 또는 공백( )일 경우
    //    (이들은 IME 조합을 끝내고 바로 발생하는 중요한 입력일 가능성이 높음)
    const isPunctuationOrSpace = e.inputType === 'insertText' && (inputData === '.' || inputData === ' ');

    // 일반적인 자동 input (e.g., 한글 조합 완료 후 브라우저가 다시 텍스트를 확정하는 과정)을 무시합니다.
    // 단, 마침표나 공백 입력일 경우에는 이 무시 로직을 건너뜁니다.
    if (!isPunctuationOrSpace && timeSinceCompositionEnd < 50) {
      return;
    }
    // --- ⭐ 수정된 부분 끝 ⭐ ---

    if (!composing) handleInput();
  });

  function handleInput() {
    // ... (이하 handleInput 함수는 변경 없이 그대로 유지) ...
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    ui.ensureFirstLine();

    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    const cursorOffset = range.startOffset;

    const parentP = container.nodeType === Node.TEXT_NODE
      ? container.parentElement.closest('p')
      : container.closest('p');
    if (!parentP) return;

    const lineIndex = Array.prototype.indexOf.call(editorEl.children, parentP);
    if (lineIndex < 0) return;

    const currentState = app.getState().present.editorState;
    const currentLine = currentState[lineIndex] || { align: "left", chunks: [] };

    const activeNode = container.nodeType === Node.TEXT_NODE
      ? container.parentElement.closest('[data-index]')
      : container.closest('[data-index]');
    const dataIndex = activeNode ? parseInt(activeNode.dataset.index, 10) : null;

    const updatedLine = { ...currentLine, chunks: [...currentLine.chunks] };
    let isNewChunk = false;
    let isChunkRendering = false;

    if (dataIndex !== null && updatedLine.chunks[dataIndex]) {
      const oldChunk = updatedLine.chunks[dataIndex];
      const newText = activeNode.textContent;

      if (oldChunk.text !== newText) {
        updatedLine.chunks[dataIndex] = { ...oldChunk, text: newText };
        isChunkRendering = true;
      }
    } else {
      const newText = container.textContent || '';
      updatedLine.chunks = [{ type: 'text', text: newText, style: {} }];
      isNewChunk = true;
    }

    const nextState = [...currentState];
    nextState[lineIndex] = updatedLine;
    app.saveEditorState(nextState);

    if (isNewChunk) {
      ui.renderLine(editorEl.id, lineIndex, updatedLine);
      ui.restoreSelectionPositionByChunk({
        lineIndex,
        chunkIndex: 0,
        offset: updatedLine.chunks[0].text.length
      });
    } else if (isChunkRendering) {
      ui.renderChunk(editorEl.id, lineIndex, dataIndex, updatedLine.chunks[dataIndex]);
      ui.restoreSelectionPositionByChunk({
        lineIndex,
        chunkIndex: dataIndex,
        offset: cursorOffset
      });
    }
  }
}
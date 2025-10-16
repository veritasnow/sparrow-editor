// ────────── 기존 bindKeydownEvent (리팩토링) ──────────
export function bindKeydownEvent(editorEl, app, ui) {
  editorEl.addEventListener("keydown", (e) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const currentState = app.getState().present.editorState;
    const ranges = ui.getSelectionRangesInState(currentState);
    if (!ranges || ranges.length === 0) return;

    const { lineIndex, endIndex: offset } = ranges[0];

    if (e.key === "Enter") {
      e.preventDefault();
      handleEnterKey(app, ui, editorEl, lineIndex, offset);
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      handleBackspaceKey(app, ui, editorEl, lineIndex, offset);
    }
  });
}


// ────────── enter 처리 함수 ──────────
export function handleEnterKey(app, ui, editorEl, lineIndex, offset) {
  const currentState = app.getState().present.editorState;
  const nextState   = [...currentState];
  const currentLine = currentState[lineIndex];
  const lineChunks  = currentLine.chunks;

  const textBeforeCursor = [];
  const textAfterCursor = [];
  let acc = 0;

  lineChunks.forEach(chunk => {
    const start = acc;
    const end = acc + chunk.text.length;

    if (offset <= start) textAfterCursor.push({ ...chunk });
    else if (offset >= end) textBeforeCursor.push({ ...chunk });
    else {
      textBeforeCursor.push({ ...chunk, text: chunk.text.slice(0, offset - start) });
      textAfterCursor.push({ ...chunk, text: chunk.text.slice(offset - start) });
    }
    acc = end;
  });

  // 상태 업데이트
  nextState[lineIndex] = {
    align: currentLine.align,
    chunks: textBeforeCursor.length ? textBeforeCursor : [{ type: "text", text: "", style: {} }]
  };

  const newLineData = {
    align: currentLine.align,
    chunks: textAfterCursor.length ? textAfterCursor : [{ type: "text", text: "", style: {} }]
  };

  nextState.splice(lineIndex + 1, 0, newLineData);
  app.saveEditorState(nextState);

  // DOM 반영
  const editorDomChildren = editorEl.children;
  const newP = document.createElement("p");
  newP.className = "text-block";
  newP.style.textAlign = newLineData.align || "left";
  if (editorDomChildren[lineIndex]) {
    editorEl.insertBefore(newP, editorDomChildren[lineIndex + 1] || null);
  } else {
    editorEl.appendChild(newP);
  }

  // 렌더링
  ui.renderLine(editorEl.id, lineIndex, nextState[lineIndex]);
  ui.renderLine(editorEl.id, lineIndex + 1, newLineData);

  // 커서 이동
  ui.restoreSelectionPosition({ lineIndex: lineIndex + 1, offset: 0 });
}



// ────────── backspace 처리 함수 ──────────
export function handleBackspaceKey(app, ui, editorEl, lineIndex, offset) {
  const currentState = app.getState().present.editorState;
  const nextState = [...currentState];
  const currentLine = currentState[lineIndex];
  const lineChunks = currentLine.chunks.map(c => ({ ...c })); // 안전 복제
  const editorDomChildren = editorEl.children;
  let newPos = null;

  // 1️⃣ 줄 병합
  if (offset === 0 && lineIndex > 0) {
    const prevLine = nextState[lineIndex - 1];
    const currLine = nextState[lineIndex];

    // 안전하게 복제 후 병합
    const mergedChunks = [
      ...(prevLine.chunks || []).map(c => ({ ...c })),
      ...(currLine.chunks || []).map(c => ({ ...c }))
    ].filter(c => c && c.text.length > 0);

    nextState[lineIndex - 1] = {
      align: prevLine.align,
      chunks: mergedChunks.length ? mergedChunks : [{ type: "text", text: "", style: {} }]
    };

    nextState.splice(lineIndex, 1);
    app.saveEditorState(nextState);

    // DOM 반영
    ui.renderLine(editorEl.id, lineIndex - 1, nextState[lineIndex - 1]);
    if (editorDomChildren[lineIndex]) editorEl.removeChild(editorDomChildren[lineIndex]);

    const prevOffset = nextState[lineIndex - 1].chunks.reduce((sum, c) => sum + c.text.length, 0);
    ui.restoreSelectionPosition({ lineIndex: lineIndex - 1, offset: prevOffset });
    return;
  }

  // 2️⃣ 한 글자 삭제
  let acc = 0;
  const newChunks = [];

  for (const chunk of lineChunks) {
    const start = acc;
    const end = acc + chunk.text.length;

    if (offset <= start) newChunks.push({ ...chunk });
    else if (offset > end) newChunks.push({ ...chunk });
    else {
      const localOffset = offset - start;
      const newText = chunk.text.slice(0, localOffset - 1) + chunk.text.slice(localOffset);
      if (newText.length > 0) newChunks.push({ ...chunk, text: newText });
      newPos = { lineIndex, offset: offset - 1 };
    }
    acc = end;
  }

  // 3️⃣ 빈 줄 처리
  if (newChunks.length === 0) {
    if (lineIndex === 0) {
      nextState[0] = { align: nextState[0].align || "left", chunks: [{ type: "text", text: "", style: {} }] };
      app.saveEditorState(nextState);
      ui.renderLine(editorEl.id, 0, nextState[0]);
      ui.restoreSelectionPosition({ lineIndex: 0, offset: 0 });
      return;
    }

    nextState.splice(lineIndex, 1);
    if (editorDomChildren[lineIndex]) editorEl.removeChild(editorDomChildren[lineIndex]);
    app.saveEditorState(nextState);

    const prevLine = nextState[lineIndex - 1];
    const prevOffset = prevLine.chunks.reduce((sum, c) => sum + c.text.length, 0);
    newPos = { lineIndex: lineIndex - 1, offset: prevOffset };
  } else {
    nextState[lineIndex] = { ...currentLine, chunks: newChunks };
    app.saveEditorState(nextState);
    ui.renderLine(editorEl.id, lineIndex, nextState[lineIndex]);
  }

  if (newPos) ui.restoreSelectionPosition(newPos);
}

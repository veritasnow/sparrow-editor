export function bindKeydownEvent(editorEl, app, ui, updateAndRestore) {
  editorEl.addEventListener('keydown', (e) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const currentState = app.getState().present.editorState;
    const ranges = ui.getSelectionRangesInState(currentState);
    if (!ranges || ranges.length === 0) return;

    const { lineIndex, endIndex: offset } = ranges[0];
    const nextState = [...currentState];
    let newPos;

    const currentLine = currentState[lineIndex];
    const lineChunks = currentLine.chunks;

    // ───────── Enter 처리 ─────────
    if (e.key === 'Enter') {
      e.preventDefault();

      const textBeforeCursor = [];
      const textAfterCursor = [];
      let acc = 0;

      lineChunks.forEach(chunk => {
        const start = acc;
        const end = acc + chunk.text.length;

        if (offset <= start) {
          textAfterCursor.push({ ...chunk });
        } else if (offset >= end) {
          textBeforeCursor.push({ ...chunk });
        } else {
          textBeforeCursor.push({ ...chunk, text: chunk.text.slice(0, offset - start) });
          textAfterCursor.push({ ...chunk, text: chunk.text.slice(offset - start) });
        }
        acc = end;
      });

      nextState[lineIndex] = {
        align: currentLine.align,
        chunks: textBeforeCursor.length
          ? textBeforeCursor
          : [{ type: "text", text: "", style: {} }] // ✅ 보장
      };

      nextState.splice(lineIndex + 1, 0, {
        align: currentLine.align, // ✅ 기존 정렬 유지
        chunks: textAfterCursor.length
          ? textAfterCursor.map(c => ({
              type: c.type || "text",
              text: c.text || "",
              style: c.style || {}
            }))
          : [{ type: "text", text: "", style: {} }] // ✅ 보장
      });

      app.saveEditorState(nextState);
      updateAndRestore({ lineIndex: lineIndex + 1, offset: 0 });
    }

    // ───────── Backspace 처리 ─────────
    else if (e.key === 'Backspace') {
      e.preventDefault();

      if (offset === 0 && lineIndex > 0) {
        // 문단 병합
        const prevLine = nextState[lineIndex - 1];
        const currLine = nextState[lineIndex];

        const mergedChunks = [...prevLine.chunks, ...currLine.chunks];
        nextState[lineIndex - 1] = {
          align: prevLine.align, // 이전 문단 정렬 유지
          chunks: mergedChunks
        };
        nextState.splice(lineIndex, 1);

        newPos = {
          lineIndex: lineIndex - 1,
          offset: prevLine.chunks.reduce((sum, c) => sum + c.text.length, 0)
        };
      } else {
        // 현재 줄에서 한 글자 삭제
        let acc = 0;
        const newChunks = [];
        for (const chunk of lineChunks) {
          const start = acc;
          const end = acc + chunk.text.length;

          if (offset <= start) newChunks.push({ ...chunk });
          else if (offset > end) newChunks.push({ ...chunk });
          else {
            const localOffset = offset - start;
            const text = chunk.text.slice(0, localOffset - 1) + chunk.text.slice(localOffset);
            if (text) newChunks.push({ ...chunk, text });
            newPos = { lineIndex, offset: offset - 1 };
          }
          acc = end;
        }

        nextState[lineIndex] = { ...currentLine, chunks: newChunks };
      }

      app.saveEditorState(nextState);
      if (newPos) updateAndRestore(newPos);
    }
  });
}
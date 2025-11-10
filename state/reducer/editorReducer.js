// reducer/editorReducer.js
// patch를 실제 state에 반영하는 순수 함수
export function editorReducer(state, patch) {
  const { editorState } = state;
  const { action, payload, undo } = patch;

  switch (action) {
    // 텍스트 삽입
    case "insertText": {
      const { lineIndex, offset, text } = payload;
      const line = editorState[lineIndex] || "";

      if (undo) {
        // 삽입 취소 → 입력한 text 삭제
        const newLine =
          line.slice(0, offset) + line.slice(offset + text.length);
        const newEditorState = [...editorState];
        newEditorState[lineIndex] = newLine;

        return { ...state, editorState: newEditorState };
      } else {
        // 삽입
        const newLine =
          line.slice(0, offset) + text + line.slice(offset);
        const newEditorState = [...editorState];
        newEditorState[lineIndex] = newLine;

        return { ...state, editorState: newEditorState };
      }
    }

    // 텍스트 삭제
    case "deleteText": {
      const { lineIndex, offset, length } = payload;
      const line = editorState[lineIndex] || "";

      if (undo) {
        // 삭제 취소 → 삭제된 부분 복원
        const { deletedText } = payload;
        const newLine =
          line.slice(0, offset) + deletedText + line.slice(offset);
        const newEditorState = [...editorState];
        newEditorState[lineIndex] = newLine;

        return { ...state, editorState: newEditorState };
      } else {
        // 삭제
        const deletedText = line.slice(offset, offset + length);
        const newLine =
          line.slice(0, offset) + line.slice(offset + length);
        const newEditorState = [...editorState];
        newEditorState[lineIndex] = newLine;

        // 삭제된 텍스트도 payload에 저장 → undo에서 복원할 수 있게
        return {
          ...state,
          editorState: newEditorState
        };
      }
    }

    // 스타일 토글
    case "toggleStyle": {
      const { lineIndex, start, end, styleKey, styleValue } = payload;
      const line = editorState[lineIndex] || [];

      const newEditorState = [...editorState];
      newEditorState[lineIndex] = line.map((block, idx) => {
        if (idx < start || idx >= end) return block;
        return {
          ...block,
          style: { ...block.style, [styleKey]: styleValue }
        };
      });

      return { ...state, editorState: newEditorState };
    }

    default:
      return state;
  }
}

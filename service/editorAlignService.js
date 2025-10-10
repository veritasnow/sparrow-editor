// alignService.js
export function bindAlignButtons(app, ui, updateAndRestore, { leftBtn, centerBtn, rightBtn }) {

  function applyAlign(alignType) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const currentState = app.getState().present.editorState;
    const ranges = ui.getSelectionRangesInState(currentState);
    if (!ranges || ranges.length === 0) return;

    // ✅ 선택 영역의 첫 줄, 마지막 줄 모두 포함
    const startLineIndex = Math.min(...ranges.map(r => r.lineIndex));
    const endLineIndex = Math.max(...ranges.map(r => r.lineIndex));

    const newState = [...currentState];

    for (let i = startLineIndex; i <= endLineIndex; i++) {
      if (!newState[i]) continue;
      newState[i] = {
        ...newState[i],
        align: alignType
      };
    }

    app.saveEditorState(newState);

    // ✅ 선택 영역이 유지되도록 복원
    const pos = ui.getSelectionPosition();
    updateAndRestore(pos);
  }

  leftBtn.addEventListener("click", () => applyAlign("left"));
  centerBtn.addEventListener("click", () => applyAlign("center"));
  rightBtn.addEventListener("click", () => applyAlign("right"));
}
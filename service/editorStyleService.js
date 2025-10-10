// service/editorStyleService.js
import { toggleInlineStyle } from "../utils/styleUtils.js";

export function bindStyleButtons(getEditorState, saveEditorState, ui, updateAndRestore, { boldBtn, italicBtn, underLineBtn }) {
  function applyStyle(styleKey, styleValue) {
    const ranges = ui.getSelectionRangesInState(getEditorState());
    if (!ranges || ranges.length === 0) return;

    // toggleInlineStyle 호출
    const newState = toggleInlineStyle(getEditorState(), ranges, styleKey, styleValue, { type: 'text' });

    saveEditorState(newState);

    const pos = ui.getSelectionPosition();
    updateAndRestore(pos);
  }

  // ───────── 굵게(Bold) ─────────
  boldBtn.addEventListener('click', () => applyStyle("fontWeight", "bold"));

  // ───────── 기울이기(Italic) ─────────
  italicBtn.addEventListener('click', () => applyStyle("fontStyle", "italic"));

  // ───────── 밑줄(Underline) ─────────
  underLineBtn.addEventListener('click', () => applyStyle("textDecoration", "underline"));
}
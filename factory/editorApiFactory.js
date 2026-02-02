// factory/editorApiFactory.js

export function createEditorAPI({
  state,
  ui,
  domSelection,
}) {

    /* ─────────────────────────────
    * stateAPI
    * ───────────────────────────── */
    const stateAPI = {
        get           : (key = MAIN_CONTENT_KEY) => state.getState(key),
        save          : (key, data, options = { saveHistory: true }) => {
        if (data === undefined) {
            state.saveEditorState(MAIN_CONTENT_KEY, data, options);
        } else {
            state.saveEditorState(key, data, options);
        }
        },
        // 💡 인라인 서비스에서 호출할 배치 저장 API 추가
        saveBatch     : (updates, options = { saveHistory: true }) => {
        // updates: [{ key, newState, ranges }, ...] 형태의 배열을 기대함
        state.saveEditorBatchState(updates, options);
        },      
        saveCursor    : (cursor) => state.saveCursorState(cursor),
        getCursor     : () => state.getCursor(),
        undo          : () => state.undo(),
        redo          : () => state.redo(),
        isLineChanged : (lineIndex, key = MAIN_CONTENT_KEY) => state.isLineChanged(key, lineIndex),
        getLines      : (idxs, key = MAIN_CONTENT_KEY) => state.getLines(key, idxs),
        getLineRange  : (start, end, key = MAIN_CONTENT_KEY) => state.getLineRange(key, start, end),
    };


    /* ─────────────────────────────
    * uiAPI
    * ───────────────────────────── */
    const uiAPI = {
        render                      : (data, key = MAIN_CONTENT_KEY) => ui.render(data, key),
        renderLine                  : (i, d, key = MAIN_CONTENT_KEY, p = null) => ui.renderLine(i, d, key, p),
        renderChunk                 : (li, ci, d, key = MAIN_CONTENT_KEY) => ui.renderChunk(li, ci, d, key),
        ensureFirstLine             : (key = MAIN_CONTENT_KEY) => ui.ensureFirstLine(key),
        shiftLinesDown              : (from, key = MAIN_CONTENT_KEY) => ui.shiftLinesDown(from, key),
        insertLine                  : (i, a, key = MAIN_CONTENT_KEY) => ui.insertLine(i, a, key),
        removeLine                  : (i, key = MAIN_CONTENT_KEY) => ui.removeLine(i, key),
        // DOM -> Model 파싱 브릿지
        parseLineDOM                : (p, chunks, sel, off, idx) => ui.parseLineDOM(p, chunks, sel, off, idx),
        extractTableDataFromDOM     : (tableEl) => ui.extractTableDataFromDOM(tableEl),
    };

  /* ─────────────────────────────
   * selectionAPI
   * ───────────────────────────── */
    const selectionAPI = {
        restoreCursor               : (pos) => domSelection.restoreCursor(pos),
        restoreMultiBlockCursor     : (positions) => domSelection.restoreMultiBlockCursor(positions),
        getDomSelection             : (targetKey) => domSelection.getDomSelection(targetKey),
        getSelectionPosition        : () => domSelection.getSelectionPosition(),
        getInsertionAbsolutePosition: () => domSelection.getInsertionAbsolutePosition(),
        updateLastValidPosition     : () => domSelection.updateLastValidPosition(),
        getLastValidPosition        : () => domSelection.getLastValidPosition(),
        getActiveKey                : () => domSelection.getActiveKey(),
        getActiveKeys               : () => domSelection.getActiveKeys(),
        getLastActiveKey            : () => domSelection.getLastActiveKey(),
        getSelectionContext         : () => domSelection.getSelectionContext(),
        getIsRestoring              : () => domSelection.getIsRestoring(),
        setIsRestoring              : (val) => domSelection.setIsRestoring(val),
        refreshActiveKeys           : () => domSelection.refreshActiveKeys(),
    };

  return {
    stateAPI,
    uiAPI,
    selectionAPI
  };
}

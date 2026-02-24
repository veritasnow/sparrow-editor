// factory/editorApiFactory.js

export function createEditorAPI({
  state,
  ui,
  domSelection,
  MAIN_CONTENT_KEY
}) {

    /* ─────────────────────────────
    * stateAPI (생략 없음)
    * ───────────────────────────── */
    const stateAPI = {
        get             : (key = MAIN_CONTENT_KEY) => state.getState(key),
        getHistoryStatus: () => state.getHistoryStatus(),
        save            : (key, data, options = { saveHistory: true }) => {
            state.saveEditorState(data === undefined ? MAIN_CONTENT_KEY : key, data, options);
        },
        delete          : (key = MAIN_CONTENT_KEY, options = { saveHistory: true }) => {
            state.deleteEditorState(key, options);
        },
        deleteBatch     : (keys, options = { saveHistory: true }) => {
            state.deleteEditorBatchState(keys, options);
        },        
        deleteLine      : (lineIndex, key = MAIN_CONTENT_KEY, options) => {
            state.deleteEditorLine(key, lineIndex, options);
        },        
        saveBatch       : (updates, options = { saveHistory: true }) => state.saveEditorBatchState(updates, options),      
        saveCursor      : (cursor) => state.saveCursorState(cursor),
        getCursor       : () => state.getCursor(),
        undo            : () => state.undo(),
        redo            : () => state.redo(),
        isLineChanged   : (lineIndex, key = MAIN_CONTENT_KEY) => state.isLineChanged(key, lineIndex),
        getLines        : (idxs, key = MAIN_CONTENT_KEY) => state.getLines(key, idxs),
        getLineRange    : (start, end, key = MAIN_CONTENT_KEY) => state.getLineRange(key, start, end),
    };

    /* ─────────────────────────────
    * uiAPI (renderLine 재귀 추가)
    * ───────────────────────────── */
    const uiAPI = {
        /**
         * 1. 딥 렌더링 (전체 컨테이너 동기화)
         */
        render: function(data, key = MAIN_CONTENT_KEY, shouldRenderSub = true) {
            ui.render(data, key);
            if(shouldRenderSub) {
                this._renderSubDom(data);
            }      
        },

        /**
         * 2. 딥 라인 렌더링 (특정 라인 및 하위 테이블 동기화)
         */
        renderLine: function(lineIndex, lineData, { 
            key             = MAIN_CONTENT_KEY, 
            pool            = null, 
            shouldRenderSub = true,
            skipSync        = false,
            tableStrategy   = 'reuse' // ⭐ 추가
        } = {}) {
        //renderLine: function(lineIndex, lineData, key = MAIN_CONTENT_KEY, pool = null, shouldRenderSub = true) {
            // 해당 라인 기본 렌더링 실행
            ui.renderLine(lineIndex, lineData, key, pool, skipSync, { tableStrategy });
            // 🔥 [추가] 해당 라인이 테이블을 포함하고 있다면 하위 셀들도 재귀적으로 렌더링
            if(shouldRenderSub) {
                console.log("111111111");
                this._renderSubDom([lineData]);
            }
        },

        /**
         * 내부 헬퍼: 라인 목록을 순회하며 하위 테이블 셀들을 재귀 렌더링
         */
        _renderSubDom: function(lines) {
            if (!lines || !Array.isArray(lines)) return;

            console.log("lineslineslines : ", lines);

            lines.forEach(line => {
                line.chunks.forEach(chunk => {
                    if (chunk.type === 'table' && chunk.data) {
                        // 테이블의 모든 셀(td)을 1차원 배열로 펼쳐서 순회
                        chunk.data.flat().forEach(cell => {
                            if (cell && cell.id) {
                                const cellState = stateAPI.get(cell.id);
                                if (cellState) {
                                    // 하위 셀 컨테이너에 대해 다시 딥 렌더링 호출
                                    this.render(cellState, cell.id);
                                }
                            }
                        });
                    } else if (chunk.type === 'unorderedList' && chunk.data) {
                        const lineState = stateAPI.get(chunk.id);
                        if (Array.isArray(lineState)) {
                            lineState.forEach((item, index) => {
                                this.renderLine(index, item, { 
                                    key             : chunk.id, 
                                    shouldRenderSub : false 
                                });
                            });
                        }
                    }
                });
            });
        },
        insertLineAfter             : (refEl, newIndex, align, targetKey) => ui.insertLineAfter(refEl, newIndex, align, targetKey),
        renderChunk                 : (li, ci, d, key = MAIN_CONTENT_KEY) => ui.renderChunk(li, ci, d, key),
        ensureFirstLine             : (key = MAIN_CONTENT_KEY) => ui.ensureFirstLine(key),
        shiftLinesDown              : (from, key = MAIN_CONTENT_KEY) => ui.shiftLinesDown(from, key),
        insertLine                  : (i, a, key = MAIN_CONTENT_KEY) => ui.insertLine(i, a, key),
        removeLine                  : (i, key = MAIN_CONTENT_KEY) => ui.removeLine(i, key),
        parseLineDOM                : (p, chunks, sel, off, idx) => ui.parseLineDOM(p, chunks, sel, off, idx),
        extractTableDataFromDOM     : (tableEl) => ui.extractTableDataFromDOM(tableEl),
        partialRenderOnScroll       : (range, editorState, editorContext) => ui.partialRenderOnScroll(range, editorState, editorContext),
        forceFullRender             : (editorState) => ui.render(editorState), // 오타 수정: ui.render
        resetPartialRender          : () => ui.resetPartialRender(),
    };

    /* ─────────────────────────────
    * selectionAPI (동일)
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
        getSelectionMode            : () => domSelection.getSelectionMode(),
        getMainKey                  : () => domSelection.getMainKey(),
        findParentContainerId       : (containerId) => domSelection.findParentContainerId(containerId),
        getLineIndex                : (el) => domSelection.getLineIndex(el)
    };

  return { stateAPI, uiAPI, selectionAPI };
}
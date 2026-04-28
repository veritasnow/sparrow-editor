// factory/editorApiFactory.js
import { createEditorRenderService } from '../core/render/editorRenderService.js';

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
    const renderService = createEditorRenderService({
        stateAPI,
        ui
    });
    const uiAPI = {

        render: function(data, key = MAIN_CONTENT_KEY, shouldRenderSub = true) {
            renderService.render(data, key, shouldRenderSub);
        },

        renderLine: function(lineIndex, lineData, options = {}) {
            renderService.renderLine(lineIndex, lineData, {
                key: options.key || MAIN_CONTENT_KEY,
                ...options
            });
        },

        // ❌ 삭제 대상
        // _renderSubDom 제거

        insertLineAfter: (refEl, newIndex, align, targetKey) => ui.insertLineAfter(refEl, newIndex, align, targetKey),
        renderChunk: (li, ci, d, key = MAIN_CONTENT_KEY) => ui.renderChunk(li, ci, d, key),
        ensureFirstLine: (key = MAIN_CONTENT_KEY) => ui.ensureFirstLine(key),
        shiftLinesDown: (from, key = MAIN_CONTENT_KEY) => ui.shiftLinesDown(from, key),
        insertLine: (i, a, key = MAIN_CONTENT_KEY) => ui.insertLine(i, a, key),
        removeLine: (i, key = MAIN_CONTENT_KEY) => ui.removeLine(i, key),
        parseLineDOM: (p, chunks, sel, off, idx) => ui.parseLineDOM(p, chunks, sel, off, idx),
        partialRenderOnScroll: (range, editorState, editorContext) => ui.partialRenderOnScroll(range, editorState, editorContext),
        forceFullRender: (editorState) => ui.render(editorState),
        resetPartialRender: () => ui.resetPartialRender(),
    };

    /* ─────────────────────────────
    * selectionAPI (동일)
    * ───────────────────────────── */
    const selectionAPI = {
        restoreCursor               : (pos)         => domSelection.restoreCursor(pos),
        restoreMultiBlockCursor     : (positions)   => domSelection.restoreMultiBlockCursor(positions),
        getDomSelection             : (targetKey)   => domSelection.getDomSelection(targetKey),
        getSelectionPosition        : ()            => domSelection.getSelectionPosition(),
        getInsertionAbsolutePosition: ()            => domSelection.getInsertionAbsolutePosition(),
        updateLastValidPosition     : ()            => domSelection.updateLastValidPosition(),
        getLastValidPosition        : ()            => domSelection.getLastValidPosition(),
        getActiveKey                : ()            => domSelection.getActiveKey(),
        //getActiveKeys               : ()            => domSelection.getActiveKeys(),
        getActiveKeys: () => {
            setLock(false);
            return domSelection.getActiveKeys();
        },

        getLastActiveKey            : ()            => domSelection.getLastActiveKey(),
        getSelectionContext         : ()            => domSelection.getSelectionContext(),
        getIsRestoring              : ()            => domSelection.getIsRestoring(),
        setIsRestoring              : (val)         => domSelection.setIsRestoring(val),
        refreshActiveKeys           : ()            => domSelection.refreshActiveKeys(),
        getSelectionMode            : ()            => domSelection.getSelectionMode(),
        getMainKey                  : ()            => domSelection.getMainKey(),
        findParentContainerId       : (containerId) => domSelection.findParentContainerId(containerId),
        getLineIndex                : (el)          => domSelection.getLineIndex(el),
        getSelectedKeys             : ()            => domSelection.getSelectedKeys(),
        isMultiSelect               : ()            => {
            // 1. 현재 선택된 키(셀 ID들) 배열을 가져옵니다.
            const keys = domSelection.getActiveKeys() || [];
            if (keys.length > 1) {
                setLock(true);                
                return true;
            } 
            // 💡 선택된 키가 1개 이하(단일 커서 등)이면 다시 편집 가능하게 복구
            else {
                setLock(false);
                return false;
            }
        },
    };


    let isLocked = false;

    function setLock(lock) {
        if (isLocked === lock) return;
        isLocked = lock;

        const editorEl = document.getElementById(MAIN_CONTENT_KEY);
        if (!editorEl) return;

        if (isLocked) {
            console.log("🔒 editor locked");

            editorEl.setAttribute("contenteditable", "false");
            editorEl.blur(); // ⭐ IME 차단 핵심
        } else {
            console.log("🔓 editor unlocked");

            editorEl.setAttribute("contenteditable", "true");

            editorEl.focus({ preventScroll: true });
        }
    }

  return { stateAPI, uiAPI, selectionAPI };
}
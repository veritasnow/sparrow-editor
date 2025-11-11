// application/editorApplication.js
import { createHistoryStore } from "../store/historyStore.js";
import { createEditorSnapshotService } from "../service/editorSnapshotService.js";

export function createEditorApp(initialState = { editorState: [] }) {
  const store = createHistoryStore(initialState);
  const snapshotService = createEditorSnapshotService(store);

  return {
    /** 현재 상태 조회 */
    getState: store.getState,

    /** 전체 상태 저장 (snapshot 기반) */
    saveEditorState: snapshotService.saveEditorState,

    /** 이전 상태로 복원 */
    setPrevEditorState: snapshotService.setPrevEditorState,

    // patch 기반
    insertText: (lineIndex, offset, text) => {
      store.applyPatch({ action: "insertText", payload: { lineIndex, offset, text } }, editorReducer);
    },
    
    toggleStyle: (lineIndex, start, end, styleKey, styleValue) => {
      store.applyPatch({ action: "toggleStyle", payload: { lineIndex, start, end, styleKey, styleValue } }, editorReducer);
    },


    /** Undo / Redo */
    undo: () => {
      store.undo();
      return store.getState().present;
    },

    redo: () => {
      store.redo();
      return store.getState().present;
    },

    /** 상태 초기화 */
    reset: store.reset,

    /** 변경된 맵 조회 (추후 diff 관리용) */
    getChangedMap: store.getChangedMap,
  };
}

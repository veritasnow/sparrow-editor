// application/editorApplication.js
import { createHistoryStore } from "../store/historyStore.js";
import { createEditorSnapshotService } from "../service/editorSnapshotService.js";
import { editorReducer } from "../reducer/editorReducer.js";

export function createEditorApp(initialState = { editorState: [] }) {
  const store = createHistoryStore(initialState);
  const snapshotService = createEditorSnapshotService(store);

  return {
    // 상태 조회
    getState: store.getState,

    // patch 기반
    insertText: (lineIndex, offset, text) => {
      store.applyPatch({ action: "insertText", payload: { lineIndex, offset, text } }, editorReducer);
    },
    toggleStyle: (lineIndex, start, end, styleKey, styleValue) => {
      store.applyPatch({ action: "toggleStyle", payload: { lineIndex, start, end, styleKey, styleValue } }, editorReducer);
    },
    undo: () => store.undo(editorReducer),
    redo: () => store.redo(editorReducer),

    // snapshot 기반 (호환 유지)
    saveEditorState: snapshotService.saveEditorState,
    setPrevEditorState: snapshotService.setPrevEditorState,

    reset: store.reset,

    // TODO 변경된 MAP정보만....
    getChangedMap: store.getChangedMap,

  };
}

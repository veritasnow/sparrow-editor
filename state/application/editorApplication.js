// application/editorApplication.js
import { createHistoryStore } from "../store/historyStore.js";
import { createCursorHistoryStore } from "../store/cursorHistoryStore.js";
import { createEditorSnapshotService } from "../service/editorSnapshotService.js";

export function createEditorApp(initialState = { editorState: [] }) {
  // ----------------------------
  // [1] 상태 저장소 초기화
  // ----------------------------
  const store = createHistoryStore(initialState);           // 에디터 본문 상태
  const cursorStore = createCursorHistoryStore(null);       // 커서/선택영역 상태
  const snapshotService = createEditorSnapshotService(store); // 스냅샷 기반 저장

  // ----------------------------
  // [2] 외부 제공 API
  // ----------------------------
  return {
    /** 🔹 현재 상태 조회 */
    getState: store.getState,
    getCursor: cursorStore.getCursor,

    /** 🔹 전체 상태 저장 (snapshot 기반) */
    saveEditorState: snapshotService.saveEditorState,

    /** 🔹 커서 상태 저장 (restoreData 등) */
    saveCursorState: cursorStore.saveCursor,

    /** 🔹 이전 상태로 복원 (수동 스냅샷용) */
    setPrevEditorState: snapshotService.setPrevEditorState,

    /** 🔹 특정 라인이 직전 상태와 변경되었는지 확인 */
    isLineChanged: store.isLineChanged,    

    // ----------------------------
    // [4] Undo / Redo
    // ----------------------------
    undo: () => {
      store.undo();
      const state = store.getState().present;
      const cursor = cursorStore.undo();
      return { state, cursor };
    },

    redo: () => {
      store.redo();
      const state = store.getState().present;
      const cursor = cursorStore.redo();
      return { state, cursor };
    },

    // ----------------------------
    // [5] 초기화 및 부가 기능
    // ----------------------------
    reset: () => {
      store.reset?.();
      cursorStore.reset?.();
    },

    getChangedMap: store.getChangedMap,

    getLines: (lineIndexes) => {
      return store.getLines(lineIndexes);
    },

    getLineRange: (start, end) => {
      return store.getLineRange(start, end);
    }
    
  };
}

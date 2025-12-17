// application/editorApplication.js
import { createHistoryStore } from "../store/historyStore.js";
import { createCursorHistoryStore } from "../store/cursorHistoryStore.js";
import { createEditorSnapshotService } from "../service/editorSnapshotService.js";

export function createEditorApp(initialState = { editorState: [] }) {
  // ----------------------------
  // [1] 상태 저장소 초기화
  // ----------------------------
  let destroyed = false;

  let store           = createHistoryStore(initialState);             // 에디터 본문 상태
  let cursorStore     = createCursorHistoryStore(null);         // 커서/선택영역 상태
  let snapshotService = createEditorSnapshotService(store); // 스냅샷 기반 저장

  function assertAlive() {
    if (destroyed) {
      throw new Error("❌ EditorApplication has been destroyed");
    }
  }

  // ----------------------------
  // [2] 상태 조회 API
  // ----------------------------
  const getState = () => {
    assertAlive();
    return store.getState();
  };

  const getCursor = () => {
    assertAlive();
    return cursorStore.getCursor();
  };

  // ----------------------------
  // [3] 상태 변경 API
  // ----------------------------
  const saveEditorState = (state) => {
    assertAlive();
    snapshotService.saveEditorState(state);
  };

  const saveCursorState = (cursor) => {
    assertAlive();
    cursorStore.saveCursor(cursor);
  };

  const setPrevEditorState = (clone) => {
    assertAlive();
    snapshotService.setPrevEditorState(clone);
  };

  // ----------------------------
  // [4] Undo / Redo
  // ----------------------------
  const undo = () => {
    assertAlive();
    store.undo();
    return {
      state: store.getState().present,
      cursor: cursorStore.undo()
    };
  };

  const redo = () => {
    assertAlive();
    store.redo();
    return {
      state: store.getState().present,
      cursor: cursorStore.redo()
    };
  };

  // ----------------------------
  // [5] 유틸 / 조회 헬퍼
  // ----------------------------
  const isLineChanged = store.isLineChanged;
  const getChangedMap = store.getChangedMap;

  const getLines = (lineIndexes) => {
    return store.getLines(lineIndexes);
  };

  const getLineRange = (start, end) => {
    return store.getLineRange(start, end);
  };

  // ----------------------------
  // [6] 초기화
  // ----------------------------
  const reset = () => {
    assertAlive();
    store.reset?.();
    cursorStore.reset?.();
  };

  // ----------------------------
  // [7] destroy
  // ----------------------------
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;

    // 1️⃣ 상태 완전 파기
    store.reset?.();
    cursorStore.reset?.();

    // 2️⃣ 참조 제거 (GC 친화)
    // (선택이지만 강력 추천)
    store           = null;
    cursorStore     = null;
    snapshotService = null;
  };

  // ----------------------------
  // [8] 외부 제공 API
  // ----------------------------
  return {
    getState,
    getCursor,

    saveEditorState,
    saveCursorState,
    setPrevEditorState,

    undo,
    redo,

    isLineChanged,
    getChangedMap,
    getLines,
    getLineRange,

    reset,
    destroy
  };
}

// application/editorApplication.js
import { createHistoryStore } from "../store/historyStore.js";
import { createCursorHistoryStore } from "../store/cursorHistoryStore.js";
import { editorSnapshot } from "../service/editorSnapshot.js";

export function createStateApplication(initialState = {}) {
  // ----------------------------
  // [1] 상태 저장소 초기화
  // ----------------------------
  let destroyed = false;

  // initialState는 이제 { "root-main": [...] } 와 같은 Map 구조여야 합니다.
  let store           = createHistoryStore(initialState);
  let cursorStore     = createCursorHistoryStore(null);
  let snapshot        = editorSnapshot(store);

  function assertAlive() {
    if (destroyed) {
      throw new Error("❌ EditorApplication has been destroyed");
    }
  }

  // ----------------------------
  // [2] 상태 조회 API (Key 필수)
  // ----------------------------
  const getState = (key) => {
    assertAlive();
    // historyStore의 getState(key)를 호출하여 특정 영역의 배열을 반환
    return store.getState(key);
  };

  const getHistoryStatus = () => {
    assertAlive();
    return store.getHistoryStatus();
  };

  const getCursor = () => {
    assertAlive();
    return cursorStore.getCursor();
  };

  // ----------------------------
  // [3] 상태 변경 API (Key 필수)
  // ----------------------------
  const saveEditorState = (key, state, options) => {
    assertAlive();
    // snapshot로 options(saveHistory 등)를 전달합니다.
    snapshot.saveEditorState(key, state, options);
  };

  // 💡 [배치 API 추가]
  const saveEditorBatchState = (updates, options) => {
    assertAlive();
    snapshot.saveEditorBatchState(updates, options);
  };  

  // 💡 [단일 삭제 API 추가]
  const deleteEditorState = (key, options) => {
    assertAlive();
    snapshot.deleteEditorState(key, options);
  };

  // 💡 [배치 삭제 API 추가]
  const deleteEditorBatchState = (keys, options) => {
    assertAlive();
    snapshot.deleteEditorBatchState(keys, options);
  };  

  const deleteEditorLine = (key, lineIndex, options) => {
    assertAlive();
    snapshot.removeEditorLine(key, lineIndex, options);
  };

  const saveCursorState = (cursor) => {
    assertAlive();
    // cursor 데이터 내부에 어떤 key(rootId)인지 정보가 포함되어야 함
    cursorStore.saveCursor(cursor);
  };

  const setPrevEditorState = (clone) => {
    assertAlive();
    snapshot.setPrevEditorState(clone);
  };

  // ----------------------------
  // [4] Undo / Redo
  // ----------------------------
  const undo = () => {
    assertAlive();
    const presentMap = store.undo(); // undo는 전체 Map을 반환
    const cursor = cursorStore.undo();
    return {
      state: presentMap,
      cursor: cursor
    };
  };

  const redo = () => {
    assertAlive();
    const presentMap = store.redo(); // redo는 전체 Map을 반환
    const cursor = cursorStore.redo();
    return {
      state: presentMap,
      cursor: cursor
    };
  };

  // ----------------------------
  // [5] 유틸 / 조회 헬퍼 (Key 필수)
  // ----------------------------
  const isLineChanged = (key, lineIndex) => {
    assertAlive();
    return store.isLineChanged(key, lineIndex);
  };

  const getChangedMap = () => {
    assertAlive();
    return store.getChangedMap();
  };

  const getLines = (key, lineIndexes) => {
    assertAlive();
    return store.getLines(key, lineIndexes);
  };

  const getLineRange = (key, start, end) => {
    assertAlive();
    return store.getLineRange(key, start, end);
  };

  // ----------------------------
  // [6] 초기화
  // ----------------------------
  const reset = () => {
    assertAlive();
    store.reset();
    cursorStore.reset();
  };

  // ----------------------------
  // [7] destroy
  // ----------------------------
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;

    store.reset?.();
    cursorStore.reset?.();

    store           = null;
    cursorStore     = null;
    snapshot = null;
  };

  // ----------------------------
  // [8] 외부 제공 API
  // ----------------------------
  return {
    getState,
    getHistoryStatus,
    getCursor,
    saveEditorState,
    saveEditorBatchState,
    deleteEditorState,
    deleteEditorBatchState,
    deleteEditorLine,
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
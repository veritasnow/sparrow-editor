/**
 * 에디터 상태 저장 및 삭제 관리 서비스
 */
export function createEditorSnapshotService(store) {
  // --- [Internal State] ---
  let prevSnapshot = null;

  // --- [Internal Logic Functions] ---

  /** 1. 상태 저장 관련 (Save) */
  
  // [단일 저장]
  function saveEditorState(key, data, options = { saveHistory: true }) {
    if (!Array.isArray(data)) {
      console.error("❌ saveEditorState: invalid source (Expected Array)", data);
      return;
    }
    // 데이터 교체(newData) 로직으로 패치 적용
    store.applyPatch(key, data, (_prev, newData) => newData, options);
  }

  // [배치 저장] - 여러 컨테이너/셀을 한 번에 업데이트
  function saveEditorBatchState(updates, options = { saveHistory: true }) {
    if (!Array.isArray(updates)) return;

    // store.applyBatchPatch 형식으로 변환 (기존 데이터를 새 데이터로 덮어쓰는 reducer 포함)
    const formattedUpdates = updates.map(u => ({
      key: u.key,
      patch: u.newState,
      reducer: (_prev, newData) => newData
    }));

    store.applyBatchPatch(formattedUpdates, options);
  }

  /** 2. 삭제 관련 (Delete) */

  // [단일 삭제] - 특정 키(컨테이너) 전체 제거
  function deleteEditorState(key, options = { saveHistory: true }) {
    if (!key) return;
    store.deleteKey(key, options);
  }

  // [배치 삭제] - 여러 키를 한 번의 히스토리로 제거
  function deleteEditorBatchState(keys, options = { saveHistory: true }) {
    if (!Array.isArray(keys) || keys.length === 0) return;
    store.deleteKeys(keys, options);
  }

  // [라인 삭제] - 특정 부모 내의 특정 행(index)만 제거
  function removeEditorLine(key, lineIndex, options = { saveHistory: true }) {
    if (!key || lineIndex === undefined) return;
    store.deleteLine(key, lineIndex, options);
  }

  /** 3. 스냅샷 비교용 데이터 관리 */
  function setPrevEditorState(currentData) {
    prevSnapshot = currentData;
  }

  function getPrevEditorState() {
    return prevSnapshot;
  }

  // --- [Export Public API] ---
  return {
    saveEditorState,
    saveEditorBatchState,
    deleteEditorState,
    deleteEditorBatchState,
    removeEditorLine,
    setPrevEditorState,
    getPrevEditorState
  };
}
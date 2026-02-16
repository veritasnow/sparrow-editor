export function createEditorSnapshotService(store) {
  let prevSnapshot = null;

  return {
    // [단일 저장]
    saveEditorState: (key, data, options = { saveHistory: true }) => {
      if (Array.isArray(data)) {
        store.applyPatch(key, data, (_prev, newData) => newData, options);
        return;
      }
      console.error("❌ saveEditorState: invalid source (Expected Array)", data);
    },

    // 💡 [배치 저장 추가]
    saveEditorBatchState: (updates, options = { saveHistory: true }) => {
      if (!Array.isArray(updates)) return;
      
      // store.applyBatchPatch로 전달할 데이터 형식으로 변환
      const formattedUpdates = updates.map(u => ({
        key: u.key,
        patch: u.newState,
        reducer: (_prev, newData) => newData
      }));

      store.applyBatchPatch(formattedUpdates, options);
    },

    // ----------------------------
    // [2] 삭제 (Delete) 계열 - 신규 추가
    // ----------------------------

    // [단일 삭제]
    // 리스트 하나를 날리거나 특정 컨테이너를 제거할 때 사용
    deleteEditorState: (key, options = { saveHistory: true }) => {
      if (!key) return;
      store.deleteKey(key, options);
    },

    // [배치 삭제]
    // 여러 개의 리스트나 테이블 셀 등을 한 번의 히스토리 점점으로 제거할 때 사용
    deleteEditorBatchState: (keys, options = { saveHistory: true }) => {
      if (!Array.isArray(keys) || keys.length === 0) return;
      store.deleteKeys(keys, options);
    },    

    // 💡 [라인 삭제 추가] 특정 키(부모)의 특정 행만 제거할 때
    removeEditorLine: (key, lineIndex, options = { saveHistory: true }) => {
      if (!key || lineIndex === undefined) return;
      store.deleteLine(key, lineIndex, options);
    },    

    setPrevEditorState: (currentData) => { prevSnapshot = currentData; },
    getPrevEditorState: () => prevSnapshot
  };
}
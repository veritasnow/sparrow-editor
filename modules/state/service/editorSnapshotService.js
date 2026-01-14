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

    setPrevEditorState: (currentData) => { prevSnapshot = currentData; },
    getPrevEditorState: () => prevSnapshot
  };
}
export function createEditorSnapshotService(store) {
  let prevSnapshot = null;

  return {
    // 💡 options 파라미터 추가 (기본값 설정)
    saveEditorState: (key, data, options = { saveHistory: true }) => {
      if (Array.isArray(data)) {
        // store.applyPatch 호출 시 options를 그대로 전달
        store.applyPatch(key, data, (_prev, newData) => {
          return newData; 
        }, options); 
        return;
      }
      console.error("❌ saveEditorState: invalid source (Expected Array)", data);
    },

    setPrevEditorState: (currentData) => {
      prevSnapshot = currentData;
    },

    getPrevEditorState: () => prevSnapshot
  };
}
export function createEditorSnapshotService(store) {
  let prevSnapshot = null;

  return {
    saveEditorState: (key, data) => {
      if (Array.isArray(data)) {
        // store 내부에서 이미 불변성을 유지하며 교체하고 있다면 그대로 사용
        store.applyPatch(key, data, (_prev, newData) => {
          return newData; 
        });
        return;
      }
      console.error("❌ saveEditorState: invalid source (Expected Array)", data);
    },

    /**
     * [개선] Deep Copy 제거
     * 불변 데이터 구조에서는 객체를 복사할 필요가 없습니다. 
     * 단순히 현재 참조(주소)만 보관하면 됩니다.
     */
    setPrevEditorState: (currentData) => {
      prevSnapshot = currentData;
    },

    getPrevEditorState: () => prevSnapshot
  };
}
export function createEditorSnapshotService(store) {
  let prevSnapshot = null;

  return {
    saveEditorState: (data) => {
      if (Array.isArray(data)) {
        // patch 개념: 새 editorState 전체를 하나의 패치로 저장
        const patch = { editorState: data };

        store.applyPatch(patch, (_prev, patch) => {
          // 단순히 새 상태로 교체
          return patch;
        });

        console.log(store.getState());
        
        return;
      }

      console.error("❌ saveEditorState: invalid source", data);
    },

    setPrevEditorState: (clone) => {
      prevSnapshot = JSON.parse(JSON.stringify(clone));
    },

    getPrevEditorState: () => prevSnapshot
  };
}

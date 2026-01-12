export function createEditorSnapshotService(store) {
  let prevSnapshot = null;

  return {
    // 💡 key를 추가로 받아 store.applyPatch에 전달합니다.
    saveEditorState: (key, data) => {
      if (Array.isArray(data)) {
        // store의 인터페이스에 맞춰 (key, patch, reducer) 순으로 호출
        store.applyPatch(key, data, (_prev, newData) => {
          return newData; // 새로운 라인 배열로 교체
        });

        // 로그 확인 시에도 key 기반 조회
        console.log(`💾 Saved [${key}]:`, store.getState(key));
        return;
      }

      console.error("❌ saveEditorState: invalid source (Expected Array)", data);
    },

    setPrevEditorState: (clone) => {
      prevSnapshot = JSON.parse(JSON.stringify(clone));
    },

    getPrevEditorState: () => prevSnapshot
  };
}
/*
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
*/
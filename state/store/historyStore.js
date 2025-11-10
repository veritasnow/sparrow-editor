// store/historyStore.js
export function createHistoryStore(initialState = { editorState: [] }) {
  let state = {
    past: [],
    present: initialState,
    future: []
  };

  const getEditorState = (obj) => obj?.editorState || [];

  return {
    getState: () => state,

    // patch 단위 저장 (undo/redo 기록 포함)
    applyPatch: (patch, reducer) => {
      const prev = state.present;
      const newPresent = reducer(prev, patch);

      // 변경 없으면 저장 안함
      if (JSON.stringify(prev.editorState) === JSON.stringify(newPresent.editorState)) return;

      const MAX_HISTORY = 30;
      const newPast = [...state.past, prev].slice(-MAX_HISTORY);

      state = {
        past: newPast,
        present: newPresent,
        future: []
      };
    },

    undo: () => {
      if (state.past.length === 0) return;

      const prevPresent = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);

      state = {
        past: newPast,
        present: prevPresent,
        future: [state.present, ...state.future]
      };
    },

    redo: () => {
      if (state.future.length === 0) return;

      const nextPresent = state.future[0];
      const newFuture = state.future.slice(1);

      state = {
        past: [...state.past, state.present],
        present: nextPresent,
        future: newFuture
      };
    },

    reset: (initial = { editorState: [] }) => {
      state = { past: [], present: initial, future: [] };
    },

    replacePresent: (editorState) => {
      state = { ...state, present: { editorState } };
    },

    saveSnapshot: (editorState) => {
      state = { past: [], present: { editorState }, future: [] };
    },

    // ✅ 변경된 라인만 key-value 형태로 반환
    getChangedMap: () => {
      const prev = getEditorState(state.past[state.past.length - 1] || {});
      const curr = getEditorState(state.present);

      const changed = {};
      const maxLen = Math.max(prev.length, curr.length);

      for (let i = 0; i < maxLen; i++) {
        const prevLine = JSON.stringify(prev[i] || null);
        const currLine = JSON.stringify(curr[i] || null);
        if (prevLine !== currLine) {
          changed[i] = curr[i] || [];
        }
      }
      return changed;
    }
  };
}

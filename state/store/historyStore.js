export function createHistoryStore(initialState = { editorState: [] }) {
  const MAX_HISTORY = 30;
  let history = [initialState];
  let currentIndex = 0;

  return {
    getState: () => ({
      pastCount: currentIndex,
      present: history[currentIndex],
      futureCount: history.length - currentIndex - 1
    }),

    applyPatch: (patch, reducer) => {
      const prev = history[currentIndex];
      const newPresent = reducer(prev, patch);

      // 변경 없으면 무시
      if (JSON.stringify(prev.editorState) === JSON.stringify(newPresent.editorState)) return;

      // 현재 인덱스 이후 이력 삭제 (redo 경로 제거)
      history = history.slice(0, currentIndex + 1);
      history.push(newPresent);

      // 최대 30개 유지
      if (history.length > MAX_HISTORY) {
        history = history.slice(history.length - MAX_HISTORY);
      }

      currentIndex = history.length - 1;
    },

    undo: () => {
      if (currentIndex > 0) currentIndex--;
    },

    redo: () => {
      if (currentIndex < history.length - 1) currentIndex++;
    },

    replacePresent: (editorState) => {
      history[currentIndex] = { editorState };
    },

    getChangedMap: () => {
      const prev = history[currentIndex - 1]?.editorState || [];
      const curr = history[currentIndex]?.editorState || [];

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
    },

    getHistory: () => history,
  };
}

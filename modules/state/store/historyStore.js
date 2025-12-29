// store/historyStore.js
export function createHistoryStore(initialState = { editorState: [] }) {
  const MAX_HISTORY = 30;

  // ----------------------------
  // [0] 내부 유틸
  // ----------------------------
  const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

  // 🔑 초기 상태 스냅샷 (절대 변하지 않음)
  const baseState = deepClone(initialState);

  let history = [deepClone(baseState)];
  let currentIndex = 0;

  return {
    // ----------------------------
    // [1] 상태 조회
    // ----------------------------
    getState: () => ({
      pastCount: currentIndex,
      present: history[currentIndex],
      futureCount: history.length - currentIndex - 1
    }),

    // ----------------------------
    // [2] 상태 변경
    // ----------------------------
    applyPatch: (patch, reducer) => {
      const prev = history[currentIndex];
      const newPresent = reducer(prev, patch);

      // 변경 없으면 무시
      if (
        JSON.stringify(prev.editorState) ===
        JSON.stringify(newPresent.editorState)
      ) return;

      // redo 경로 제거
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

    // ----------------------------
    // [3] 변경 감지
    // ----------------------------
    isLineChanged: (lineIndex) => {
      const prevEditorState = history[currentIndex - 1]?.editorState;
      const currEditorState = history[currentIndex].editorState;

      if (!prevEditorState) return true;

      const prevLine = prevEditorState[lineIndex];
      const currLine = currEditorState[lineIndex];

      if (!prevLine || !currLine) {
        if (prevLine || currLine) return true;
        return false;
      }

      return JSON.stringify(prevLine) !== JSON.stringify(currLine);
    },

    getChangedMap: () => {
      const prev = history[currentIndex - 1]?.editorState || [];
      const curr = history[currentIndex]?.editorState || [];

      const changed = {};
      const maxLen = Math.max(prev.length, curr.length);

      for (let i = 0; i < maxLen; i++) {
        if (
          JSON.stringify(prev[i] || null) !==
          JSON.stringify(curr[i] || null)
        ) {
          changed[i] = curr[i] || [];
        }
      }
      return changed;
    },

    // ----------------------------
    // [4] 조회 헬퍼
    // ----------------------------
    getHistory: () => history,

    getLines: (lineIndexes) => {
      const curr = history[currentIndex].editorState;
      return lineIndexes.map(i => curr[i]).filter(Boolean);
    },

    getLineRange: (start, end) => {
      const curr = history[currentIndex].editorState;
      return curr.slice(start, end + 1);
    },

    // ----------------------------
    // [5] reset (완전 초기화)
    // ----------------------------
    reset: () => {
      history = [deepClone(baseState)];
      currentIndex = 0;

      console.log("🧹 HistoryStore reset");
    }
  };
}

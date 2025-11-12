// store/cursorHistoryStore.js
export function createCursorHistoryStore(initialCursor = null) {
  const MAX_HISTORY = 30;
  let history = [initialCursor];
  let currentIndex = 0;

  return {
    getCursor: () => history[currentIndex],

    saveCursor: (cursorData) => {
      if (!cursorData) return;

      // redo 경로 제거
      history = history.slice(0, currentIndex + 1);
      history.push(cursorData);

      // 최대 30개 유지
      if (history.length > MAX_HISTORY) {
        history = history.slice(history.length - MAX_HISTORY);
      }

      currentIndex = history.length - 1;
    },

    undo: () => {
      if (currentIndex > 0) currentIndex--;
      return history[currentIndex];
    },

    redo: () => {
      if (currentIndex < history.length - 1) currentIndex++;
      return history[currentIndex];
    },

    reset: () => {
      history = [null];
      currentIndex = 0;
    },
  };
}

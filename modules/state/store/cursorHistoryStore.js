import { MAX_HISTORY } from '../constatns/stateConstants.js';

// store/cursorHistoryStore.js
export function createCursorHistoryStore(initialCursor = null) {
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
      console.log('history cursor : ', history);
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

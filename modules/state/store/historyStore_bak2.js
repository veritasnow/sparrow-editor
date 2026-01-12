// store/historyStore.js
export function createHistoryStore(initialState = {}) {
  const MAX_HISTORY = 50;
  const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

  const baseState = deepClone(initialState);
  let history = [deepClone(baseState)];
  let currentIndex = 0;

  return {
    // ----------------------------
    // [1] 상태 조회 (Key 필수)
    // ----------------------------
    // 특정 키의 현재 데이터를 가져옴
    getState: (key) => {
      const present = history[currentIndex];
      return present[key] || [];
    },

    // 히스토리 전체 정보 (언두/레두 카운트용)
    getHistoryStatus: () => ({
      pastCount: currentIndex,
      futureCount: history.length - currentIndex - 1,
      present: history[currentIndex] // 전체 Map
    }),

    // ----------------------------
    // [2] 상태 변경 (Key 기반)
    // ----------------------------
    applyPatch: (key, patch, reducer) => {
      const prevMap = history[currentIndex];
      const currentData = prevMap[key] || [];
      const newData = reducer(currentData, patch);

      if (JSON.stringify(currentData) === JSON.stringify(newData)) return;

      const nextMap = { ...prevMap, [key]: newData };

      history = history.slice(0, currentIndex + 1);
      history.push(nextMap);

      console.log(nextMap);

      if (history.length > MAX_HISTORY) {
        history.shift();
      } else {
        currentIndex++;
      }
    },

    undo: () => {
      if (currentIndex > 0) currentIndex--;
      return history[currentIndex];
    },

    redo: () => {
      if (currentIndex < history.length - 1) currentIndex++;
      return history[currentIndex];
    },

    replacePresent: (key, newData) => {
      history[currentIndex] = { 
        ...history[currentIndex], 
        [key]: newData 
      };
    },

    // ----------------------------
    // [3] 변경 감지 (Key 기반)
    // ----------------------------
    isLineChanged: (key, lineIndex) => {
      const prev = history[currentIndex - 1];
      const curr = history[currentIndex];
      if (!prev || !prev[key]) return true;

      const prevLine = prev[key][lineIndex];
      const currLine = curr[key][lineIndex];

      if (!prevLine || !currLine) return prevLine !== currLine;
      return JSON.stringify(prevLine) !== JSON.stringify(currLine);
    },

    // 모든 Key 중 변경된 데이터가 있는 Key와 그 데이터를 반환
    getChangedMap: () => {
      const prev = history[currentIndex - 1] || {};
      const curr = history[currentIndex] || {};
      const changed = {};

      const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
      allKeys.forEach(key => {
        if (JSON.stringify(prev[key] || null) !== JSON.stringify(curr[key] || null)) {
          changed[key] = curr[key] || [];
        }
      });
      return changed;
    },

    // ----------------------------
    // [4] 조회 헬퍼 (Key 기반)
    // ----------------------------
    getHistory: () => history,

    getLines: (key, lineIndexes) => {
      const currLines = history[currentIndex][key] || [];
      return lineIndexes.map(i => currLines[i]).filter(Boolean);
    },

    getLineRange: (key, start, end) => {
      const currLines = history[currentIndex][key] || [];
      return currLines.slice(start, end + 1);
    },

    // ----------------------------
    // [5] reset
    // ----------------------------
    reset: () => {
      history = [deepClone(baseState)];
      currentIndex = 0;
      console.log("🧹 HistoryStore reset");
    }
  };
}
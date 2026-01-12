export function createHistoryStore(initialState = {}) {
  const MAX_HISTORY = 50;

  // 1. 초기 상태 설정 (불필요한 전체 딥클론 제거, 얕은 복사만)
  let history = [{ ...initialState }];
  let currentIndex = 0;

  return {
    // ----------------------------
    // [1] 상태 조회 (참조 비교를 위해 원본 그대로 반환)
    // ----------------------------
    getState: (key) => {
      const present = history[currentIndex];
      return present[key] || [];
    },

    getHistoryStatus: () => ({
      pastCount: currentIndex,
      futureCount: history.length - currentIndex - 1,
      present: history[currentIndex]
    }),

    // ----------------------------
    // [2] 상태 변경 (구조적 공유 적용)
    // ----------------------------
    applyPatch: (key, patch, reducer) => {
      const prevMap = history[currentIndex];
      const currentData = prevMap[key] || [];
      
      // 리듀서에서 '변경된 부분만 새 객체'로 반환한다고 가정 (고수의 전제조건)
      const newData = reducer(currentData, patch);

      // [성능 핵심] 주소값 비교. 데이터가 안 변했으면 연산 종료.
      if (currentData === newData) return;

      // 새 Map 생성 (바뀐 key만 교체, 나머지는 이전 참조 유지)
      const nextMap = { ...prevMap, [key]: newData };

      // 히스토리 타임라인 업데이트
      history = history.slice(0, currentIndex + 1);
      history.push(nextMap);
      console.log('history data : ', history);      

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

    // 현재 히스토리 인덱스에서 데이터만 살짝 교체 (Undo 기록 안 남김)
    replacePresent: (key, newData) => {
      if (history[currentIndex][key] === newData) return;
      
      history[currentIndex] = { 
        ...history[currentIndex], 
        [key]: newData 
      };
    },

    // ----------------------------
    // [3] 변경 감지 (O(1) 성능의 혁명)
    // ----------------------------
    isLineChanged: (key, lineIndex) => {
      const prev = history[currentIndex - 1]?.[key]?.[lineIndex];
      const curr = history[currentIndex]?.[key]?.[lineIndex];
      
      // [성능 핵심] 텍스트 전체를 비교하지 않고 '주소'가 바뀌었는지만 확인
      return prev !== curr;
    },

    getChangedMap: () => {
      const prev = history[currentIndex - 1] || {};
      const curr = history[currentIndex] || {};
      const changed = {};

      const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
      allKeys.forEach(key => {
        // 주소값이 다르면 해당 키의 데이터는 변경된 것임
        if (prev[key] !== curr[key]) {
          changed[key] = curr[key] || [];
        }
      });
      return changed;
    },

    // ----------------------------
    // [4] 조회 헬퍼 (원본 유지)
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
    // [5] 리셋
    // ----------------------------
    reset: () => {
      history = [{ ...initialState }];
      currentIndex = 0;
    }
  };
}
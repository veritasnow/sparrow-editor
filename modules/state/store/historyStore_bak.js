import { MAX_HISTORY } from '../constatns/stateConstants.js';

export function createHistoryStore(initialState = {}) {

  // 1. 초기 상태 설정 (불필요한 전체 딥클론 제거, 얕은 복사만)
  let history      = [{ ...initialState }];
  let currentIndex = 0;

  return {
    // ----------------------------
    // [1] 상태 조회 (참조 비교를 위해 원본 그대로 반환)
    // ----------------------------
    getState: (key) => {
      const present = history[currentIndex];
      return present[key] || [];
    },

    getLineRange: (key, start, end) => {
      const currLines = history[currentIndex][key] || [];
      return currLines.slice(start, end + 1); // start~end 라인만 반환
    },

    getHistoryStatus: () => ({
      pastCount  : currentIndex,
      futureCount: history.length - currentIndex - 1,
      present    : history[currentIndex]
    }),

    // ----------------------------
    // [2] 상태 변경 (구조적 공유 적용)
    // ----------------------------
    applyBatchPatch: (updates, options = { saveHistory: true }) => {
      // 1. 현재 시점의 전체 맵(모든 셀 데이터)을 가져옵니다.
      const prevMap = history[currentIndex];
      
      // 2. 새로운 맵을 생성하고 모든 업데이트를 적용합니다.
      let nextMap = { ...prevMap };
      
      updates.forEach(({ key, patch, reducer }) => {
        const currentData = nextMap[key] || [];
        const newData = reducer(currentData, patch);
        if (currentData !== newData) {
          nextMap[key] = newData;
        }
      });

      // 3. 변경 사항이 없다면 종료
      if (prevMap === nextMap) return;

      // 4. 히스토리 처리
      if (options.saveHistory) {
        // 새로운 히스토리 칸을 생성 (Undo 가능)
        history = history.slice(0, currentIndex + 1);
        history.push(nextMap);
        
        if (history.length > MAX_HISTORY) {
          history.shift();
        } else {
          currentIndex++;
        }
      } else {
        // 현재 칸을 덮어씀 (Silent)
        history[currentIndex] = nextMap;
      }
      console.log("history -batch : ", history);
    },

    deleteLine: (key, lineIndex, options = { saveHistory: true }) => {
      const prevMap   = history[currentIndex];
      const currLines = prevMap[key];
      
      if (!currLines || !currLines[lineIndex]) return;

      // 1. 해당 라인을 제외한 새로운 배열 생성 (불변성 유지)
      const nextLines = currLines.filter((_, i) => i !== lineIndex);
      const nextMap   = { ...prevMap, [key]: nextLines };

      if (options.saveHistory) {
        history = history.slice(0, currentIndex + 1);
        history.push(nextMap);
        if (history.length > MAX_HISTORY) {
          history.shift();
        } else {
          currentIndex++;
        }
      } else {
        history[currentIndex] = nextMap;
      }
    },    

    applyPatch: (key, patch, reducer, options = { saveHistory: true }) => {
      const prevMap     = history[currentIndex];
      const currentData = prevMap[key] || [];
      const newData     = reducer(currentData, patch);

      if (currentData === newData) return;

      const nextMap = { ...prevMap, [key]: newData };

      if (options.saveHistory) {
        // [기존 방식] 히스토리 타임라인을 새로 생성 (Undo 가능)
        history = history.slice(0, currentIndex + 1);
        history.push(nextMap);
        
        if (history.length > MAX_HISTORY) {
          history.shift();
        } else {
          currentIndex++;
        }
      } else {
        // [Silent 방식] 현재 타임라인의 데이터만 교체 (Undo 기록 안 남음)
        // 💡 이렇게 하면 여러 번 save해도 히스토리 스택은 1칸만 유지됩니다.
        history[currentIndex] = nextMap;
      }

      console.log('history:', history);

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
    // [3] 변경 감지 (O(1))
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
    },

    deleteKey: (key, options = { saveHistory: true }) => {
      const prevMap = history[currentIndex];
      
      // 이미 해당 키가 없다면 처리 중단
      if (!(key in prevMap)) return;

      // 1. 새로운 맵을 생성하되, 해당 키만 제외 (구조적 공유 파괴 최소화)
      const nextMap = { ...prevMap };
      delete nextMap[key];

      if (options.saveHistory) {
        // 히스토리 타임라인 생성 (Undo 가능)
        history = history.slice(0, currentIndex + 1);
        history.push(nextMap);

        if (history.length > MAX_HISTORY) {
          history.shift();
        } else {
          currentIndex++;
        }
      } else {
        // Silent 방식: 현재 타임라인에서 즉시 삭제
        history[currentIndex] = nextMap;
      }
      
      console.log(`Key removed: ${key}`, history);
    },

    // ----------------------------
    // (보너스) 배치 삭제 기능 (여러 리스트를 한 번에 날릴 때 대비)
    // ----------------------------
    deleteKeys: (keys, options = { saveHistory: true }) => {
      const prevMap = history[currentIndex];
      let nextMap   = { ...prevMap };
      let isChanged = false;

      keys.forEach(key => {
        if (key in nextMap) {
          delete nextMap[key];
          isChanged = true;
        }
      });

      if (!isChanged) return;

      if (options.saveHistory) {
        history = history.slice(0, currentIndex + 1);
        history.push(nextMap);
        if (history.length > MAX_HISTORY) {
          history.shift();
        } else {
          currentIndex++;
        }
      } else {
        history[currentIndex] = nextMap;
      }
    },    
  };
}
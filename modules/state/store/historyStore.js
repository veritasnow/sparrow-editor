import { MAX_HISTORY } from '../constatns/stateConstants.js';

export function createHistoryStore(initialState = {}) {
  // --- [Internal State] ---
  let history = [{ ...initialState }];
  let currentIndex = 0;

  // --- [Internal Logic Functions] ---

  /** 1. 상태 조회 관련 */
  function getState(key) {
    const present = history[currentIndex];
    return present[key] || [];
  }

  function getHistoryStatus() {
    return {
      pastCount: currentIndex,
      futureCount: history.length - currentIndex - 1,
      present: history[currentIndex]
    };
  }

  function getHistory() {
    return history;
  }

  /** 2. 라인 및 데이터 추출 */
  function getLines(key, lineIndexes) {
    const currLines = history[currentIndex][key] || [];
    return lineIndexes.map(i => currLines[i]).filter(Boolean);
  }

  function getLineRange(key, start, end) {
    const currLines = history[currentIndex][key] || [];
    return currLines.slice(start, end + 1);
  }

  /** 3. 상태 변경 핵심 (Patch & Batch) */
  function applyPatch(key, patch, reducer, options = { saveHistory: true }) {
    const prevMap = history[currentIndex];
    const currentData = prevMap[key] || [];
    const newData = reducer(currentData, patch);

    if (currentData === newData) return;

    const nextMap = { ...prevMap, [key]: newData };
    _updateHistory(nextMap, options.saveHistory);
  }

  function applyBatchPatch(updates, options = { saveHistory: true }) {
    const prevMap = history[currentIndex];
    let nextMap = { ...prevMap };

    updates.forEach(({ key, patch, reducer }) => {
      const currentData = nextMap[key] || [];
      const newData = reducer(currentData, patch);
      if (currentData !== newData) {
        nextMap[key] = newData;
      }
    });

    if (prevMap === nextMap) return;
    _updateHistory(nextMap, options.saveHistory);
  }

  /** 4. 삭제 관련 */
  function deleteLine(key, lineIndex, options = { saveHistory: true }) {
    const prevMap = history[currentIndex];
    const currLines = prevMap[key];

    if (!currLines || !currLines[lineIndex]) return;

    const nextLines = currLines.filter((_, i) => i !== lineIndex);
    const nextMap = { ...prevMap, [key]: nextLines };
    _updateHistory(nextMap, options.saveHistory);
  }

  function deleteKey(key, options = { saveHistory: true }) {
    const prevMap = history[currentIndex];
    if (!(key in prevMap)) return;

    const nextMap = { ...prevMap };
    delete nextMap[key];
    _updateHistory(nextMap, options.saveHistory);
  }

  function deleteKeys(keys, options = { saveHistory: true }) {
    const prevMap = history[currentIndex];
    let nextMap = { ...prevMap };
    let isChanged = false;

    keys.forEach(key => {
      if (key in nextMap) {
        delete nextMap[key];
        isChanged = true;
      }
    });

    if (!isChanged) return;
    _updateHistory(nextMap, options.saveHistory);
  }

  /** 5. 히스토리 제어 (Undo/Redo) */
  function undo() {
    if (currentIndex > 0) currentIndex--;
    return history[currentIndex];
  }

  function redo() {
    if (currentIndex < history.length - 1) currentIndex++;
    return history[currentIndex];
  }

  function replacePresent(key, newData) {
    if (history[currentIndex][key] === newData) return;
    history[currentIndex] = { ...history[currentIndex], [key]: newData };
  }

  function reset() {
    history = [{ ...initialState }];
    currentIndex = 0;
  }

  /** 6. 변경 감지 (Diff) */
  function isLineChanged(key, lineIndex) {
    const prev = history[currentIndex - 1]?.[key]?.[lineIndex];
    const curr = history[currentIndex]?.[key]?.[lineIndex];
    return prev !== curr;
  }

  function getChangedMap() {
    const prev = history[currentIndex - 1] || {};
    const curr = history[currentIndex] || {};
    const changed = {};

    const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
    allKeys.forEach(key => {
      if (prev[key] !== curr[key]) {
        changed[key] = curr[key] || [];
      }
    });
    return changed;
  }

  /** [Private Helper] 공통 히스토리 업데이트 로직 */
  function _updateHistory(nextMap, shouldSave) {
    if (shouldSave) {
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
  }

  // --- [Export Public API] ---
  return {
    getState,
    getLines,
    getLineRange,
    getHistoryStatus,
    getHistory,
    applyPatch,
    applyBatchPatch,
    deleteLine,
    deleteKey,
    deleteKeys,
    undo,
    redo,
    replacePresent,
    reset,
    isLineChanged,
    getChangedMap
  };
}
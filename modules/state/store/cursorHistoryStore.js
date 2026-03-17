import { MAX_HISTORY } from '../constatns/stateConstants.js';

/**
 * 커서 위치 및 선택 영역 히스토리 관리 스토어
 */
export function createCursorHistoryStore(initialCursor = null) {
  // --- [Internal State] ---
  let history = [initialCursor];
  let currentIndex = 0;

  // --- [Internal Logic Functions] ---

  /** 1. 커서 상태 조회 */
  function getCursor() {
    return history[currentIndex];
  }

  /** 2. 커서 상태 저장 */
  function saveCursor(cursorData) {
    if (!cursorData) return;

    // Redo 경로를 제거하고 새로운 커서 데이터 추가
    history = history.slice(0, currentIndex + 1);
    history.push(cursorData);

    // 최대 히스토리 개수 유지
    if (history.length > MAX_HISTORY) {
      history = history.slice(history.length - MAX_HISTORY);
    }

    console.log("history!!!! : ", history);
    // 인덱스를 최신 위치로 갱신
    currentIndex = history.length - 1;
  }

  /** 3. 히스토리 제어 (Undo/Redo) */
  function undo() {
    if (currentIndex > 0) {
      currentIndex--;
    }
    return history[currentIndex];
  }

  function redo() {
    if (currentIndex < history.length - 1) {
      currentIndex++;
    }
    return history[currentIndex];
  }

  /** 4. 리셋 */
  function reset() {
    history = [null];
    currentIndex = 0;
  }

  // --- [Export Public API] ---
  return {
    getCursor,
    saveCursor,
    undo,
    redo,
    reset
  };
}
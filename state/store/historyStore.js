// ✅ store/historyStore.js (개선된 최종 버전)
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

    // 💡 신규 함수: 특정 라인의 변경 여부 확인 (현재 상태 vs 직전 상태)
    isLineChanged: (lineIndex) => {
      // 직전 상태를 가져옵니다.
      const prevEditorState = history[currentIndex - 1]?.editorState;
      // 현재 상태를 가져옵니다.
      const currEditorState = history[currentIndex].editorState;

      // 1. 이전 상태가 없으면 (최초 렌더링 등) 무조건 변경된 것으로 간주
      if (!prevEditorState) return true;

      const prevLine = prevEditorState[lineIndex];
      const currLine = currEditorState[lineIndex];

      // 2. 라인 자체가 존재하지 않으면 (삭제, 삽입 시 배열 길이 변경) 변경된 것으로 간주
      if (!prevLine || !currLine) {
        // 현재 라인이 있거나, 이전 라인이 있었으면 (배열 길이 변경) 변경으로 처리
        if (prevLine || currLine) return true;
        // 둘 다 null이면 변경 없음 (배열 바깥)
        return false; 
      }
      
      // 3. JSON.stringify를 이용한 깊은 비교
      // 이 라인 모델의 align, chunks 배열 및 내부 청크 상태/스타일을 모두 비교합니다.
      return JSON.stringify(prevLine) !== JSON.stringify(currLine);
    },

    getChangedMap: () => {
      const prev = history[currentIndex - 1]?.editorState || [];
      const curr = history[currentIndex]?.editorState || [];

      const changed = {};
      const maxLen = Math.max(prev.length, curr.length);

      for (let i = 0; i < maxLen; i++) {
        // JSON.stringify를 이용한 깊은 비교
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
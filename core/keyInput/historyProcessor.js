/**
 * 히스토리(Undo/Redo) 실행 프로세서
 */
export function executeHistory(type, { state, ui, domSelection }) {
    // 1. 히스토리 스택에서 상태와 커서 정보 추출
    // type: 'undo' | 'redo'
    const historyData = state[type]();
    if (!historyData) return;

    const { state: newState, cursor } = historyData;

    /**
     * 💡 [중요] newState가 단일 배열이 아니라 
     * { "myEditor-content": [...], "td-123": [...] } 형태의 Map 구조여야 합니다.
     */
    if (!newState) return;

    // 2. 전체 UI 렌더링
    // 모든 컨테이너(본문 및 모든 테이블 셀)의 상태를 동기화합니다.
    ui.render(newState);

    // 3. 커서 복원
    if (cursor) {
        /**
         * 💡 개선 포인트: 
         * 저장된 커서 객체에 이미 containerId가 포함되어 있으므로
         * 구조 분해 할당을 통해 그대로 전달합니다.
         * cursor 예시: { 
         * containerId: 'td-123', 
         * lineIndex: 0, 
         * anchor: { chunkIndex: 0, type: 'text', offset: 5 } 
         * }
         */
        domSelection.restoreCursor({
            containerId: cursor.containerId, // 👈 어느 박스인지 알려줌
            lineIndex: cursor.lineIndex,
            anchor: cursor.anchor
        });
    }
}
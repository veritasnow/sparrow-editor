/**
 * 히스토리(Undo/Redo) 실행 프로세서
 */
export function executeHistory(type, { state, ui, domSelection }) {
    // 1. 히스토리 스택에서 상태와 커서 정보 추출 (undo/redo)
    const historyData = state[type]();
    if (!historyData) return;

    const { state: newStateMap, cursor } = historyData;

    /**
     * 💡 [중요] newStateMap은 전체 상태 맵입니다.
     * 예: { "main-content": [...], "cell-id-1": [...], "cell-id-2": [...] }
     */
    if (!newStateMap || typeof newStateMap !== 'object') return;

    // 2. 전체 UI 렌더링 (Key-Value 맵을 순회하며 각 컨테이너 동기화)
    // 💡 모든 저장된 영역을 찾아서 각각의 targetKey에 맞게 render를 호출합니다.
    Object.entries(newStateMap).forEach(([targetKey, lineDataArray]) => {
        try {
            // uiApplication.render(data, targetKey) 호출
            ui.render(lineDataArray, targetKey);
        } catch (error) {
            console.warn(`[History] Failed to render container ${targetKey}:`, error);
        }
    });

    // 3. 커서 복원
    if (cursor) {
        /**
         * cursor 객체 내부의 containerId를 사용하여 
         * 본문 혹은 특정 테이블 셀 내부로 포커스를 강제 이동시킵니다.
         */
        domSelection.restoreCursor({
            containerId: cursor.containerId, 
            lineIndex: cursor.lineIndex,
            anchor: cursor.anchor,
            focus: cursor.focus // 포커스 정보가 있다면 함께 전달
        });
    }
}
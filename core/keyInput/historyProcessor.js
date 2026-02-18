/**
 * 히스토리(Undo/Redo) 실행 프로세서
 */
export function executeHistory(type, { stateAPI, uiAPI, selectionAPI }) {
    // 1. 현재(이동 전)의 정확한 커서 정보 미리 확보
    const cursor = stateAPI.getCursor();
    
    // 2. 히스토리 스택 이동 (undo/redo 실행)
    const historyData = stateAPI[type](); 
    if (!historyData || !historyData.state) return;

    const { state: newStateMap } = historyData;

    // 3. 전체 UI 렌더링 (각 컨테이너별 동기화)
    Object.entries(newStateMap).forEach(([targetKey, lineDataArray]) => {
        try {
            uiAPI.render(lineDataArray, targetKey);
        } catch (error) {
            console.warn(`[History] Render failed for ${targetKey}:`, error);
        }
    });

    // 4. 미리 확보한 커서 정보로 위치 복원
    if (cursor) {
        selectionAPI.restoreCursor(cursor);
    }
}
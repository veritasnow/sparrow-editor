// sparrow-editor\service\align\editorAlignService.js
/**
 * 텍스트 정렬 변경의 핵심 비즈니스 로직을 제공하는 서비스 모듈.
 * (DOM에 의존하지 않고, 주입된 콜백을 통해 에디터 상태를 변경합니다.)
 */
export function createEditorAlignService(app, ui, updateAndRestore) {

    /**
     * 현재 선택된 라인들의 정렬(align) 상태를 변경하고 에디터에 반영합니다.
     * @param {string} alignType - 'left', 'center', 'right' 중 하나
     */
    function applyAlign(alignType) {
        // 1. 현재 선택 영역의 상태 정보 가져오기
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const currentState = app.getState().present.editorState;
        // ui.getSelectionRangesInState는 UI 레이어의 기능(선택 영역 파악)입니다.
        // getSelectionRangesInState 상태를 던져서 선택영역을 가져온다인데 state값만 넘기는 구조로 바꾸는게 좋을거 같음
        const ranges = ui.getSelectionRangesInState(currentState); 
        if (!ranges || ranges.length === 0) return;

        // ✅ 선택 영역의 시작 및 끝 라인 인덱스 계산
        const startLineIndex = Math.min(...ranges.map(r => r.lineIndex));
        const endLineIndex = Math.max(...ranges.map(r => r.lineIndex));

        const newState = [...currentState];

        // 2. 상태 변경 로직
        for (let i = startLineIndex; i <= endLineIndex; i++) {
            if (!newState[i]) continue;
            newState[i] = {
                ...newState[i],
                align: alignType // 정렬 타입 변경
            };
        }

        // 3. 상태 저장 및 UI 업데이트 요청 (주입된 콜백 사용)
        app.saveEditorState(newState);

        // ✅ 선택 영역이 유지되도록 커서 복원 위치 파악
        const pos = ui.getSelectionPosition();
        updateAndRestore(pos);
    }

    return { applyAlign };
}
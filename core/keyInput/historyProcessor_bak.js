/**
 * 히스토리(Undo/Redo) 실행 프로세서
 */
export function executeHistory(type, { state, ui, domSelection }) {
    // 1. 히스토리 스택에서 상태와 커서 정보 추출
    // type은 'undo' 또는 'redo'
    const { state: newState, cursor } = state[type]();

    if (!newState || !newState.editorState) return;

    // 2. 전체 UI 렌더링
    // 언두/레두는 문서의 많은 부분이 바뀔 수 있으므로 renderLine보다는 
    // 전체를 다시 그리는 render가 안전합니다.
    ui.render(newState.editorState);

    // 3. 커서 복원
    if (cursor) {
        /**
         * 엔터나 이미지 삽입 시 저장했던 커서 구조와 동일하게 전달합니다.
         * cursor 예시: { 
         * lineIndex: 1, 
         * anchor: { chunkIndex: 0, type: 'text', offset: 0 } 
         * }
         */
        domSelection.restoreCursor({
            lineIndex: cursor.lineIndex,
            anchor: cursor.anchor // 개선된 anchor 구조를 그대로 사용
        });
    }
}
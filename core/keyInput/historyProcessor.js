/**
 * 히스토리(Undo/Redo) 실행 프로세서
 */
export function executeHistory(type, { state, ui, domSelection }) {
    // type은 'undo' 또는 'redo'
    const { state: newState, cursor } = state[type]();

    if (!cursor) {
        ui.render(newState.editorState);
        return;
    }

    // 변경된 라인 렌더링
    ui.renderLine(cursor.lineIndex, newState.editorState[cursor.lineIndex]);

    // 커서 복원 (구형 offset 구조 대응)
    domSelection.restoreCursor({
        lineIndex: cursor.lineIndex,
        offset: cursor.endOffset
    });
}
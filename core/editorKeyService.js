// service/keyInput/editorKeyService.js
import { calculateEnterState, calculateBackspaceState } from '../utils/keyStateUtil.js'; 
import { getLineLengthFromState } from '../utils/editorStateUtils.js'; // 💡 신규 유틸리티 임포트

/**
 * 에디터의 Enter 및 Backspace 키다운 이벤트에 따른 핵심 상태 관리 로직을 처리하는 서비스 팩토리입니다.
 * @param {Object} app - Editor State Application
 * @param {Object} ui - UI Application (DOM/Selection/Rendering)
 * @returns {Object} processEnter, processBackspace 함수를 포함하는 객체
 */
export function createEditorKeyService(app, ui) {

    /**
     * 현재 커서 위치를 파악하고, 상태 및 DOM에 Enter 키 입력을 반영하여 줄바꿈을 수행합니다.
     */
    function processEnter() {
        // 1. 상태 및 위치 파악 (Controller/Service 책임)
        const currentState = app.getState().present.editorState;
        
        // 💡 [변경] UI에서 순수 DOM 범위만 가져옵니다.
        const domRanges = ui.getSelectionRangesInDOM(); 
        if (!domRanges || domRanges.length === 0) return;

        // 💡 [추가] 단일 커서 위치를 State 길이에 맞춰 클램프합니다. (도메인 책임)
        const { lineIndex, endIndex: domOffset } = domRanges[0];
        const lineState = currentState[lineIndex];
        const lineLen = getLineLengthFromState(lineState);
        const offset = Math.max(0, Math.min(domOffset, lineLen)); // State 기반 오프셋

        // 💡 2. 상태 계산 위임 (Pure Logic)
        const { newState, newPos, newLineData } = calculateEnterState(currentState, lineIndex, offset);

        // 3. 상태 저장 (Side Effect)
        app.saveEditorState(newState);

        // 4. 커서저장
        app.saveCursorState({
            lineIndex  : newPos.lineIndex,
            startOffset: 0,
            endOffset  : newPos.offset
        });

        // 5. DOM 구조 반영 및 렌더링 (Side Effect)
        ui.insertNewLineElement(lineIndex + 1, newLineData.align); 
        ui.renderLine(lineIndex, newState[lineIndex]);
        ui.renderLine(lineIndex + 1, newLineData);

        // 6. 커서 이동 (Side Effect)
        ui.restoreSelectionPosition(newPos);
    }

    /**
     * 현재 커서 위치를 파악하고, 상태 및 DOM에 Backspace 키 입력을 반영하여 삭제/줄 병합을 수행합니다.
     */
    function processBackspace() {
        // 1. 상태 및 위치 파악 (Controller/Service 책임)
        const currentState = app.getState().present.editorState;
        
        // 💡 [변경] UI에서 순수 DOM 범위만 가져옵니다.
        const domRanges = ui.getSelectionRangesInDOM(); 
        if (!domRanges || domRanges.length === 0) return;

        // 💡 [추가] 단일 커서 위치를 State 길이에 맞춰 클램프합니다. (도메인 책임)
        const { lineIndex, endIndex: domOffset } = domRanges[0];
        const lineState = currentState[lineIndex];
        const lineLen = getLineLengthFromState(lineState);
        const offset = Math.max(0, Math.min(domOffset, lineLen)); // State 기반 오프셋

        // 💡 2. 상태 계산 위임 (Pure Logic)
        const { newState, newPos, deletedLineIndex, updatedLineIndex } = calculateBackspaceState(
            currentState, lineIndex, offset
        );
        
        // 상태 변화가 없으면 바로 종료
        if (newState === currentState) return;

        // 3. 상태 저장 (Side Effect)
        app.saveEditorState(newState);

        // 4. 커서저장
        app.saveCursorState({
            lineIndex  : newPos.lineIndex,
            startOffset: 0,
            endOffset  : newPos.offset
        });

        // 5. DOM 구조 반영 및 렌더링 (Side Effect)
        if (deletedLineIndex !== null) {
            ui.removeLineElement(deletedLineIndex); // UI 구조 변경 요청
        }

        if (updatedLineIndex !== null) {
            ui.renderLine(updatedLineIndex, newState[updatedLineIndex]); // UI 내용 렌더링 요청
        }
        
        // 6. 커서 이동 (Side Effect)
        if (newPos) ui.restoreSelectionPosition(newPos);
    }

    /**
     * Undo / Redo
     */
    function undo() {
        const { state, cursor } = app.undo();
        ui.render(state.editorState);
        if (cursor) ui.restoreSelectionPosition({lineIndex: cursor.lineIndex, offset: cursor.endOffset});
    }

    function redo() {
        const { state, cursor } = app.redo();
        ui.render(state.editorState);
        if (cursor) ui.restoreSelectionPosition({lineIndex: cursor.lineIndex, offset: cursor.endOffset});
    }

    return {
        processEnter,
        processBackspace,
        undo,
        redo
    };
}
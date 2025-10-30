// service/key/editorKeyService.js
import { calculateEnterState, calculateBackspaceState } from './keyStateUtil.js'; 

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
        const ranges = ui.getSelectionRangesInState(currentState);
        if (!ranges || ranges.length === 0) return;

        const { lineIndex, endIndex: offset } = ranges[0];

        // 💡 2. 상태 계산 위임 (Pure Logic)
        const { newState, newPos, newLineData } = calculateEnterState(currentState, lineIndex, offset);

        // 3. 상태 저장 (Side Effect)
        app.saveEditorState(newState);

        // 4. DOM 구조 반영 및 렌더링 (Side Effect)
        // DOM 구조 삽입 (UI 위임)
        ui.insertNewLineElement(lineIndex + 1, newLineData.align); 

        // DOM 내용 렌더링 (변경된 두 라인 모두 렌더)
        ui.renderLine(lineIndex, newState[lineIndex]);
        ui.renderLine(lineIndex + 1, newLineData);

        // 5. 커서 이동 (Side Effect)
        ui.restoreSelectionPosition(newPos);
    }

    /**
     * 현재 커서 위치를 파악하고, 상태 및 DOM에 Backspace 키 입력을 반영하여 삭제/줄 병합을 수행합니다.
     */
    function processBackspace() {
        // 1. 상태 및 위치 파악 (Controller/Service 책임)
        const currentState = app.getState().present.editorState;
        const ranges = ui.getSelectionRangesInState(currentState);
        if (!ranges || ranges.length === 0) return;

        const { lineIndex, endIndex: offset } = ranges[0];

        // 💡 2. 상태 계산 위임 (Pure Logic)
        const { newState, newPos, deletedLineIndex, updatedLineIndex } = calculateBackspaceState(
            currentState, 
            lineIndex, 
            offset
        );
        
        // 상태 변화가 없으면 바로 종료 (예: 첫 줄 맨 앞에서 backspace)
        if (newState === currentState) return;

        // 3. 상태 저장 (Side Effect)
        app.saveEditorState(newState);

        // 4. DOM 구조 반영 및 렌더링 (Side Effect)
        
        // 4-1. 라인 삭제 (줄 병합 또는 빈 줄 삭제 시)
        if (deletedLineIndex !== null) {
            ui.removeLineElement(deletedLineIndex); // UI 구조 변경 요청
        }

        // 4-2. 라인 업데이트 (병합된 이전 라인 렌더링 또는 글자 삭제)
        if (updatedLineIndex !== null) {
            ui.renderLine(updatedLineIndex, newState[updatedLineIndex]); // UI 내용 렌더링 요청
        }
        
        // 5. 커서 이동 (Side Effect)
        if (newPos) ui.restoreSelectionPosition(newPos);
    }

    return {
        processEnter,
        processBackspace
    };
}
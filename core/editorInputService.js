// service/input/editorInputService.js
import { calculateNextLineState } from '../utils/inputUtils/inputStateUtil.js'; 
import { EditorLineModel } from '../model/editorModel.js'; // 💡 EditorLineModel 임포트 가정

/**
 * 에디터의 입력(Input) 이벤트 발생 시, State를 업데이트하고
 * UI 렌더링을 요청하는 핵심 도메인 로직을 처리하는 서비스 팩토리입니다.
 * * @param {Object} app - Editor State Application
 * @param {Object} ui - UI Application (DOM/Selection/Rendering)
 * @returns {Object} processInput 함수
 */
export function createEditorInputService(app, ui) {

    /**
     * DOM의 현재 상태를 읽어 State에 반영하고, 필요한 UI 갱신을 요청합니다.
     */
    function processInput() {
        
        const selectionContext = ui.getSelectionContext();
        if (!selectionContext) return;
        
        // 1. 선택 영역 및 DOM 정보
        const { 
            lineIndex, 
            dataIndex          
        } = selectionContext; 
        
        ui.ensureFirstLine();

        if (lineIndex < 0) return;

        const currentState   = app.getState().present.editorState;
        
        // 💡 [수정] 라인이 없을 경우 DTO 리터럴 대신 Model 팩토리 사용
        //    -> Model이 불변성과 기본값을 보장
        const currentLine    = currentState[lineIndex] || EditorLineModel(); // Model 사용

        // 💡 1. 상태 계산 위임 (Pure Logic)
        const { updatedLine, restoreData, isNewChunk, isChunkRendering } = calculateNextLineState(
            currentLine, 
            selectionContext, 
        );

        // 💡 2. 상태 저장 (Core 책임: Side Effect)
        if (isNewChunk || isChunkRendering) {
            const nextState      = [...currentState];
            nextState[lineIndex] = updatedLine;
            app.saveEditorState(nextState);
        } else {
            // 상태 변화가 없으면 저장하지 않음 (undo/redo 히스토리 절약)
            return;
        }


        // 💡 3. 렌더링 및 커서 복원 (UI 요청: Side Effect)
        if (isNewChunk) {
            ui.renderLine(lineIndex, updatedLine);
            
            if (restoreData) {
                ui.restoreSelectionPositionByChunk(restoreData);
            }
        } else if (isChunkRendering) {
            // 청크 부분만 업데이트 (성능 최적화)
            ui.renderChunk(lineIndex, dataIndex, updatedLine.chunks[dataIndex]);
            ui.restoreSelectionPositionByChunk(restoreData);
        }
    }

    return {
        processInput
    };
}

// service/keyInput/editorKeyHandler.js

import { calculateEnterState, calculateBackspaceState } from '../utils/keyStateUtil.js';
import { getLineLengthFromState } from '../utils/editorStateUtils.js';
import { getRanges } from "../../utils/rangeUtils.js";

/**
 * 💚 EditorKeyService
 */
export function createEditorKeyHandler({ state, ui }) {

    // ... processEnter 함수 (기존과 동일) ...
    function processEnter() { 
        const currentState = state.get();
        const domRanges = ui.getDomSelection();
        if (!domRanges || domRanges.length === 0) return;

        const { lineIndex, endIndex: domOffset } = domRanges[0];
        const lineState = currentState[lineIndex];
        const lineLen = getLineLengthFromState(lineState);
        const offset = Math.max(0, Math.min(domOffset, lineLen));

        const { newState, newPos, newLineData } =
            calculateEnterState(currentState, lineIndex, offset);

        state.save(newState);
        state.saveCursor({
            lineIndex  : newPos.lineIndex,
            startOffset: 0,
            endOffset  : newPos.offset
        });

        ui.insertLine(lineIndex + 1, newLineData.align);
        if (state.isLineChanged(lineIndex)) {
            ui.renderLine(lineIndex, newState[lineIndex]);
        }
        if (state.isLineChanged(lineIndex + 1)) {
            ui.renderLine(lineIndex + 1, newLineData); 
        }    
        ui.restoreCursor(newPos);
    }

    /**
     * BACKSPACE 처리
     * -------------------------------------------------------
     */
    function processBackspace() {
        const currentState = state.get();
        const domRanges = ui.getDomSelection();
        if (!domRanges || domRanges.length === 0) return;

        // 1. 필요한 변수를 let으로 선언하여 재할당이 가능하게 함
        const firstDomRange = domRanges[0];
        let lineIndex = firstDomRange.lineIndex;
        let offset = firstDomRange.endIndex; // 초기 offset은 DOM의 끝점(커서 위치)

        const domStartOffset = firstDomRange.startIndex;
        
        let ranges = [];

        // 2. 선택 영역 유무 확인 및 ranges/offset 설정
        const isSelection = domRanges.length > 1 || domStartOffset !== firstDomRange.endIndex;

        if (isSelection) {
            // 선택 영역이 있을 경우, ranges 정보 생성
            ranges = getRanges(currentState, domRanges);

            // 선택 영역 삭제 시, lineIndex와 offset을 선택 영역의 시작점으로 재설정
            const startRange = ranges[0];
            
            lineIndex = startRange.lineIndex; 
            offset = startRange.startIndex; 
            
        } else {
            // 선택 영역이 없을 경우, 커서 위치(offset)만 보정
            const lineState = currentState[lineIndex];
            const lineLen = getLineLengthFromState(lineState);
            offset = Math.max(0, Math.min(offset, lineLen));
        }

        // 🧠 순수 상태 계산 (calculateBackspaceState에 ranges를 전달)
        const { newState, newPos, deletedLineIndex, updatedLineIndex } =
            calculateBackspaceState(currentState, lineIndex, offset, ranges);
        
        // 상태 변화가 없으면 종료
        if (newState === currentState) return;

        // 💚 상태 + 커서 저장
        state.save(newState);
        
        if (newPos) {
            state.saveCursor({
                lineIndex  : newPos.lineIndex,
                startOffset: newPos.offset, // 선택 삭제 시 start/end 오프셋을 동일하게 설정
                endOffset  : newPos.offset
            });
        }

        // 🎨 UI 반영
        if (deletedLineIndex !== null) {
            // deletedLineIndex가 객체({ start, count })일 경우 (다중 라인 삭제)
            if (typeof deletedLineIndex === 'object' && deletedLineIndex.count > 0) {
                // start 인덱스부터 count만큼 라인을 반복적으로 제거
                for (let i = 0; i < deletedLineIndex.count; i++) {
                    ui.removeLine(deletedLineIndex.start); 
                }
            } 
            // deletedLineIndex가 숫자일 경우 (단일 라인 병합으로 인한 삭제)
            else if (typeof deletedLineIndex === 'number') {
                ui.removeLine(deletedLineIndex);
            }
        }
        
        if (updatedLineIndex !== null) {
            if (state.isLineChanged(updatedLineIndex)) {
                ui.renderLine(updatedLineIndex, newState[updatedLineIndex]);
            }
        }

        // 🎨 커서 복원
        if (newPos) {
            ui.restoreCursor(newPos);
        }
    }

    function callUndo() {
        const { state: newState, cursor } = state.undo();

        if (!cursor) {
            ui.render(newState.editorState);
            return;
        }

        if (state.isLineChanged(cursor.lineIndex)) {
            ui.renderLine(cursor.lineIndex, newState.editorState[cursor.lineIndex]);
        }

        ui.restoreCursor({
            lineIndex: cursor.lineIndex,
            offset: cursor.endOffset
        });
    }

    function callRedo() {
        const { state: newState, cursor } = state.redo();
        
        if (!cursor) {
            ui.render(newState.editorState);
            return;
        }

        if (state.isLineChanged(cursor.lineIndex)) {
            ui.renderLine(cursor.lineIndex, newState.editorState[cursor.lineIndex]);
        }

        ui.restoreCursor({
            lineIndex: cursor.lineIndex,
            offset: cursor.endOffset
        });
    }

    // 외부 API
    return {
        processEnter,
        processBackspace,
        undo : callUndo,
        redo : callRedo
    };
}
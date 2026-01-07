// service/keyInput/editorKeyHandler.js

import { calculateEnterState, calculateBackspaceState } from '../utils/keyStateUtil.js';
import { getLineLengthFromState } from '../utils/editorStateUtils.js';
import { getRanges } from "../utils/rangeUtils.js";

/**
 * 💚 EditorKeyService
 */
export function createEditorKeyHandler({ state, ui, domSelection }) {

    function processEnter() { 
       const currentState = state.get();
        const domRanges = domSelection.getDomSelection();
        console.log("domRanges:", domRanges);
        if (!domRanges || domRanges.length === 0) return;

        const { lineIndex, endIndex: domOffset } = domRanges[0];
        const lineState = currentState[lineIndex];
        const lineLen = getLineLengthFromState(lineState);
        const offset = Math.max(0, Math.min(domOffset, lineLen));

        const { newState, newPos, newLineData } = calculateEnterState(currentState, lineIndex, offset);

        console.log('Enter Key Processed:', newPos);

        state.save(newState);
        state.saveCursor(newPos);

        ui.insertLine(lineIndex + 1, newLineData.align);

        ui.renderLine(lineIndex, newState[lineIndex]);
        ui.renderLine(lineIndex + 1, newLineData); 
        domSelection.restoreCursor(newPos);
    }

    

    /**
     * BACKSPACE 처리
     * -------------------------------------------------------
     */
    function processBackspace(e) {
        const currentState = state.get();
        const domRanges = domSelection.getDomSelection();
        
        if (!domRanges || domRanges.length === 0) return;

        const firstDomRange = domRanges[0];
        let lineIndex = firstDomRange.lineIndex;
        let offset = firstDomRange.endIndex; // DOM 기준 offset

        const isSelection = domRanges.length > 1 || firstDomRange.startIndex !== firstDomRange.endIndex;
        
        // 1. 테이블 첫 셀 보호 로직
        if (!isSelection) {
            const pos = domSelection.getSelectionPosition(); // 현재 상세 좌표 획득
            if (pos && pos.anchor.type === 'table') {
                const { offset: tableOffset, detail } = pos.anchor;
                if (detail.rowIndex === 0 && detail.colIndex === 0 && tableOffset === 0) {
                    e.preventDefault();
                    return;
                }
            }
        }

        // 2. 선택 영역 데이터 구성 (기존 유틸 활용)
        let ranges = [];
        if (isSelection) {
            ranges = getRanges(currentState, domRanges);
            const startRange = ranges[0];
            lineIndex = startRange.lineIndex;
            offset = startRange.startIndex;
        } else {
            const lineState = currentState[lineIndex];
            const lineLen = getLineLengthFromState(lineState);
            offset = Math.max(0, Math.min(offset, lineLen));
        }

        // 3. 🧠 상태 계산 (newPos는 { lineIndex, anchor: { chunkIndex, type, offset } } 구조)
        const { newState, newPos, deletedLineIndex, updatedLineIndex } =
            calculateBackspaceState(currentState, lineIndex, offset, ranges);
        
        if (newState === currentState) return;

        // 4. 💚 상태 저장
        state.save(newState);
        
        // 5. 📍 커서 상태 저장 (수정됨: 객체 구조 그대로 전달)
        if (newPos) {
            // state.saveCursor 내부에 startOffset/endOffset 구조를 유지해야 한다면 
            // newPos 구조를 맞추거나, saveCursor가 anchor 모델을 지원하도록 내부 수정 필요
            state.saveCursor(newPos); 
        }

        // 6. 🎨 UI 반영
        if (deletedLineIndex !== null) {
            if (typeof deletedLineIndex === 'object' && deletedLineIndex.count > 0) {
                for (let i = 0; i < deletedLineIndex.count; i++) {
                    ui.removeLine(deletedLineIndex.start);
                }
            } else if (typeof deletedLineIndex === 'number') {
                ui.removeLine(deletedLineIndex);
            }
        }
        
        if (updatedLineIndex !== null) {
            ui.renderLine(updatedLineIndex, newState[updatedLineIndex]);
        }

        // 7. 🎨 커서 복원 (수정됨: anchor 모델을 포함한 newPos 전달)
        if (newPos) {
            domSelection.restoreCursor(newPos);
        }
    }

    function callUndo() {
        const { state: newState, cursor } = state.undo();

        if (!cursor) {
            ui.render(newState.editorState);
            return;
        }

            ui.renderLine(cursor.lineIndex, newState.editorState[cursor.lineIndex]);

        domSelection.restoreCursor({
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

        ui.renderLine(cursor.lineIndex, newState.editorState[cursor.lineIndex]);

        domSelection.restoreCursor({
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
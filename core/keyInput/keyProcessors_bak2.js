import { calculateEnterState, calculateBackspaceState } from '../../utils/keyStateUtil.js';
import { getLineLengthFromState } from '../../utils/editorStateUtils.js';
import { getRanges } from "../../utils/rangeUtils.js";
import { chunkRegistry } from '../chunk/chunkRegistry.js'; // 레지스트리 도입

/**
 * 엔터 키 실행 프로세서
 */
export function executeEnter({ state, ui, domSelection }) {
    // 1. 현재 커서가 위치한 영역의 고유 Key(ID)를 획득
    // 본문이면 'myEditor-content', 테이블 셀이면 TD의 ID
    const activeKey = domSelection.getActiveKey();
    if (!activeKey) return;

    // 2. 해당 영역의 상태(배열)만 가져오기
    const currentState = state.get(activeKey);
    
    // 3. DOM 선택 영역 정보 가져오기
    const domRanges = domSelection.getDomSelection();
    if (!domRanges || domRanges.length === 0) return;

    // 4. 오프셋 계산 (기존 로직 유지)
    const { lineIndex, endIndex: domOffset } = domRanges[0];
    const lineState = currentState[lineIndex];
    if (!lineState) return;

    const lineLen = getLineLengthFromState(lineState);
    const offset = Math.max(0, Math.min(domOffset, lineLen));

    // 5. 상태 계산 (순수 함수 호출)
    const { newState, newPos, newLineData } = calculateEnterState(currentState, lineIndex, offset);

    // 6. 상태 저장 (Key를 명시하여 해당 영역만 업데이트)
    state.save(activeKey, newState);
    
    // 커서 정보에도 어느 영역인지(containerId) 함께 기록
    const finalPos = { ...newPos, containerId: activeKey };
    state.saveCursor(finalPos);

    // 7. UI 반영 및 커서 복원
    ui.insertLine(lineIndex + 1, newLineData.align);
    ui.renderLine(lineIndex, newState[lineIndex]);
    ui.renderLine(lineIndex + 1, newLineData);
    
    // 최종 위치(activeKey 포함)로 커서 이동
    domSelection.restoreCursor(finalPos);
}

/**
 * 백스페이스 키 실행 프로세서
 */
export function executeBackspace(e, { state, ui, domSelection }) {
    // 💡 1. 현재 커서가 위치한 컨테이너의 Key(ID)를 획득
    const activeKey = domSelection.getActiveKey();
    if (!activeKey) return;

    // 💡 2. 해당 영역의 상태 데이터만 가져오기
    const currentState = state.get(activeKey);
    
    const domRanges = domSelection.getDomSelection();
    if (!domRanges || domRanges.length === 0) return;

    const firstDomRange = domRanges[0];
    let lineIndex = firstDomRange.lineIndex;
    let offset = firstDomRange.endIndex;

    const isSelection = domRanges.length > 1 || firstDomRange.startIndex !== firstDomRange.endIndex;

    // 1. 테이블 첫 셀 보호 로직 (기존 유지)
    if (!isSelection) {
        const pos = domSelection.getSelectionPosition();
        if (pos && pos.anchor.type === 'table') {
            const { offset: tableOffset, detail } = pos.anchor;
            if (detail.rowIndex === 0 && detail.colIndex === 0 && tableOffset === 0) {
                e.preventDefault();
                return;
            }
        }
    }

    // 2. 선택 영역 데이터 구성 및 오프셋 보정
    let ranges = [];
    if (isSelection) {
        // 💡 getRanges에도 현재 activeState를 전달하여 해당 영역 안에서 계산하도록 함
        ranges = getRanges(currentState, domRanges);
        const startRange = ranges[0];
        lineIndex = startRange.lineIndex;
        offset = startRange.startIndex;
    } else {
        const currentLine = currentState[lineIndex];
        if (!currentLine) return;

        // Atomic 노드 보정 (비디오 등)
        if (currentLine.chunks.length === 1) {
            const handler = chunkRegistry.get(currentLine.chunks[0].type);
            if (handler && !handler.canSplit && offset === 0) {
                offset = 1; 
            }
        }

        const lineLen = getLineLengthFromState(currentLine);
        offset = Math.max(0, Math.min(offset, lineLen));
    }

    // 3. 상태 계산 (수정된 offset 전달)
    const { newState, newPos, deletedLineIndex, updatedLineIndex } =
        calculateBackspaceState(currentState, lineIndex, offset, ranges);

    if (newState === currentState) return;

    // 💡 4. 저장 (Key 기반 히스토리 관리)
    state.save(activeKey, newState);
    
    let finalPos = null;
    if (newPos) {
        finalPos = { ...newPos, containerId: activeKey }; // 커서 정보에 영역 ID 추가
        state.saveCursor(finalPos);
    }

    // 5. UI 반영 (기존 유지)
    if (deletedLineIndex !== null) {
        if (typeof deletedLineIndex === 'object' && deletedLineIndex.count > 0) {
            for (let i = 0; i < deletedLineIndex.count; i++) {
                ui.removeLine(deletedLineIndex.start);
            }
        } else if (typeof deletedLineIndex === 'number') {
            ui.removeLine(deletedLineIndex);
        }
    }

    if (updatedLineIndex !== null && newState[updatedLineIndex]) {
        ui.renderLine(updatedLineIndex, newState[updatedLineIndex]);
    }

    // 6. 커서 복원 (영역 정보가 포함된 finalPos 사용)
    if (finalPos) {
        domSelection.restoreCursor(finalPos);
    }
}
import { calculateEnterState, calculateBackspaceState } from '../../utils/keyStateUtil.js';
import { getLineLengthFromState } from '../../utils/editorStateUtils.js';
import { getRanges } from "../../utils/rangeUtils.js";
import { chunkRegistry } from '../chunk/chunkRegistry.js'; // 레지스트리 도입

/**
 * 엔터 키 실행 프로세서
 */

export function executeEnter({ state, ui, domSelection }) {
    const currentState = state.get();
    const domRanges = domSelection.getDomSelection();
    if (!domRanges || domRanges.length === 0) return;

    const { lineIndex, endIndex: domOffset } = domRanges[0];
    const lineState = currentState[lineIndex];
    const lineLen = getLineLengthFromState(lineState);
    const offset = Math.max(0, Math.min(domOffset, lineLen));

    const { newState, newPos, newLineData } = calculateEnterState(currentState, lineIndex, offset);

    state.save(newState);
    state.saveCursor(newPos);

    ui.insertLine(lineIndex + 1, newLineData.align);
    ui.renderLine(lineIndex, newState[lineIndex]);
    ui.renderLine(lineIndex + 1, newLineData);
    domSelection.restoreCursor(newPos);
}


/**
 * 백스페이스 키 실행 프로세서
 */
export function executeBackspace(e, { state, ui, domSelection }) {
const currentState = state.get();
    const domRanges = domSelection.getDomSelection();
    if (!domRanges || domRanges.length === 0) return;

    const firstDomRange = domRanges[0];
    let lineIndex = firstDomRange.lineIndex;
    let offset    = firstDomRange.endIndex;

    const isSelection = domRanges.length > 1 || firstDomRange.startIndex !== firstDomRange.endIndex;

    // 1. 테이블 첫 셀 보호 로직
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
        ranges = getRanges(currentState, domRanges);
        const startRange = ranges[0];
        lineIndex = startRange.lineIndex;
        offset = startRange.startIndex;
    } else {
        const currentLine = currentState[lineIndex];

        // 🚀 [보정] 브라우저가 Atomic 노드 뒤에서 0을 줄 때 1로 강제 보정
        if (currentLine.chunks.length === 1) {
            const handler = chunkRegistry.get(currentLine.chunks[0].type);
            // 텍스트가 아니고(비디오 등), 오프셋이 0이라면
            if (handler && !handler.canSplit && offset === 0) {
                console.log("⚡ [보정] Atomic 노드 오프셋 0 -> 1");
                offset = 1; 
            }
        }

        // 기존에 사용하시던 함수 그대로 사용!
        const lineLen = getLineLengthFromState(currentLine);
        offset = Math.max(0, Math.min(offset, lineLen));
    }

    // 3. 상태 계산 (수정된 offset 전달)
    const { newState, newPos, deletedLineIndex, updatedLineIndex } =
        calculateBackspaceState(currentState, lineIndex, offset, ranges);

    // 변경사항이 없으면 리턴
    if (newState === currentState) return;

    // 4. 저장 (History 관리 포함)
    state.save(newState);
    if (newPos) state.saveCursor(newPos);

    // 5. UI 반영 (DOM 업데이트)
    if (deletedLineIndex !== null) {
        if (typeof deletedLineIndex === 'object' && deletedLineIndex.count > 0) {
            // 여러 줄 삭제 시
            for (let i = 0; i < deletedLineIndex.count; i++) {
                ui.removeLine(deletedLineIndex.start);
            }
        } else if (typeof deletedLineIndex === 'number') {
            // 한 줄 삭제(병합) 시
            ui.removeLine(deletedLineIndex);
        }
    }

    // 변경된 라인 리렌더링
    if (updatedLineIndex !== null && newState[updatedLineIndex]) {
        ui.renderLine(updatedLineIndex, newState[updatedLineIndex]);
    }

    // 6. 커서 복원 (모델 포지션을 기반으로 DOM 커서 재설정)
    if (newPos) {
        domSelection.restoreCursor(newPos);
    }
}

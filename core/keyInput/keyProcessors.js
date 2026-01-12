// /module/uiModule/processor/keyProcessor.js
import { calculateEnterState, calculateBackspaceState } from '../../utils/keyStateUtil.js';
import { getLineLengthFromState } from '../../utils/editorStateUtils.js';
import { getRanges } from "../../utils/rangeUtils.js";
import { chunkRegistry } from '../chunk/chunkRegistry.js';
import { normalizeCursorData } from '../../utils/cursorUtils.js';

/**
 * ⏎ 엔터 키 실행 프로세서
 */
export function executeEnter({ state, ui, domSelection }) {
    // 1. 현재 포커스된 컨테이너(본문 혹은 TD) ID 확보
    const activeKey = domSelection.getActiveKey();
    if (!activeKey) return;

    // 2. 해당 영역의 상태 및 커서 위치 정보 확보
    const currentState = state.get(activeKey);
    const domRanges = domSelection.getDomSelection();
    if (!domRanges || domRanges.length === 0) return;

    const { lineIndex, endIndex: domOffset } = domRanges[0];
    const lineState = currentState[lineIndex];
    if (!lineState) return;

    const lineLen = getLineLengthFromState(lineState);
    const offset = Math.max(0, Math.min(domOffset, lineLen));

    // 3. 상태 계산 (테이블/이미지는 Atomic이므로 쪼개지지 않고 다음 줄로 밀려남)
    const { newState, newPos, newLineData } = calculateEnterState(currentState, lineIndex, offset);

    // 4. 상태 저장
    state.save(activeKey, newState);

    // 5. 커서 데이터 정규화 및 저장
    const finalPos = normalizeCursorData({ ...newPos, containerId: activeKey }, activeKey);
    if (finalPos) {
        state.saveCursor(finalPos);
    }

    // 6. UI 반영 (activeKey를 전달하여 해당 컨테이너만 업데이트)
    ui.insertLine(lineIndex + 1, newLineData.align, activeKey); 
    ui.renderLine(lineIndex, newState[lineIndex], activeKey);
    ui.renderLine(lineIndex + 1, newLineData, activeKey);
    
    // 7. 커서 복원
    if (finalPos) {
        domSelection.restoreCursor(finalPos);
    }
}


/**
 * ⌫ 백스페이스 키 실행: Atomic(이미지/테이블) 삭제 및 라인 병합
 */
export function executeBackspace(e, { state, ui, domSelection }) {
    // 1. 현재 활성화된 영역(본문 root 혹은 특정 TD) ID 확보
    const activeKey = domSelection.getActiveKey();
    if (!activeKey) return;

    // 2. 해당 영역의 상태 및 DOM 선택 정보 확보
    const currentState = state.get(activeKey);
    const domRanges = domSelection.getDomSelection();
    if (!domRanges || domRanges.length === 0) return;

    const firstDomRange = domRanges[0];
    let lineIndex = firstDomRange.lineIndex;
    let offset = firstDomRange.endIndex;

    // 드래그 선택 여부 확인
    const isSelection = domRanges.length > 1 || firstDomRange.startIndex !== firstDomRange.endIndex;

    // --- [Step 1] 셀 보호 로직 ---
    if (!isSelection) {
        const activeContainer = document.getElementById(activeKey);
        const isCell = activeContainer?.tagName === 'TD' || activeContainer?.tagName === 'TH';
        
        // 테이블 셀 내부의 맨 첫 칸(0행 0열)에서 밖으로 나가는 삭제 방지
        if (isCell && lineIndex === 0 && offset === 0) {
            e.preventDefault();
            return;
        }
    }

    // --- [Step 2] 위치 및 Atomic(이미지/테이블) 보정 ---
    let ranges = [];
    if (isSelection) {
        // 드래그 선택 시 해당 범위 데이터 추출
        ranges = getRanges(currentState, domRanges);
        const startRange = ranges[0];
        lineIndex = startRange.lineIndex;
        offset = startRange.startIndex;
    } else {
        const currentLine = currentState[lineIndex];
        if (!currentLine) return;

        // Atomic 노드(이미지/테이블) 바로 뒤에서 삭제 시, 
        // 커서 위치를 보정하여 해당 노드가 삭제 대상으로 잡히게 함
        const context = domSelection.getSelectionContext();
        if (context && context.dataIndex !== null) {
            const targetChunk = currentLine.chunks[context.dataIndex];
            const handler = chunkRegistry.get(targetChunk.type);
            
            // table/image 핸들러는 canSplit이 false이므로 여기서 보정됨
            if (handler && !handler.canSplit && offset === 0) {
                offset = 1; 
            }
        }
        const lineLen = getLineLengthFromState(currentLine);
        offset = Math.max(0, Math.min(offset, lineLen));
    }

    // --- [Step 3] 상태 계산 (Atomic 삭제 및 줄 병합 로직 실행) ---
    const { newState, newPos, deletedLineIndex, updatedLineIndex } =
        calculateBackspaceState(currentState, lineIndex, offset, ranges);

    // 변경사항이 없으면 종료
    if (newState === currentState) return;

    // --- [Step 4] 저장 및 UI 동기화 ---
    state.save(activeKey, newState);
    
    // 유틸리티를 사용하여 커서 위치 정규화 (containerId 주입)
    const finalPos = normalizeCursorData({ ...newPos, containerId: activeKey }, activeKey);

    if (finalPos) {
        // 1) 커서 상태 저장
        state.saveCursor(finalPos);

        // 2) 라인 삭제 처리 (💡 타입 체크 강화로 TypeError 방지)
        if (deletedLineIndex !== null && deletedLineIndex !== undefined) {
            let startIdx, deleteCount;

            if (typeof deletedLineIndex === 'object') {
                // { start, count } 객체인 경우 (선택 영역 삭제 상황)
                startIdx = deletedLineIndex.start;
                deleteCount = deletedLineIndex.count || 1;
            } else {
                // 숫자 인덱스인 경우 (일반적인 줄 병합 상황)
                startIdx = deletedLineIndex;
                deleteCount = 1;
            }

            for (let i = 0; i < deleteCount; i++) {
                ui.removeLine(startIdx, activeKey);
            }
        }

        // 3) 업데이트된 라인 리렌더링
        if (updatedLineIndex !== null && newState[updatedLineIndex]) {
            ui.renderLine(updatedLineIndex, newState[updatedLineIndex], activeKey);
        }

        // 4) 최종 커서 복원
        domSelection.restoreCursor(finalPos);
    }
}
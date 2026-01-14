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
    console.log('executeBackspace activeKey :', activeKey);

    if (!activeKey) return;

    // 2. 해당 영역의 상태 및 커서 위치 정보 확보
    const currentState = state.get(activeKey);
    const domRanges = domSelection.getDomSelection(activeKey);
    console.log('executeEnter domRanges:', domRanges);
    if (!domRanges || domRanges.length === 0) return;

    const { lineIndex, endIndex: domOffset } = domRanges[0];
    const lineState = currentState[lineIndex];
    if (!lineState) return;

    const lineLen = getLineLengthFromState(lineState);
    const offset = Math.max(0, Math.min(domOffset, lineLen));

    // 3. 상태 계산 (새로운 줄 데이터 생성)
    const { newState, newPos, newLineData } = calculateEnterState(currentState, lineIndex, offset);

    // 4. 상태 저장
    state.save(activeKey, newState);

    // 5. 커서 데이터 정규화 및 저장
    const finalPos = normalizeCursorData({ ...newPos, containerId: activeKey }, activeKey);
    if (finalPos) {
        state.saveCursor(finalPos);
    }

    // 6. UI 반영 (activeKey 전달 및 메서드명 매칭)
    // 💡 uiApplication에서 정의한 insertNewLineElement 사용
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
    // 1. 현재 활성화된 영역 ID 확보
    const activeKey = domSelection.getActiveKey();
    if (!activeKey) return;

    // 2. 해당 영역의 상태 및 DOM 선택 정보 확보
    const currentState = state.get(activeKey);
    const domRanges = domSelection.getDomSelection(activeKey);
    if (!domRanges || domRanges.length === 0) return;

    const firstDomRange = domRanges[0];
    let lineIndex = firstDomRange.lineIndex;
    let offset = firstDomRange.endIndex;

    console.log('firstDomRange:', firstDomRange);
    const isSelection = domRanges.length > 1 || firstDomRange.startIndex !== firstDomRange.endIndex;

    // --- [Step 1] 셀 보호 로직 ---
    if (!isSelection) {
        const activeContainer = document.getElementById(activeKey);
        const isCell = activeContainer?.tagName === 'TD' || activeContainer?.tagName === 'TH';
        
        // 테이블 셀 내부의 맨 첫 칸(0행 0열)에서 밖으로 나가는 삭제 방지 (중요!)
        if (isCell && lineIndex === 0 && offset === 0) {
            e.preventDefault();
            return;
        }
    }

    // --- [Step 2] 위치 및 Atomic(이미지/테이블) 보정 ---
    let ranges = [];
    if (isSelection) {
        ranges = getRanges(currentState, domRanges);
        const startRange = ranges[0];
        console.log('startRange:', startRange);
        
        lineIndex = startRange.lineIndex;
        
        // 🚀 핵심 수정: startIndex가 아닌 endIndex를 offset으로 잡아야 합니다.
        // 그래야 '이미지(0~7)' 선택 시 offset이 7이 되어 이미지를 지우는 로직으로 들어갑니다.
        offset = startRange.endIndex; 
        
        console.log('🎯 [Selection Fix] Offset set to endIndex:', offset, 'Ranges:', ranges);
    } else {
        const currentLine = currentState[lineIndex];
        if (!currentLine) return;

        const context = domSelection.getSelectionContext();
        if (context && context.dataIndex !== null) {
            const targetChunk = currentLine.chunks[context.dataIndex];
            const handler = chunkRegistry.get(targetChunk.type);
            
            // 커서가 0인데 Atomic 청크 뒤에 있는 경우 보정 (기존 로직 유지)
            if (handler && !handler.canSplit && offset === 0) {
                offset = 1; 
            }
        }
        const lineLen = getLineLengthFromState(currentLine);
        offset = Math.max(0, Math.min(offset, lineLen));
    }


        console.log('삭제중.....currentState :', currentState);
        console.log('삭제중.....lineIndex :', lineIndex);
        console.log('삭제중.....offset :', offset);
        console.log('삭제중.....ranges :', ranges);


    // --- [Step 3] 상태 계산 ---
    const { newState, newPos, deletedLineIndex, updatedLineIndex } =
        calculateBackspaceState(currentState, lineIndex, offset, ranges);

    if (newState === currentState) return;

    // --- [Step 4] 저장 및 UI 동기화 ---
    state.save(activeKey, newState);
    
    const finalPos = normalizeCursorData({ ...newPos, containerId: activeKey }, activeKey);

    if (finalPos) {
        console.log("테스트..!!");
        state.saveCursor(finalPos);

        // 💡 [중요] 라인 삭제 처리: uiApplication의 removeLine 호출
        if (deletedLineIndex !== null && deletedLineIndex !== undefined) {
            let startIdx, deleteCount;

            if (typeof deletedLineIndex === 'object') {
                startIdx = deletedLineIndex.start;
                deleteCount = deletedLineIndex.count || 1;
            } else {
                startIdx = deletedLineIndex;
                deleteCount = 1;
            }

            for (let i = 0; i < deleteCount; i++) {
                ui.removeLine(startIdx, activeKey);
            }
        }

        // 💡 업데이트된 라인 리렌더링 (activeKey 전달)
        if (updatedLineIndex !== null && newState[updatedLineIndex]) {
            ui.renderLine(updatedLineIndex, newState[updatedLineIndex], activeKey);
        }

        // 💡 만약 삭제 후 컨테이너가 완전히 비었다면 최소 한 줄 보장
        ui.ensureFirstLineP(activeKey);

        domSelection.restoreCursor(finalPos);
    }
}

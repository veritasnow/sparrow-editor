// /module/uiModule/processor/keyProcessor.js
import { calculateEnterState, calculateBackspaceState, calculateDeleteState } from '../../utils/keyStateUtil.js';
import { HtmlDeserializer } from '../convert/HtmlDeserializer.js';
import { getLineLengthFromState } from '../../utils/editorStateUtils.js';
import { getRanges } from "../../utils/rangeUtils.js";
import { chunkRegistry } from '../chunk/chunkRegistry.js';
import { normalizeCursorData } from '../../utils/cursorUtils.js';
import { splitLineAtOffset } from '../../utils/splitLineAtOffset.js';


import { EditorLineModel} from '../../model/editorLineModel.js';
import { mergeChunks} from '../../utils/mergeUtils.js';



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


/**
 * ⌦ Delete 키 실행: 커서 뒤의 문자 삭제 또는 다음 라인 병합
 */
export function executeDelete(e, { state, ui, domSelection }) {
    // 1. 현재 활성화된 영역 ID 확보
    const activeKey = domSelection.getActiveKey();
    if (!activeKey) return;

    // 2. 해당 영역의 상태 및 DOM 선택 정보 확보
    const currentState = state.get(activeKey);
    const domRanges = domSelection.getDomSelection(activeKey);
    if (!domRanges || domRanges.length === 0) return;

    const firstDomRange = domRanges[0];
    let lineIndex = firstDomRange.lineIndex;
    let offset = firstDomRange.startIndex; // Delete는 시작 지점 기준

    const isSelection = domRanges.length > 1 || firstDomRange.startIndex !== firstDomRange.endIndex;

    // --- [Step 1] 셀 보호 및 경계 검사 ---
    if (!isSelection) {
        const currentLine = currentState[lineIndex];
        const lineLen = getLineLengthFromState(currentLine);
        
        // 마지막 라인의 맨 끝에서 Delete를 누를 경우 동작 차단
        if (lineIndex === currentState.length - 1 && offset === lineLen) {
            e.preventDefault();
            return;
        }

        // 테이블 셀 내부 보호 (선택 영역이 없을 때 마지막 칸에서 나가는 것 방지)
        const activeContainer = document.getElementById(activeKey);
        const isCell = activeContainer?.tagName === 'TD' || activeContainer?.tagName === 'TH';
        if (isCell && lineIndex === currentState.length - 1 && offset === lineLen) {
            e.preventDefault();
            return;
        }
    }

    // --- [Step 2] 위치 및 범위 계산 ---
    let ranges = [];
    if (isSelection) {
        // 드래그 선택 상태라면 Backspace와 동일한 삭제 로직을 사용해도 무방합니다.
        ranges = getRanges(currentState, domRanges);
        const startRange = ranges[0];
        lineIndex = startRange.lineIndex;
        offset = startRange.startIndex; 
    } else {
        const currentLine = currentState[lineIndex];
        if (!currentLine) return;

        // Atomic(이미지 등) 바로 앞에서 Delete를 누를 경우 처리
        const context = domSelection.getSelectionContext();
        if (context && context.dataIndex !== null) {
            const targetChunk = currentLine.chunks[context.dataIndex];
            const handler = chunkRegistry.get(targetChunk.type);
            // 만약 현재 커서 위치가 Atomic 요소의 바로 시작점이라면 offset 보정 필요할 수 있음
        }
        
        const lineLen = getLineLengthFromState(currentLine);
        offset = Math.max(0, Math.min(offset, lineLen));
    }

    // --- [Step 3] 상태 계산 (calculateDeleteState 구현 필요) ---
    // 백스페이스와 유사하지만, 병합 대상이 lineIndex + 1이 됩니다.
    const { newState, newPos, deletedLineIndex, updatedLineIndex } =
        calculateDeleteState(currentState, lineIndex, offset, ranges);

    if (newState === currentState) return;

    // --- [Step 4] 저장 및 UI 동기화 ---
    state.save(activeKey, newState);
    
    const finalPos = normalizeCursorData({ ...newPos, containerId: activeKey }, activeKey);

    if (finalPos) {
        state.saveCursor(finalPos);

        // UI에서 라인 삭제 (다음 줄이 현재 줄로 합쳐질 때 다음 줄이 삭제됨)
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

        // 현재 라인 리렌더링
        if (updatedLineIndex !== null && newState[updatedLineIndex]) {
            ui.renderLine(updatedLineIndex, newState[updatedLineIndex], activeKey);
        }

        ui.ensureFirstLineP(activeKey);
        domSelection.restoreCursor(finalPos);
    }
}


/**
 * 붙여넣기 실행 핵심 프로세서
 */
export function executePaste(e, { state, ui, domSelection }) {
    e.preventDefault();
    const activeKey = domSelection.getActiveKey();
    if (!activeKey) return;

    // 1. 데이터 가져오기 및 컨버팅
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    let { mainLines, additionalState } = html 
        ? HtmlDeserializer.deserialize(html)
        : { 
            mainLines: text.split(/\r?\n/).map(t => EditorLineModel('left', [TextChunkModel('text', t)])),
            additionalState: {} 
          };

    // 2. 현재 상태와 커서 위치 파악
    const currentLines = [...state.get(activeKey)];
    const domRanges = domSelection.getDomSelection(activeKey);
    const { lineIndex, endIndex: offset } = domRanges[0];
    const targetLine = currentLines[lineIndex];

    // 3. 현재 라인을 커서 기준으로 분할
    const { left, right } = splitLineAtOffset(targetLine, offset);

    // 4. 새로운 라인들 병합 구성
    const newLines = [];
    
    if (mainLines.length === 1) {
        // 단일 라인 붙여넣기: [왼쪽] + [중간] + [오른쪽]을 한 줄로 합침
        const combined = [...left.chunks, ...mainLines[0].chunks, ...right.chunks];
        newLines.push(EditorLineModel(left.align, mergeChunks(combined)));
    } else {
        // 다중 라인 붙여넣기
        // 첫 줄: 기존 왼쪽 + 복사된 첫 줄
        newLines.push(EditorLineModel(left.align, mergeChunks([...left.chunks, ...mainLines[0].chunks])));
        
        // 중간 줄들: 그대로 추가
        if (mainLines.length > 2) {
            newLines.push(...mainLines.slice(1, -1));
        }
        
        // 마지막 줄: 복사된 마지막 줄 + 기존 오른쪽
        const lastPasted = mainLines[mainLines.length - 1];
        newLines.push(EditorLineModel(lastPasted.align, mergeChunks([...lastPasted.chunks, ...right.chunks])));
    }

    // 5. 최종 상태 조립
    const nextState = [
        ...currentLines.slice(0, lineIndex),
        ...newLines,
        ...currentLines.slice(lineIndex + 1)
    ];

    // 6. 데이터 저장
    state.save(activeKey, nextState);
    
    // 테이블 셀 등 추가 데이터 저장
    Object.entries(additionalState).forEach(([cellId, content]) => {
        state.save(cellId, content);
    });

    // 7. 렌더링
    ui.render(nextState, activeKey);
    
    // 💡 다음 스텝: 붙여넣기 후 커서를 마지막 위치로 이동시키는 로직 호출 가능
    // focusAtLastPasted(domSelection, lineIndex, newLines);
}
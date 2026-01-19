// /core/keyInput/processors/keyDeleteProcessors.js
import { getLineLengthFromState } from '../../../utils/editorStateUtils.js';
import { getRanges } from "../../../utils/rangeUtils.js";
import { chunkRegistry } from '../../chunk/chunkRegistry.js';
import { normalizeCursorData } from '../../../utils/cursorUtils.js';
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { cloneChunk, normalizeLineChunks, calculateDeleteSelectionState} from '../serivce/keyCommonService.js';

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
 * ⌦ Delete Key 상태 계산 통합 함수
 */
function calculateDeleteState(currentState, lineIndex, offset, ranges = []) {
    // 1. 선택 영역이 있는 경우 (Selection Delete) - Backspace와 동일한 로직 공유
    if (ranges?.length > 0 && (ranges.length > 1 || ranges[0].startIndex !== ranges[0].endIndex)) {
        return calculateDeleteSelectionState(currentState, ranges);
    }

    const nextState = [...currentState];
    const currentLine = currentState[lineIndex];
    
    // 현재 라인의 전체 길이 계산
    const currentLineLen = currentLine.chunks.reduce((acc, chunk) => 
        acc + chunkRegistry.get(chunk.type).getLength(chunk), 0);

    // 🚀 [Case 1] 커서가 줄의 맨 끝일 때: 아랫줄을 현재 줄로 병합
    if (offset === currentLineLen) {
        if (lineIndex < currentState.length - 1) {
            const nextLine = currentState[lineIndex + 1];
            
            // 현재 줄 청크 + 아랫줄 청크 병합
            const mergedChunks = [
                ...currentLine.chunks.map(cloneChunk),
                ...nextLine.chunks.map(cloneChunk)
            ];

            nextState[lineIndex] = EditorLineModel(
                currentLine.align,
                normalizeLineChunks(mergedChunks)
            );
            
            // 아랫줄 삭제
            nextState.splice(lineIndex + 1, 1);

            return {
                newState: nextState,
                newPos: {
                    lineIndex,
                    anchor: {
                        // 커서 위치는 유지 (현재 라인의 끝 지점)
                        chunkIndex: currentLine.chunks.length - 1,
                        type: currentLine.chunks[currentLine.chunks.length - 1].type,
                        offset: offset 
                    }
                },
                deletedLineIndex: lineIndex + 1,
                updatedLineIndex: lineIndex
            };
        } else {
            // 마지막 줄의 끝에서는 아무 동작 안 함
            return { newState: currentState, newPos: null };
        }
    }

    // 🚀 [Case 2] 현재 줄 내부에서 뒤의 글자 삭제
    const newChunks = [];
    let deleted = false;
    let acc = 0;
    let targetAnchor = null;

    // 삭제 대상 청크(targetIndex) 탐색 (Delete는 offset 지점의 글자를 삭제)
    let targetIndex = -1;
    let tempAcc = 0;
    for (let i = 0; i < currentLine.chunks.length; i++) {
        const chunk = currentLine.chunks[i];
        const len = chunkRegistry.get(chunk.type).getLength(chunk);
        // Delete는 커서가 청크의 시작점부터 끝 전까지 있을 때 해당 청크가 타겟 (Start <= offset < End)
        if (offset >= tempAcc && offset < tempAcc + len) {
            targetIndex = i;
            break;
        }
        tempAcc += len;
    }

    acc = 0;
    for (let i = 0; i < currentLine.chunks.length; i++) {
        const chunk = currentLine.chunks[i];
        const handler = chunkRegistry.get(chunk.type);
        const chunkLen = handler.getLength(chunk);
        const chunkStart = acc;

        if (i === targetIndex && !deleted) {
            if (handler.canSplit) {
                // [텍스트 삭제] - 현재 offset 위치의 글자 하나 제거
                const cut = offset - chunkStart;
                const newText = chunk.text.slice(0, cut) + chunk.text.slice(cut + 1);

                if (newText.length > 0) {
                    newChunks.push(handler.create(newText, chunk.style));
                    targetAnchor = { chunkIndex: i, type: 'text', offset: cut };
                } else {
                    // 청크가 비면 다음 청크나 현재 위치 유지
                    targetAnchor = { chunkIndex: i, type: 'text', offset: cut };
                }
            } else {
                // [Atomic(이미지/테이블) 삭제]
                console.log(`[Delete Key] Atomic ${chunk.type} 삭제`);
                targetAnchor = { chunkIndex: i, type: 'text', offset: offset };
                // push 하지 않음으로써 삭제
            }
            deleted = true;
        } else {
            newChunks.push(cloneChunk(chunk));
        }
        acc += chunkLen;
    }

    if (!deleted) return { newState: currentState, newPos: null };

    nextState[lineIndex] = EditorLineModel(currentLine.align, normalizeLineChunks(newChunks));

    return {
        newState: nextState,
        newPos: {
            lineIndex,
            anchor: targetAnchor || { chunkIndex: 0, type: 'text', offset: offset }
        },
        updatedLineIndex: lineIndex
    };
}
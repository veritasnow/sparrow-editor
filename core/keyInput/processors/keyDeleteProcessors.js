// /core/keyInput/processors/keyDeleteProcessors.js
import { getLineLengthFromState } from '../../../utils/editorStateUtils.js';
import { getRanges } from "../../../utils/rangeUtils.js";
import { chunkRegistry } from '../../chunk/chunkRegistry.js';
import { normalizeCursorData } from '../../../utils/cursorUtils.js';
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { calculateDeleteSelectionState } from '../service/keyCommonService.js';
import { cloneChunk, normalizeLineChunks } from '../../../utils/mergeUtils.js';

/**
 * ⌦ Delete 키 실행 메인 함수
 */
export function executeDelete(e, { state, ui, domSelection }) {
    const activeKey = domSelection.getActiveKey();
    if (!activeKey) return;

    const currentState = state.get(activeKey);
    const domRanges = domSelection.getDomSelection(activeKey);
    if (!domRanges || domRanges.length === 0) return;

    const firstDomRange = domRanges[0];
    const isSelection = domRanges.length > 1 || firstDomRange.startIndex !== firstDomRange.endIndex;

    // 1. [검증] 삭제 방지 가드 (마지막 라인 끝, 테이블 셀 경계 등)
    if (shouldPreventDeletion(activeKey, currentState, firstDomRange, isSelection, e)) return;

    // 2. [위치 파악] 삭제할 위치(lineIndex, offset) 도출
    const { lineIndex, offset, ranges } = resolveTargetPosition(currentState, domRanges, isSelection);

    // 3. [상태 계산] 비즈니스 로직 수행
    const result = calculateDeleteState(currentState, lineIndex, offset, ranges);
    if (result.newState === currentState) return;

    // 4. [UI 반영] 상태 저장 및 DOM 업데이트
    applyDeleteResult(activeKey, result, { state, ui, domSelection });
}

/**
 * [Step 1] 삭제 동작 차단 가드 로직
 */
function shouldPreventDeletion(activeKey, currentState, firstDomRange, isSelection, e) {
    if (isSelection) return false;

    const { lineIndex, startIndex: offset } = firstDomRange;
    const currentLine = currentState[lineIndex];
    const lineLen = getLineLengthFromState(currentLine);
    
    const activeContainer = document.getElementById(activeKey);
    const isCell = activeContainer?.tagName === 'TD' || activeContainer?.tagName === 'TH';
    const isLastPosition = lineIndex === currentState.length - 1 && offset === lineLen;

    // 마지막 라인 끝이거나 테이블 셀 마지막 칸에서 Delete 방지
    if (isLastPosition) {
        e.preventDefault();
        return true;
    }
    return false;
}

/**
 * [Step 2] 논리적 삭제 위치 도출
 */
function resolveTargetPosition(currentState, domRanges, isSelection) {
    if (isSelection) {
        const ranges = getRanges(currentState, domRanges);
        return {
            ranges,
            lineIndex: ranges[0].lineIndex,
            offset: ranges[0].startIndex
        };
    }

    const lineIndex = domRanges[0].lineIndex;
    const offset = domRanges[0].startIndex; // Delete는 시작 지점 기준
    const currentLine = currentState[lineIndex];
    const lineLen = getLineLengthFromState(currentLine);

    return { 
        lineIndex, 
        offset: Math.max(0, Math.min(offset, lineLen)), 
        ranges: [] 
    };
}

/**
 * [Step 3] 실제 데이터 상태(State) 계산
 */
function calculateDeleteState(currentState, lineIndex, offset, ranges = []) {
    // 1. 선택 영역 삭제 (Backspace와 로직 공유)
    if (ranges?.length > 0 && (ranges.length > 1 || ranges[0].startIndex !== ranges[0].endIndex)) {
        return calculateDeleteSelectionState(currentState, ranges);
    }

    const currentLine = currentState[lineIndex];
    const currentLineLen = getLineLengthFromState(currentLine);

    // 2. 줄 병합 (줄의 맨 끝에서 삭제 시 아랫줄을 끌어올림)
    if (offset === currentLineLen && lineIndex < currentState.length - 1) {
        return performNextLineMerge(currentState, lineIndex);
    }

    // 3. 현재 줄 내부 삭제
    return performInternalDelete(currentState, lineIndex, offset);
}

/**
 * 다음 줄을 현재 줄로 병합하는 처리
 */
function performNextLineMerge(currentState, lineIndex) {
    const nextState = [...currentState];
    const currentLine = nextState[lineIndex];
    const nextLine = nextState[lineIndex + 1];

    const mergedChunks = [
        ...currentLine.chunks.map(cloneChunk),
        ...nextLine.chunks.map(cloneChunk)
    ];

    nextState[lineIndex] = EditorLineModel(currentLine.align, normalizeLineChunks(mergedChunks));
    nextState.splice(lineIndex + 1, 1);

    return {
        newState: nextState,
        newPos: {
            lineIndex,
            anchor: {
                chunkIndex: Math.max(0, currentLine.chunks.length - 1),
                type: currentLine.chunks[currentLine.chunks.length - 1].type,
                offset: getLineLengthFromState(currentLine)
            }
        },
        deletedLineIndex: lineIndex + 1,
        updatedLineIndex: lineIndex
    };
}

/**
 * 줄 내부 청크 삭제 처리 (Delete: 현재 위치의 뒷 글자 삭제)
 */
function performInternalDelete(currentState, lineIndex, offset) {
    const currentLine = currentState[lineIndex];
    const { chunks } = currentLine;
    let targetIndex = -1;
    let acc = 0;

    // 타겟 청크 탐색 (offset 위치를 포함하는 청크)
    for (let i = 0; i < chunks.length; i++) {
        const len = chunkRegistry.get(chunks[i].type).getLength(chunks[i]);
        if (offset >= acc && offset < acc + len) {
            targetIndex = i;
            break;
        }
        acc += len;
    }

    if (targetIndex === -1) return { newState: currentState };

    const newChunks = [];
    let targetAnchor = null;
    let deleted = false;
    let currentAcc = 0;

    chunks.forEach((chunk, i) => {
        const handler = chunkRegistry.get(chunk.type);
        if (i === targetIndex && !deleted) {
            if (handler.canSplit) {
                const cut = offset - currentAcc;
                const newText = chunk.text.slice(0, cut) + chunk.text.slice(cut + 1);
                if (newText.length > 0) {
                    newChunks.push(handler.create(newText, chunk.style));
                }
                targetAnchor = { chunkIndex: i, type: 'text', offset: cut };
            } else {
                // Atomic 삭제 시 커서는 그 자리에 유지
                targetAnchor = { chunkIndex: i, type: 'text', offset: offset };
            }
            deleted = true;
        } else {
            newChunks.push(cloneChunk(chunk));
        }
        currentAcc += handler.getLength(chunk);
    });

    const nextState = [...currentState];
    nextState[lineIndex] = EditorLineModel(currentLine.align, normalizeLineChunks(newChunks));

    return {
        newState: nextState,
        newPos: { lineIndex, anchor: targetAnchor },
        updatedLineIndex: lineIndex
    };
}

/**
 * [Step 4] UI 및 에디터 상태 반영
 */
function applyDeleteResult(activeKey, result, { state, ui, domSelection }) {
    const { newState, newPos, deletedLineIndex, updatedLineIndex } = result;

    // 1. 상태 저장
    state.save(activeKey, newState);

    const container = document.getElementById(activeKey);
    let combinedTablePool = [];

    // 2. [중요] 삭제되거나 업데이트될 라인들에서 테이블 DOM 미리 확보
    // 특히 '줄 병합' 시, 삭제될 줄(deletedLineIndex)에 있던 테이블을 살려야 합니다.
    if (container) {
        const lineElements = Array.from(container.querySelectorAll(':scope > .text-block'));
        
        // 업데이트될 줄의 테이블 확보
        if (updatedLineIndex !== undefined && lineElements[updatedLineIndex]) {
            combinedTablePool.push(...lineElements[updatedLineIndex].querySelectorAll('.chunk-table'));
        }
        
        // 삭제될 줄의 테이블 확보 (병합되어 위로 올라올 테이블들)
        if (deletedLineIndex !== undefined && lineElements[deletedLineIndex]) {
            combinedTablePool.push(...lineElements[deletedLineIndex].querySelectorAll('.chunk-table'));
        }
    }

    const finalPos = normalizeCursorData({ ...newPos, containerId: activeKey }, activeKey);

    if (finalPos) {
        state.saveCursor(finalPos);

        // 3. DOM에서 줄 삭제
        if (deletedLineIndex !== null && deletedLineIndex !== undefined) {
            const startIdx = typeof deletedLineIndex === 'object' ? deletedLineIndex.start : deletedLineIndex;
            const count = typeof deletedLineIndex === 'object' ? (deletedLineIndex.count || 1) : 1;
            for (let i = 0; i < count; i++) {
                ui.removeLine(startIdx, activeKey);
            }
        }

        // 4. 업데이트된 줄 리렌더링 (확보된 combinedTablePool 주입)
        if (updatedLineIndex !== null && newState[updatedLineIndex]) {
            // 병합 후 남은 줄에 이전 줄 + 다음 줄의 모든 테이블을 재사용할 기회를 줍니다.
            ui.renderLine(updatedLineIndex, newState[updatedLineIndex], activeKey, combinedTablePool);
        }

        ui.ensureFirstLine(activeKey);
        domSelection.restoreCursor(finalPos);
    }
}
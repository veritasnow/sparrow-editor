// /core/keyInput/processors/keyBackspaceProcessors.js
import { getLineLengthFromState } from '../../../utils/editorStateUtils.js';
import { getRanges } from "../../../utils/rangeUtils.js";
import { chunkRegistry } from '../../chunk/chunkRegistry.js';
import { normalizeCursorData } from '../../../utils/cursorUtils.js';
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { calculateDeleteSelectionState } from '../service/keyCommonService.js'
import { cloneChunk, normalizeLineChunks } from '../../../utils/mergeUtils.js';

/**
 * ⌫ 백스페이스 키 실행 메인 함수
 */
export function executeBackspace(e, { stateAPI, uiAPI, selectionAPI }) {
    const activeKey = selectionAPI.getActiveKey();
    if (!activeKey) return;

    const currentState = stateAPI.get(activeKey);
    const domRanges = selectionAPI.getDomSelection(activeKey);
    if (!domRanges || domRanges.length === 0) return;

    const firstDomRange = domRanges[0];
    const isSelection = domRanges.length > 1 || firstDomRange.startIndex !== firstDomRange.endIndex;

    // 1. [검증] 삭제 방지 가드 (테이블 셀 보호 등)
    if (shouldPreventDeletion(activeKey, firstDomRange, isSelection, e)) return;

    // 2. [위치 파악] 삭제할 위치(lineIndex, offset) 및 선택영역 확보
    const { lineIndex, offset, ranges } = resolveTargetPosition(currentState, selectionAPI, domRanges, isSelection);

    // 3. [상태 계산] 비즈니스 로직 수행
    const result = calculateBackspaceState(currentState, lineIndex, offset, ranges);
    if (result.newState === currentState) return;

    // 4. [UI 반영] 상태 저장 및 DOM 업데이트
    applyBackspaceResult(activeKey, result, { stateAPI, uiAPI, selectionAPI });
}

/**
 * [Step 1] 특정 상황에서 삭제 동작을 막는 가드 로직
 */
function shouldPreventDeletion(activeKey, firstDomRange, isSelection, e) {
    if (isSelection) return false;

    const activeContainer = document.getElementById(activeKey);
    const isCell = activeContainer?.tagName === 'TD' || activeContainer?.tagName === 'TH';
    
    // 테이블 셀 내부의 맨 첫 칸(0행 0열)에서 밖으로 나가는 삭제 방지
    if (isCell && firstDomRange.lineIndex === 0 && firstDomRange.endIndex === 0) {
        e.preventDefault();
        return true;
    }
    return false;
}

/**
 * [Step 2] 입력된 Selection 정보를 바탕으로 논리적 삭제 위치를 도출
 */
function resolveTargetPosition(currentState, selectionAPI, domRanges, isSelection) {
    if (isSelection) {
        const ranges = getRanges(currentState, domRanges);
        return {
            ranges,
            lineIndex: ranges[0].lineIndex,
            offset: ranges[0].endIndex // Atomic 삭제 로직을 위해 endIndex 사용
        };
    }

    let lineIndex = domRanges[0].lineIndex;
    let offset = domRanges[0].endIndex;
    const currentLine = currentState[lineIndex];

    // 커서가 0인데 Atomic 청크 뒤에 있는 경우 offset 보정
    const context = selectionAPI.getSelectionContext();
    if (context?.dataIndex !== null && currentLine) {
        const targetChunk = currentLine.chunks[context.dataIndex];
        const handler = chunkRegistry.get(targetChunk?.type);
        if (handler && !handler.canSplit && offset === 0) {
            offset = 1; 
        }
    }

    const lineLen = getLineLengthFromState(currentLine);
    return { 
        lineIndex, 
        offset: Math.max(0, Math.min(offset, lineLen)), 
        ranges: [] 
    };
}

/**
 * [Step 3] 실제 데이터 상태(State)를 계산하는 핵심 로직
 */
function calculateBackspaceState(currentState, lineIndex, offset, ranges = []) {
    // 1. 선택 영역 삭제
    if (ranges?.length > 0 && (ranges.length > 1 || ranges[0].startIndex !== ranges[0].endIndex)) {
        return calculateDeleteSelectionState(currentState, ranges);
    }

    // 2. 줄 병합 (줄의 맨 앞에서 삭제 시)
    if (offset === 0 && lineIndex > 0) {
        return performLineMerge(currentState, lineIndex);
    }

    // 3. 현재 줄 내부 삭제
    return performInternalDelete(currentState, lineIndex, offset);
}

/**
 * 줄 병합 세부 처리
 */
function performLineMerge(currentState, lineIndex) {
    const nextState = [...currentState];
    const prevLine = nextState[lineIndex - 1];
    const currentLine = nextState[lineIndex];

    const lastChunkIdx = Math.max(0, prevLine.chunks.length - 1);
    const lastChunk = prevLine.chunks[lastChunkIdx];
    const lastChunkLen = chunkRegistry.get(lastChunk.type).getLength(lastChunk);

    const mergedChunks = [
        ...prevLine.chunks.map(cloneChunk), 
        ...currentLine.chunks.map(cloneChunk)
    ];

    nextState[lineIndex - 1] = EditorLineModel(prevLine.align, normalizeLineChunks(mergedChunks));
    nextState.splice(lineIndex, 1);

    return {
        newState: nextState,
        newPos: {
            lineIndex: lineIndex - 1,
            anchor: { chunkIndex: lastChunkIdx, type: lastChunk.type, offset: lastChunkLen }
        },
        deletedLineIndex: lineIndex,
        updatedLineIndex: lineIndex - 1
    };
}

/**
 * 줄 내부 청크 삭제 세부 처리 (Text/Atomic)
 */
function performInternalDelete(currentState, lineIndex, offset) {
    const currentLine = currentState[lineIndex];
    let targetIndex = -1;
    let acc = 0;

    // 타겟 청크 탐색
    for (let i = 0; i < currentLine.chunks.length; i++) {
        const len = chunkRegistry.get(currentLine.chunks[i].type).getLength(currentLine.chunks[i]);
        if (offset > acc && offset <= acc + len) {
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

    currentLine.chunks.forEach((chunk, i) => {
        const handler = chunkRegistry.get(chunk.type);
        if (i === targetIndex && !deleted) {
            if (handler.canSplit) {
                const cut = offset - currentAcc;
                const newText = chunk.text.slice(0, cut - 1) + chunk.text.slice(cut);
                if (newText.length > 0) {
                    newChunks.push(handler.create(newText, chunk.style));
                    targetAnchor = { chunkIndex: i, type: 'text', offset: cut - 1 };
                } else {
                    targetAnchor = getFallbackAnchor(currentLine.chunks, i);
                }
            } else {
                targetAnchor = getFallbackAnchor(currentLine.chunks, i);
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

function getFallbackAnchor(chunks, i) {
    const prevIdx = Math.max(0, i - 1);
    const prevChunk = chunks[prevIdx];
    return {
        chunkIndex: prevIdx,
        type: i > 0 ? prevChunk.type : 'text',
        offset: i > 0 ? chunkRegistry.get(prevChunk.type).getLength(prevChunk) : 0
    };
}

/**
 * [Step 4] UI 및 에디터 상태 반영 (최적화 버전)
 */
function applyBackspaceResult(activeKey, result, { stateAPI, uiAPI, selectionAPI }) {
    const { newState, newPos, deletedLineIndex, updatedLineIndex } = result;

    // 1. 상태 저장
    stateAPI.save(activeKey, newState);

    const container = document.getElementById(activeKey);
    if (!container) return;

    // 2. 🔥 [핵심 최적화] 삭제될 라인들에서 재사용할 테이블 Pool 미리 확보
    // 줄이 합쳐질 때 아래 줄에 있던 테이블 DOM을 추출하여 메모리에 잠시 보관합니다.
    let movingTablePool = [];
    
    if (deletedLineIndex !== null && deletedLineIndex !== undefined) {
        const startIdx = typeof deletedLineIndex === 'object' ? deletedLineIndex.start : deletedLineIndex;
        const count = typeof deletedLineIndex === 'object' ? (deletedLineIndex.count || 1) : 1;
        
        for (let i = 0; i < count; i++) {
            // querySelectorAll 대신 children index로 접근 (O(1))
            const lineEl = container.children[startIdx]; 
            if (lineEl) {
                // 삭제 전, 이 라인에 포함된 테이블 DOM들을 풀에 담음
                const tables = Array.from(lineEl.getElementsByClassName('chunk-table'));
                if (tables.length > 0) movingTablePool.push(...tables);
                
                // DOM에서 라인 삭제
                uiAPI.removeLine(startIdx, activeKey);
            }
        }
    }

    // 3. 🔥 [핵심 최적화] 업데이트된 라인에 테이블 풀 주입
    // 병합된 윗줄을 다시 그릴 때, 아까 확보한 movingTablePool을 전달합니다.
    if (updatedLineIndex !== null && newState[updatedLineIndex]) {
        // 만약 단순 텍스트 삭제(isSimpleTextUpdate) 플래그가 있다면 renderChunk를 쓰고, 
        // 줄 병합 등 구조 변경이 있다면 renderLine을 호출합니다.
        if (result.isSimpleTextUpdate && result.chunkIndex !== undefined) {
            uiAPI.renderChunk(updatedLineIndex, result.chunkIndex, newState[updatedLineIndex].chunks[result.chunkIndex], activeKey);
        } else {
            uiAPI.renderLine(updatedLineIndex, newState[updatedLineIndex], {
                key: activeKey,
                pool: movingTablePool
            });
        }
    }

    // 4. 공통 마무리 (비어있는 에디터 방지 및 커서 복구)
    uiAPI.ensureFirstLine(activeKey);
    
    const finalPos = normalizeCursorData({ ...newPos, containerId: activeKey }, activeKey);
    if (finalPos) {
        stateAPI.saveCursor(finalPos);
        selectionAPI.restoreCursor(finalPos);
    }

    // 5. 메모리 참조 해제 (GC 지원)
    movingTablePool.length = 0;
}
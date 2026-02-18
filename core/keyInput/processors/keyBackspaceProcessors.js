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

    // 리스트 삭제 특수 로직
    if (activeKey.startsWith('list-') && currentState.length === 1) {
        const container = document.getElementById(activeKey);
        if (container) {
            // 함수 호출 시 필요한 인자들을 정확히 전달
            const removed = removeList(e, { stateAPI, uiAPI, selectionAPI }, currentState, activeKey, container);
            if (removed) return; // 삭제 처리되었으면 종료
        }
    }


    const domRanges = selectionAPI.getDomSelection(activeKey);
    if (!domRanges || domRanges.length === 0) return;

    const firstDomRange = domRanges[0];
    const isSelection   = domRanges.length > 1 || firstDomRange.startIndex !== firstDomRange.endIndex;

    // 1. [검증] 삭제 방지 가드 (테이블 셀 보호 등)
    if (shouldPreventDeletion(activeKey, firstDomRange, isSelection, e)) return;

    // 2. [위치 파악] 삭제할 위치(lineIndex, offset) 및 선택영역 확보
    const { lineIndex, offset, ranges } = resolveTargetPosition(currentState, selectionAPI, domRanges, isSelection);

    // 3. [상태 계산] 비즈니스 로직 수행
    const result = calculateBackspaceState(currentState, lineIndex, offset, ranges, stateAPI);
    if (result.newState === currentState) return;



    // 4. [UI 반영] 상태 저장 및 DOM 업데이트

    if (result.isListLineMerge) {
        applyBackspaceLineResult(activeKey, result, { stateAPI, uiAPI, selectionAPI });
    } else {
        applyBackspaceResult(activeKey, result, { stateAPI, uiAPI, selectionAPI });
    }
}

/**
 * [Step 1] 특정 상황에서 삭제 동작을 막는 가드 로직
 */
function shouldPreventDeletion(activeKey, firstDomRange, isSelection, e) {
    if (isSelection) return false;

    const activeContainer = document.getElementById(activeKey);
    const isCell          = activeContainer?.tagName === 'TD' || activeContainer?.tagName === 'TH';
    
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
            offset   : ranges[0].endIndex // Atomic 삭제 로직을 위해 endIndex 사용
        };
    }

    let lineIndex = domRanges[0].lineIndex;
    let offset    = domRanges[0].endIndex;
    const currentLine = currentState[lineIndex];

    // 커서가 0인데 Atomic 청크 뒤에 있는 경우 offset 보정
    const context = selectionAPI.getSelectionContext();
    if (context.dataIndex !== null && currentLine) {
        const targetChunk = currentLine.chunks[context.dataIndex];
        const handler     = chunkRegistry.get(targetChunk.type);
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
function calculateBackspaceState(currentState, lineIndex, offset, ranges = [], stateAPI) {
    // 1. 선택 영역 삭제
    if (ranges.length > 0 && (ranges.length > 1 || ranges[0].startIndex !== ranges[0].endIndex)) {
        return calculateDeleteSelectionState(currentState, ranges);
    }

    // 2. 줄 병합 (줄의 맨 앞에서 삭제 시)
    if (offset === 0 && lineIndex > 0) {
        // 2-1. 전 라인이 리스트인 경우(전 라인이 root인지 검증하는 로직이 필요할 수도?)
        const prevLineType = currentState[lineIndex - 1].chunks[0].type;
        if(prevLineType === 'unorderedList') {
            const lineActiveKey = currentState[lineIndex - 1].chunks[0].id;
            const prevLineState = stateAPI.get(lineActiveKey);
            return performListLineMerge(currentState, lineIndex, prevLineState, lineActiveKey);
        }else {
            // 2-2. 그 외인 경우
            return performLineMerge(currentState, lineIndex);
        }

    }

    // 3. 현재 줄 내부 삭제
    return performInternalDelete(currentState, lineIndex, offset);
}

/**
 * 줄 병합 세부 처리
 */
function performLineMerge(currentState, lineIndex) {
    const nextState    = [...currentState];
    const prevLine     = nextState[lineIndex - 1];
    const currentLine  = nextState[lineIndex];
    
    const lastChunkIdx = Math.max(0, prevLine.chunks.length - 1);
    const lastChunk    = prevLine.chunks[lastChunkIdx];
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
        updatedLineIndex: lineIndex - 1,
        isListLineMerge : false        
    };
}

/**
 * 줄 내부 청크 삭제 세부 처리 (Text/Atomic)
 */
function performInternalDelete(currentState, lineIndex, offset) {
    const currentLine = currentState[lineIndex];
    let targetIndex   = -1;
    let acc           = 0;

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

    const newChunks  = [];
    let targetAnchor = null;
    let deleted      = false;
    let currentAcc   = 0;

    currentLine.chunks.forEach((chunk, i) => {
        const handler = chunkRegistry.get(chunk.type);
        if (i === targetIndex && !deleted) {
            if (handler.canSplit) {
                const cut     = offset - currentAcc;
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

    const nextState      = [...currentState];
    nextState[lineIndex] = EditorLineModel(currentLine.align, normalizeLineChunks(newChunks));

    return {
        newState: nextState,
        newPos  : { lineIndex, anchor: targetAnchor },
        updatedLineIndex: lineIndex,
        isListLineMerge : false
    };
}

function getFallbackAnchor(chunks, i) {
    const prevIdx   = Math.max(0, i - 1);
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

    let movingTablePool = [];
    
    // 2. [라인 삭제] 해당 인덱스의 줄(LI 또는 P)을 DOM에서 제거
    if (deletedLineIndex !== null && deletedLineIndex !== undefined) {
        const startIdx = typeof deletedLineIndex === 'object' ? deletedLineIndex.start : deletedLineIndex;
        const count    = typeof deletedLineIndex === 'object' ? (deletedLineIndex.count || 1) : 1;
        
        for (let i = 0; i < count; i++) {
            // ✅ 중요: container.children[startIdx]는 리스트일 땐 <li>, 일반일 땐 <p>를 가리킴
            const lineEl = container.children[startIdx]; 
            if (lineEl) {
                // 삭제 전 테이블 보관
                const tables = Array.from(lineEl.getElementsByClassName('chunk-table'));
                if (tables.length > 0) movingTablePool.push(...tables);
                
                // DOM에서 줄 삭제 (li든 p든 통째로 날림)
                uiAPI.removeLine(startIdx, activeKey);
            }
        }
    }

    // 3. [라인 업데이트] 업데이트된 데이터를 기반으로 다시 렌더링
    if (updatedLineIndex !== null && newState[updatedLineIndex]) {
        // 기존 엘리먼트 찾기
        const targetElement = container.children[updatedLineIndex];
        // ✅ 줄 병합 등 구조 변경 시: uiAPI.renderLine이 
        // activeKey가 리스트면 <li>를, 아니면 <p>를 생성하도록 설계되어 있어야 함
        uiAPI.renderLine(updatedLineIndex, newState[updatedLineIndex], {
            key          : activeKey,
            targetElement: targetElement, // 기존 줄이 있으면 교체, 없으면 삽입
            pool         : movingTablePool
        });
    }

    // 4. 공통 마무리
    uiAPI.ensureFirstLine(activeKey);
    
    const finalPos = normalizeCursorData({ ...newPos, containerId: activeKey }, activeKey);
    if (finalPos) {
        stateAPI.saveCursor(finalPos);
        selectionAPI.restoreCursor(finalPos);
    }

    movingTablePool.length = 0;
}








/**
 * 줄 병합 세부 처리
 */
function performListLineMerge(currentState, lineIndex, prevLineState, lineActiveKey) {
    const nextState     = [...currentState];
    const currentLine   = nextState[lineIndex];
    const nextLineState = [...prevLineState];

    const prevLine     = nextLineState[nextLineState.length - 1];
    const lastChunkIdx = Math.max(0, prevLine.chunks.length - 1);
    const lastChunk    = prevLine.chunks[lastChunkIdx];
    const lastChunkLen = chunkRegistry.get(lastChunk.type).getLength(lastChunk);

    const mergedChunks = [
        ...prevLine.chunks.map(cloneChunk), 
        ...currentLine.chunks.map(cloneChunk)
    ];

    nextLineState[nextLineState.length - 1] = EditorLineModel(prevLine.align, normalizeLineChunks(mergedChunks));
    nextState.splice(lineIndex, 1);

    return {
        newState     : nextState,
        nextLineState: nextLineState,
        lineActiveKey : lineActiveKey,
        newPos: {
            lineIndex: lineIndex - 1,
            anchor: { chunkIndex: lastChunkIdx, type: lastChunk.type, offset: lastChunkLen }
        },
        deletedLineIndex: lineIndex,
        updatedLineIndex: lineIndex - 1,
        isListLineMerge : true
    };
}






function removeList(e, { stateAPI, uiAPI, selectionAPI }, currentState, activeKey, container) {

    // 1. 기본 검사 (✅ 수정된 부분)
    const rawText = (currentState[0]?.chunks || [])
        .filter(chunk => chunk.type === 'text')
        .map(chunk => chunk.text || '')
        .join('');

    // zero-width 문자 제거
    const cleanedText = rawText.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
    const lineLen     = cleanedText.length;
    const isEmptyLine = lineLen === 0;

    if (!isEmptyLine) {
        return false; // 삭제 조건이 아니면 false 반환
    }

    // 2. 테이블 Pool 수거
    const movingTablePool = [];
    const tables = Array.from(container.getElementsByClassName('chunk-table'));
    if (tables.length > 0) {
        movingTablePool.push(...tables);
    }

    const lineIndexInParent = parseInt(container.getAttribute('data-line-index'));
    const parentKey         = selectionAPI.getMainKey();

    // 3. 데이터 처리
    stateAPI.deleteLine(lineIndexInParent, parentKey, { saveHistory: false });
    stateAPI.delete(activeKey, { saveHistory: true });

    // 4. DOM 처리
    uiAPI.removeLine(lineIndexInParent, parentKey);

    // 5. 리렌더링
    const mainEditor         = document.getElementById(parentKey);
    const updatedParentState = stateAPI.get(parentKey);

    if (mainEditor) {
        Array.from(mainEditor.children).forEach((child, idx) => {
            child.setAttribute('data-line-index', idx);
            if (idx === lineIndexInParent && updatedParentState[idx]) {
                uiAPI.renderLine(idx, updatedParentState[idx], {
                    key: parentKey,
                    targetElement: child,
                    pool: movingTablePool
                });
            }
        });
    }

    // 6. 커서 복구 위치 계산
    let targetPos;

    if (updatedParentState[lineIndexInParent]) {
        targetPos = { lineIndex: lineIndexInParent, offset: 0 };
    } else {
        const prevIdx     = Math.max(0, lineIndexInParent - 1);
        const prevLine    = updatedParentState[prevIdx];
        const prevRawText = (prevLine?.chunks || [])
            .filter(c => c.type === 'text')
            .map(c => c.text || '')
            .join('')
            .replace(/[\u200B\u200C\u200D\uFEFF]/g, '');

        targetPos = {
            lineIndex: prevIdx,
            offset: prevRawText.length
        };
    }

    // 7. 마무리
    uiAPI.ensureFirstLine(parentKey);
    const finalPos = normalizeCursorData(
        { ...targetPos, containerId: parentKey },
        parentKey
    );

    selectionAPI.refreshActiveKeys();
    if (finalPos) {
        stateAPI.saveCursor(finalPos);
        selectionAPI.restoreCursor(finalPos);
    }

    movingTablePool.length = 0;
    e.preventDefault();
    return true;
}


function applyBackspaceLineResult(activeKey, result, { stateAPI, uiAPI, selectionAPI }) {
    const { 
        newState,       // 메인 에디터의 새 상태 (라인이 하나 삭제된 상태)
        nextLineState,  // 리스트의 새 상태 (마지막 LI에 텍스트가 추가된 상태)
        newPos, 
        deletedLineIndex, 
        lineActiveKey   // 업데이트될 리스트의 ID (예: 'list-123')
    } = result;

    console.log("applyBackspaceLineResult - lineActiveKey:", lineActiveKey);
    console.log("applyBackspaceLineResult - newState:", newState);
    console.log("applyBackspaceLineResult - nextLineState:", nextLineState);


    // 1. [데이터 저장] 두 컨테이너의 상태를 각각 저장
    stateAPI.save(activeKey, newState);
    stateAPI.save(lineActiveKey, nextLineState);

    const mainContainer = document.getElementById(activeKey);
    const listContainer = document.getElementById(lineActiveKey);
    if (!mainContainer || !listContainer) return;

    let movingTablePool = [];

    // 2. [라인 삭제] 메인 에디터에서 리스트 뒤에 붙어버린 그 라인을 DOM에서 제거
    if (deletedLineIndex !== null) {
        const lineEl = mainContainer.children[deletedLineIndex];
        if (lineEl) {
            // 삭제 전 테이블 수거 (리스트 마지막 LI로 옮겨주기 위함)
            const tables = Array.from(lineEl.getElementsByClassName('chunk-table'));
            if (tables.length > 0) movingTablePool.push(...tables);
            
            uiAPI.removeLine(deletedLineIndex, activeKey);
        }
    }

    // 3. [리스트 렌더링] 데이터가 합쳐진 리스트의 마지막 LI를 다시 그림
    const lastLiIndex = nextLineState.length - 1;
    const targetLi = listContainer.children[lastLiIndex];
    
    uiAPI.renderLine(lastLiIndex, nextLineState[lastLiIndex], {
        key: lineActiveKey,
        targetElement: targetLi, // 기존 마지막 LI 교체
        pool: movingTablePool    // 수거한 테이블 주입
    });

    // 4. [메인 인덱스 동기화] 라인이 삭제되었으므로 뒤따르는 라인들의 data-index 갱신
    Array.from(mainContainer.children).forEach((child, idx) => {
        child.setAttribute('data-line-index', idx);
    });

    // 5. [커서 복구] 이제 커서는 메인이 아니라 '리스트 내부'로 들어가야 함
    // newPos에 containerId를 리스트 키로 명시해줘야 합니다.
    const finalPos = normalizeCursorData({ 
        ...newPos, 
        lineIndex: lastLiIndex, // 리스트의 마지막 줄
        containerId: lineActiveKey 
    }, lineActiveKey);

    if (finalPos) {
        stateAPI.saveCursor(finalPos);
        selectionAPI.refreshActiveKeys(); // 활성 키를 리스트로 전환
        selectionAPI.restoreCursor(finalPos);
    }

    movingTablePool.length = 0;
}
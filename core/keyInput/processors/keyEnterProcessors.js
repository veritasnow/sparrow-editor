// /core/keyInput/processors/keyEnterProcessors.js
import { cloneChunk, normalizeLineChunks } from '../../../utils/mergeUtils.js';
import { getLineLengthFromState } from '../../../utils/editorStateUtils.js';
import { isLineEmpty } from '../../../utils/emptyUtils.js';
import { normalizeCursorData } from '../../../utils/cursorUtils.js';
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { chunkRegistry } from '../../chunk/chunkRegistry.js';

/**
 * ⏎ 엔터 키 실행 메인 함수
 */
export function executeEnter({ stateAPI, uiAPI, selectionAPI }) {
    const activeKey = selectionAPI.getActiveKey();
    if (!activeKey) return;

    // 현재 커서가 있는 실제 컨테이너(에디터 혹은 TD) 정보를 가져옵니다.
    const selection   = selectionAPI.getSelectionContext();
    const containerId = selection.containerId || activeKey;
    
    // ✅ 리스트 내부 엔터인지 확인
    if (containerId.startsWith('list-')) {
        return executeListEnter({ stateAPI, uiAPI, selectionAPI, containerId, activeKey });
    }    

    // 해당 컨테이너의 상태와 선택 범위를 가져옵니다.
    const currentState = stateAPI.get(containerId);
    const domRanges    = selectionAPI.getDomSelection(containerId);

    if (!domRanges || domRanges.length === 0 || !currentState) return;

    // 1. [위치 파악]
    const { lineIndex, offset } = resolveEnterPosition(currentState, domRanges);

    // 2. [상태 계산]
    const result = calculateEnterState(currentState, lineIndex, offset, containerId);

    // 3. [UI 반영] 
    applyEnterResult(containerId, result, { stateAPI, uiAPI, selectionAPI });
}

/**
 * [Step 1] 엔터가 발생한 논리적 위치 계산
 */
function resolveEnterPosition(currentState, domRanges) {
    const { lineIndex, endIndex: domOffset } = domRanges[0];
    const lineState = currentState[lineIndex];
    const lineLen   = lineState ? getLineLengthFromState(lineState) : 0;
    
    return {
        lineIndex,
        offset: Math.max(0, Math.min(domOffset, lineLen))
    };
}

/**
 * [Step 2] 현재 라인을 분할하여 새로운 상태(State) 계산
 */
function calculateEnterState(currentState, lineIndex, offset, containerId) {
    const currentLine  = currentState[lineIndex];
    const beforeChunks = [];
    const afterChunks  = [];
    let acc = 0;

    currentLine.chunks.forEach(chunk => {
        const handler  = chunkRegistry.get(chunk.type);
        const chunkLen = handler ? handler.getLength(chunk) : (chunk.text?.length || 0);
        
        if (handler && !handler.canSplit) {
            if (acc + chunkLen <= offset) {
                beforeChunks.push(cloneChunk(chunk));
            } else {
                afterChunks.push(cloneChunk(chunk));
            }
        } else {
            const start = acc;
            const end   = acc + chunkLen;

            if (offset <= start) {
                afterChunks.push(cloneChunk(chunk));
            } else if (offset >= end) {
                beforeChunks.push(cloneChunk(chunk));
            } else {
                const cut = offset - start;
                const beforeText = chunk.text.slice(0, cut);
                const afterText  = chunk.text.slice(cut);
                
                if (beforeText) {
                    beforeChunks.push(handler ? handler.create(beforeText, chunk.style) : { type: 'text', text: beforeText, style: chunk.style });
                }
                if (afterText) {
                    afterChunks.push(handler ? handler.create(afterText, chunk.style) : { type: 'text', text: afterText, style: chunk.style });
                }
            }
        }
        acc += chunkLen;
    });

    const finalBeforeChunks = normalizeLineChunks(beforeChunks);
    const finalAfterChunks  = normalizeLineChunks(afterChunks);

    const nextState      = [...currentState];
    nextState[lineIndex] = EditorLineModel(currentLine.align, finalBeforeChunks);
    
    const newLineData    = EditorLineModel(currentLine.align, finalAfterChunks);
    nextState.splice(lineIndex + 1, 0, newLineData);

    const newPos = {
        containerId, // 커서가 돌아갈 컨테이너 명시
        lineIndex: lineIndex + 1,
        anchor: {
            chunkIndex: 0,
            type      : 'text',
            offset    : 0
        }
    };

    return { newState: nextState, newPos, newLineData, lineIndex };
}

/**
 * [Step 3] 상태 저장 및 UI 업데이트 반영
 */
function applyEnterResult(targetContainerId, result, { stateAPI, uiAPI, selectionAPI }) {
    const { newState, newPos, newLineData, lineIndex } = result;

    // 1. 상태 저장 (정확한 대상 컨테이너에 저장)
    stateAPI.save(targetContainerId, newState);

    const container = document.getElementById(targetContainerId);
    if (!container) return;

    // 2. 🔥 [중요] :scope를 사용하여 해당 컨테이너의 직계 자식 라인만 추출
    // 이를 통해 테이블 외부 엔터 시 내부 0번 라인이 잡히는 것을 방지합니다.
    const currentLineEl   = container.querySelector(`:scope > [data-line-index="${lineIndex}"]`);
    
    // 테이블 소실 방지를 위한 Pool 추출
    const movingTablePool = currentLineEl 
        ? Array.from(currentLineEl.getElementsByClassName('chunk-table')) 
        : [];

    try {
        // 3. UI 반영: 반드시 targetContainerId를 넘겨 부모-자식 관계 명시
        uiAPI.insertLine(lineIndex + 1, newLineData.align, targetContainerId, newLineData); 

        // 4. 기존 줄 업데이트
        uiAPI.renderLine(lineIndex, newState[lineIndex], { 
            key: targetContainerId 
        });

        // 5. 새 줄 업데이트 (추출한 테이블 주입)
        uiAPI.renderLine(lineIndex + 1, newState[lineIndex + 1], { 
            key: targetContainerId, 
            pool: movingTablePool 
        });
        
        // 6. 커서 복원 (가상 스크롤 및 DOM 안정화 대응)
        const finalPos = normalizeCursorData(newPos, targetContainerId);
        if (finalPos) {
            stateAPI.saveCursor(finalPos);
            // RAF를 사용하여 브라우저가 신규 <p> 태그의 인덱스를 완전히 인지한 후 커서 고정
            requestAnimationFrame(() => {
                selectionAPI.restoreCursor(finalPos);
            });
        }
    } catch (e) {
        console.error("Enter process failed - DOM mismatch:", e);
    }

    movingTablePool.length = 0;
}



/**
 * 리스트 전용 엔터 핸들러
 */
function executeListEnter({ stateAPI, uiAPI, selectionAPI, containerId }) {
    console.group("🚀 [List Enter Process]");

    const listState = stateAPI.get(containerId);
    const domRanges = selectionAPI.getDomSelection(containerId);

    if (!listState || !domRanges) {
        console.groupEnd();
        return;
    }

    const { lineIndex, offset } = resolveEnterPosition(listState, domRanges);

    // =========================
    // 1️⃣ 빈 줄 → 리스트 탈출
    // =========================
    if (isLineEmpty(listState[lineIndex])) {

        const parentId        = selectionAPI.findParentContainerId(containerId);
        const parentState     = [...stateAPI.get(parentId)];
        const listEl          = document.getElementById(containerId);
        const parentLineIndex = selectionAPI.getLineIndex(listEl);

        // 리스트 내부 상태 제거
        const updatedListState = [...listState];
        updatedListState.splice(lineIndex, 1);

        // 새 일반 라인 생성
        const newEmptyLine = EditorLineModel('left', [{
            type: 'text',
            text: '',
            style: { fontSize: '14px', fontFamily: 'Pretendard, sans-serif' }
        }]);

        // 상태 반영
        parentState.splice(parentLineIndex + 1, 0, newEmptyLine);

        stateAPI.save(parentId, parentState);
        uiAPI.renderLine(parentLineIndex, parentState[parentLineIndex], { key: parentId });        

        // 새 라인 삽입 및 렌더
        uiAPI.insertLine(parentLineIndex + 1, newEmptyLine.align, parentId, newEmptyLine);
        uiAPI.renderLine(parentLineIndex + 1, newEmptyLine, { key: parentId });

        // 커서 위치 계산
        const finalPos = {
            containerId: parentId,
            lineIndex: updatedListState.length === 0
                ? parentLineIndex
                : parentLineIndex + 1,
            anchor: { chunkIndex: 0, type: 'text', offset: 0 }
        };

        commitCursor(finalPos, stateAPI, selectionAPI);
    } else {
        // =========================
        // 2️⃣ 리스트 내부 분할
        // =========================
        const result = calculateEnterState(listState, lineIndex, offset, containerId);

        // 리스트 상태 저장
        stateAPI.save(containerId, result.newState);

        const mainKey   = selectionAPI.getMainKey();
        const mainState = [...stateAPI.get(mainKey)];

        const parentLineIndexInMain = mainState.findIndex(line =>
            line.chunks?.some(c => c.id === containerId)
        );

        if (parentLineIndexInMain !== -1) {
            const parentLine = mainState[parentLineIndexInMain];
            const listChunk  = parentLine.chunks.find(c => c.id === containerId);

            // 리스트 데이터 동기화
            listChunk.data = result.newState.map((line, idx) => ({
                index: idx,
                line: line
            }));

            stateAPI.save(mainKey, mainState);
            uiAPI.renderLine(parentLineIndexInMain, mainState[parentLineIndexInMain], { key: mainKey });

        }

        // 커서 복원 (공통 처리)
        const finalPos = normalizeCursorData(result.newPos, containerId);
        commitCursor(finalPos, stateAPI, selectionAPI);
    }
}

// 공통 커서 처리 헬퍼
function commitCursor(finalPos, stateAPI, selectionAPI) {
    if (!finalPos) return;
    stateAPI.saveCursor(finalPos);
    requestAnimationFrame(() => {
        selectionAPI.restoreCursor(finalPos);
        console.groupEnd();
    });
}






/*
function executeListEnter({ stateAPI, uiAPI, selectionAPI, containerId }) {
    console.group("🚀 [List Enter Process]");

    // 1. 리스트 내부 상태 가져오기
    const listState = stateAPI.get(containerId);
    const domRanges = selectionAPI.getDomSelection(containerId);

    if (!listState || !domRanges) {
        console.groupEnd();
        return;
    }

    const { lineIndex, offset } = resolveEnterPosition(listState, domRanges);
    if(isLineEmpty(listState[lineIndex])) {
        const parentId        = selectionAPI.findParentContainerId(containerId);
        const parentState     = [...stateAPI.get(parentId)];
        const listEl          = document.getElementById(containerId);
        const parentLineIndex = selectionAPI.getLineIndex(listEl);

        // 1. 리스트 내부 상태에서 현재 빈 줄 제거 (진짜 탈출)
        const updatedListState = [...listState];
        updatedListState.splice(lineIndex, 1);

        // 2. 새 일반 라인 모델 생성
        const newEmptyLine = EditorLineModel('left', [{ 
            type: 'text', 
            text: '', 
            style: { fontSize: '14px', fontFamily: 'Pretendard, sans-serif' } 
        }]);

        // 상태 업데이트
        parentState.splice(parentLineIndex + 1, 0, newEmptyLine); // 삽입!
        stateAPI.save(parentId, parentState);

        // --- UI 반영 순서 ---
        // 1. 리스트 줄 업데이트 (li가 하나 줄어든 상태로 다시 그림)
        uiAPI.renderLine(parentLineIndex, parentState[parentLineIndex], { key: parentId });

        // 2. 새 일반 라인 삽입 (기존 로직과 동일)
        uiAPI.insertLine(parentLineIndex + 1, newEmptyLine.align, parentId, newEmptyLine);

        // 3. 새 줄 렌더링 (필요시)
        uiAPI.renderLine(parentLineIndex + 1, newEmptyLine, { key: parentId });

        // 5. 커서 이동
        const finalPos = {
            containerId: parentId,
            lineIndex: updatedListState.length === 0 ? parentLineIndex : parentLineIndex + 1,
            anchor: { chunkIndex: 0, type: 'text', offset: 0 }
        };
        
        stateAPI.saveCursor(finalPos);
        requestAnimationFrame(() => {
            selectionAPI.restoreCursor(finalPos);
        });
    } else {
        // 2. 리스트 내부 행 분할 (중요: 여기서 이미 newState는 [Line0, Line1] 처럼 늘어남)
        const result = calculateEnterState(listState, lineIndex, offset, containerId);

        // 3. 리스트 상태 저장
        stateAPI.save(containerId, result.newState); 

        // 4. UI 렌더링
        // 리스트는 내부 구조(LI 개수)가 변한 것이므로, 
        // 리스트를 포함하고 있는 "진짜 부모(메인 에디터)"의 해당 라인을 다시 그려야 합니다.
        // 하지만, 만약 리스트 내부 UI만 갱신하고 싶다면 리스트 렌더러를 직접 호출해야 합니다.
        
        const mainKey   = selectionAPI.getMainKey();
        const mainState = stateAPI.get(mainKey);
        
        // 메인 에디터에서 이 리스트를 들고 있는 '부모 라인'을 찾습니다.
        const parentLineIndexInMain = mainState.findIndex(line => 
            line.chunks?.some(c => c.id === containerId)
        );

        if (parentLineIndexInMain !== -1) {
            // 부모 청크의 데이터 구조 업데이트 (아이템 개수 동기화)
            const listChunk = mainState[parentLineIndexInMain].chunks.find(c => c.id === containerId);
            
            // 💡 리스트 아이템(LI)의 개수를 상태와 맞춰줍니다.
            listChunk.data = result.newState.map((line, idx) => ({
                index: idx,
                line: line
            }));

            stateAPI.save(mainKey, mainState);

            // 렌더링 실행
            uiAPI.renderLine(parentLineIndexInMain, mainState[parentLineIndexInMain], {
                key: mainKey
            });
        }

        // 5. 커서 복원 (containerId는 그대로 list-xxx 사용)
        const finalPos = normalizeCursorData(result.newPos, containerId);
        if (finalPos) {
            stateAPI.saveCursor(finalPos);
            requestAnimationFrame(() => {
                selectionAPI.restoreCursor(finalPos);
                console.groupEnd();
            });
        }

    }
}
*/
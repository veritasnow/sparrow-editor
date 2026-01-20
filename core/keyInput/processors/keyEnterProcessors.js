// /core/keyInput/processors/keyEnterProcessors.js
import { cloneChunk, normalizeLineChunks } from '../../../utils/mergeUtils.js';
import { getLineLengthFromState } from '../../../utils/editorStateUtils.js';
import { normalizeCursorData } from '../../../utils/cursorUtils.js';
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { chunkRegistry } from '../../chunk/chunkRegistry.js';

/**
 * ⏎ 엔터 키 실행 메인 함수
 */
export function executeEnter({ state, ui, domSelection }) {
    const activeKey = domSelection.getActiveKey();
    if (!activeKey) return;

    const currentState = state.get(activeKey);
    const domRanges = domSelection.getDomSelection(activeKey);
    if (!domRanges || domRanges.length === 0) return;

    // 1. [위치 파악] 현재 라인과 오프셋 정보 확보
    const { lineIndex, offset } = resolveEnterPosition(currentState, domRanges);

    // 2. [상태 계산] 라인 분할 및 새 상태 생성
    const result = calculateEnterState(currentState, lineIndex, offset);

    // 3. [UI 반영] 상태 저장 및 화면 갱신
    applyEnterResult(activeKey, result, { state, ui, domSelection });
}

/**
 * [Step 1] 엔터가 발생한 논리적 위치 계산
 */
function resolveEnterPosition(currentState, domRanges) {
    const { lineIndex, endIndex: domOffset } = domRanges[0];
    const lineState = currentState[lineIndex];
    const lineLen = lineState ? getLineLengthFromState(lineState) : 0;
    
    return {
        lineIndex,
        offset: Math.max(0, Math.min(domOffset, lineLen))
    };
}

/**
 * [Step 2] 현재 라인을 분할하여 새로운 상태(State) 계산
 */
function calculateEnterState(currentState, lineIndex, offset) {
    const currentLine = currentState[lineIndex];
    const beforeChunks = [];
    const afterChunks = [];
    let acc = 0;

    // 1. 청크 순회하며 분할 지점 계산
    currentLine.chunks.forEach(chunk => {
        const handler = chunkRegistry.get(chunk.type);
        const chunkLen = handler ? handler.getLength(chunk) : (chunk.text?.length || 0);
        
        if (handler && !handler.canSplit) {
            // 분할 불가능한 노드 (Atomic: Image, Video, Table 등)
            if (acc + chunkLen <= offset) {
                beforeChunks.push(cloneChunk(chunk));
            } else {
                afterChunks.push(cloneChunk(chunk));
            }
        } else {
            // 분할 가능한 노드 (Text 등)
            const start = acc;
            const end = acc + chunkLen;

            if (offset <= start) {
                afterChunks.push(cloneChunk(chunk));
            } else if (offset >= end) {
                beforeChunks.push(cloneChunk(chunk));
            } else {
                const cut = offset - start;
                const beforeText = chunk.text.slice(0, cut);
                const afterText = chunk.text.slice(cut);
                
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

    // 2. 데이터 정규화 (빈 줄 처리 및 연속 텍스트 병합)
    const finalBeforeChunks = normalizeLineChunks(beforeChunks);
    const finalAfterChunks = normalizeLineChunks(afterChunks);

    // 3. 상태 배열 업데이트
    const nextState = [...currentState];
    // 현재 줄은 앞부분(before)만 남김
    nextState[lineIndex] = EditorLineModel(currentLine.align, finalBeforeChunks);
    
    // 새 줄 데이터 생성 및 삽입
    const newLineData = EditorLineModel(currentLine.align, finalAfterChunks);
    nextState.splice(lineIndex + 1, 0, newLineData);

    // 4. 🔥 [핵심 수정] 커서 위치 계산
    // 다음 줄의 첫 번째 청크가 테이블이더라도, 커서의 논리적 위치는 
    // "새로운 라인의 시작점"이므로 기본 타입을 'text'로 잡습니다.
    // 이렇게 하면 restoreCursor가 테이블 내부 detail을 찾지 않고 테이블 '앞'에 커서를 둡니다.
    const newPos = {
        lineIndex: lineIndex + 1,
        anchor: {
            chunkIndex: 0,
            type: 'text', // 'table'로 유추하지 않고 기본 텍스트 위치로 설정
            offset: 0
        }
    };

    return { newState: nextState, newPos, newLineData, lineIndex };
}


/**
 * [Step 3] 상태 저장 및 UI 업데이트 반영
 */
// keyEnterProcessors.js

function applyEnterResult(activeKey, result, { state, ui, domSelection }) {
    const { newState, newPos, newLineData, lineIndex } = result;

    // 1. 상태 저장
    state.save(activeKey, newState);

    // 2. [매우 중요] 현재 DOM(분할 전)에서 테이블들을 미리 꺼내둡니다.
    // 이 테이블들은 잠시 후 newLineData(lineIndex + 1)를 그릴 때 재사용됩니다.
    const container = document.getElementById(activeKey);
    const currentLineEl = container?.querySelectorAll(':scope > .text-block')[lineIndex];
    
    // 현재 라인에 있던 테이블 DOM들을 미리 배열에 담아둡니다.
    const movingTablePool = currentLineEl 
        ? Array.from(currentLineEl.querySelectorAll('.chunk-table')) 
        : [];

    // 3. UI 반영: 줄 삽입 (이 순간 lineIndex + 1 자리에 빈 div가 생기고 기존 줄들은 뒤로 밀림)
    ui.insertLine(lineIndex + 1, newLineData.align, activeKey); 

    // 4. 기존 줄(lineIndex) 업데이트 
    // (이제 분할되어 남은 데이터만 그려짐. tablePool은 null이므로 함수가 알아서 추출)
    ui.renderLine(lineIndex, newState[lineIndex], activeKey);

    // 5. 새 줄(lineIndex + 1) 업데이트
    // 💡 여기서 아까 추출한 movingTablePool을 직접 주입합니다!
    ui.renderLine(lineIndex + 1, newState[lineIndex + 1], activeKey, movingTablePool);
    
    // 6. 커서 복원
    const finalPos = normalizeCursorData({ ...newPos, containerId: activeKey }, activeKey);
    if (finalPos) {
        state.saveCursor(finalPos);
        domSelection.restoreCursor(finalPos);
    }
}








/*
function calculateEnterState(currentState, lineIndex, offset) {
    const currentLine = currentState[lineIndex];
    const beforeChunks = [];
    const afterChunks = [];
    let acc = 0;

    // 청크 순회하며 분할 지점 계산
    currentLine.chunks.forEach(chunk => {
        const handler = chunkRegistry.get(chunk.type);
        const chunkLen = handler ? handler.getLength(chunk) : (chunk.text?.length || 0);
        
        if (handler && !handler.canSplit) {
            // 분할 불가능한 노드 (Atomic)
            if (acc + chunkLen <= offset) {
                beforeChunks.push(cloneChunk(chunk));
            } else {
                afterChunks.push(cloneChunk(chunk));
            }
        } else {
            // 분할 가능한 노드 (Text 등)
            const start = acc;
            const end = acc + chunkLen;

            if (offset <= start) {
                afterChunks.push(cloneChunk(chunk));
            } else if (offset >= end) {
                beforeChunks.push(cloneChunk(chunk));
            } else {
                const cut = offset - start;
                const beforeText = chunk.text.slice(0, cut);
                const afterText = chunk.text.slice(cut);
                
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
    const finalAfterChunks = normalizeLineChunks(afterChunks);

    const nextState = [...currentState];
    nextState[lineIndex] = EditorLineModel(currentLine.align, finalBeforeChunks);
    
    const newLineData = EditorLineModel(currentLine.align, finalAfterChunks);
    nextState.splice(lineIndex + 1, 0, newLineData);

    // 커서 위치 계산 (Type Fallback 적용)
    const firstChunkOfNextLine = finalAfterChunks[0];
    const inferredType = firstChunkOfNextLine?.type || 'text';

    const newPos = {
        lineIndex: lineIndex + 1,
        anchor: {
            chunkIndex: 0,
            type: inferredType,
            offset: 0,
            ...(inferredType === 'table' && { 
                detail: { rowIndex: 0, colIndex: 0, offset: 0 } 
            })
        }
    };

    return { newState: nextState, newPos, newLineData, lineIndex };
}
*/
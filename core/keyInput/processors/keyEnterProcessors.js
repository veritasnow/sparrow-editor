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

    // 현재 커서가 있는 실제 컨테이너(에디터 혹은 TD) 정보를 가져옵니다.
    const selection   = domSelection.getSelectionContext();
    const containerId = selection?.containerId || activeKey;

    // 해당 컨테이너의 상태와 선택 범위를 가져옵니다.
    const currentState = state.get(containerId);
    const domRanges    = domSelection.getDomSelection(containerId);
    
    if (!domRanges || domRanges.length === 0 || !currentState) return;

    // 1. [위치 파악]
    const { lineIndex, offset } = resolveEnterPosition(currentState, domRanges);

    // 2. [상태 계산]
    const result = calculateEnterState(currentState, lineIndex, offset, containerId);

    // 3. [UI 반영] 
    applyEnterResult(containerId, result, { state, ui, domSelection });
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
function calculateEnterState(currentState, lineIndex, offset, containerId) {
    const currentLine = currentState[lineIndex];
    const beforeChunks = [];
    const afterChunks = [];
    let acc = 0;

    currentLine.chunks.forEach(chunk => {
        const handler = chunkRegistry.get(chunk.type);
        const chunkLen = handler ? handler.getLength(chunk) : (chunk.text?.length || 0);
        
        if (handler && !handler.canSplit) {
            if (acc + chunkLen <= offset) {
                beforeChunks.push(cloneChunk(chunk));
            } else {
                afterChunks.push(cloneChunk(chunk));
            }
        } else {
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

    const newPos = {
        containerId, // 커서가 돌아갈 컨테이너 명시
        lineIndex: lineIndex + 1,
        anchor: {
            chunkIndex: 0,
            type: 'text',
            offset: 0
        }
    };

    return { newState: nextState, newPos, newLineData, lineIndex };
}

/**
 * [Step 3] 상태 저장 및 UI 업데이트 반영
 */
function applyEnterResult(targetContainerId, result, { state, ui, domSelection }) {
    const { newState, newPos, newLineData, lineIndex } = result;

    // 1. 상태 저장 (정확한 대상 컨테이너에 저장)
    state.save(targetContainerId, newState);

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
        ui.insertLine(lineIndex + 1, newLineData.align, targetContainerId, newLineData); 

        // 4. 기존 줄 업데이트
        ui.renderLine(lineIndex, newState[lineIndex], targetContainerId);

        // 5. 새 줄 업데이트 (추출한 테이블 주입)
        ui.renderLine(lineIndex + 1, newState[lineIndex + 1], targetContainerId, movingTablePool);
        
        // 6. 커서 복원 (가상 스크롤 및 DOM 안정화 대응)
        const finalPos = normalizeCursorData(newPos, targetContainerId);
        console.log("finalPos : ", finalPos);
        if (finalPos) {
            state.saveCursor(finalPos);
            // RAF를 사용하여 브라우저가 신규 <p> 태그의 인덱스를 완전히 인지한 후 커서 고정
            requestAnimationFrame(() => {
                domSelection.restoreCursor(finalPos);
            });
        }
    } catch (e) {
        console.error("Enter process failed - DOM mismatch:", e);
    }

    movingTablePool.length = 0;
}
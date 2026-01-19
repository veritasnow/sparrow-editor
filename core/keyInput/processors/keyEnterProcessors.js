// /core/keyInput/processors/keyEnterProcessors.js
import { cloneChunk, normalizeLineChunks} from '../serivce/keyCommonService.js';
import { getLineLengthFromState } from '../../../utils/editorStateUtils.js';
import { normalizeCursorData } from '../../../utils/cursorUtils.js';
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { chunkRegistry } from '../../chunk/chunkRegistry.js'; // 레지스트리 도입


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

// ⏎ Enter Key
/**
 * 엔터 키 입력 시 현재 라인을 분할하고 새로운 상태를 계산
 * @param {Array} currentState - 전체 에디터 모델 (JSON)
 * @param {number} lineIndex - 엔터가 발생한 라인 인덱스
 * @param {number} offset - 현재 라인 내에서의 절대 오프셋 (텍스트 길이 + Atomic(1))
 */
function calculateEnterState(currentState, lineIndex, offset) {
    const currentLine = currentState[lineIndex];
    const beforeChunks = [];
    const afterChunks = [];
    let acc = 0;

    // 1. 현재 라인의 청크들을 순회하며 분할 지점 계산
    currentLine.chunks.forEach(chunk => {
        const handler = chunkRegistry.get(chunk.type);
        const chunkLen = handler ? handler.getLength(chunk) : (chunk.text?.length || 0);
        
        // 분할 불가능한 노드 (Video, Image, Table 등)
        if (handler && !handler.canSplit) {
            if (acc + chunkLen <= offset) {
                beforeChunks.push(cloneChunk(chunk));
            } else {
                afterChunks.push(cloneChunk(chunk));
            }
        } 
        // 분할 가능한 노드 (Text 등)
        else {
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
                
                // 텍스트가 있을 때만 생성 (handler가 없을 경우를 대비한 텍스트 기본 생성 로직)
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

    // 2. 정규화: 빈 배열일 경우 { type: 'text', text: '' } 등이 포함되도록 보정
    const finalBeforeChunks = normalizeLineChunks(beforeChunks);
    const finalAfterChunks = normalizeLineChunks(afterChunks);

    // 3. 상태 업데이트 (불변성 유지)
    const nextState = [...currentState];
    nextState[lineIndex] = EditorLineModel(currentLine.align, finalBeforeChunks);
    
    const newLineData = EditorLineModel(currentLine.align, finalAfterChunks);
    nextState.splice(lineIndex + 1, 0, newLineData);

    // ✨ 4. 커서 위치 계산 (Type Fallback 적용)
    // 다음 줄의 첫 번째 청크 정보를 가져옴
    const firstChunkOfNextLine = finalAfterChunks[0];
    
    // 타입이 없거나 청크 자체가 비정상적일 경우 'text'를 기본값으로 사용
    const inferredType = firstChunkOfNextLine?.type || 'text';

    const newPos = {
        lineIndex: lineIndex + 1,
        anchor: {
            chunkIndex: 0,
            type: inferredType,
            offset: 0, // 개행 직후이므로 항상 0
            // 타입이 테이블일 경우에만 상세 좌표(detail)를 추가
            ...(inferredType === 'table' && { 
                detail: { rowIndex: 0, colIndex: 0, offset: 0 } 
            })
        }
    };

    return { 
        newState: nextState, 
        newPos, 
        newLineData 
    };
}
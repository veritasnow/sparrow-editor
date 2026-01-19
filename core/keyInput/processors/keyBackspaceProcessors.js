// /core/keyInput/processors/keyBackspaceProcessors.js
import { getLineLengthFromState } from '../../../utils/editorStateUtils.js';
import { getRanges } from "../../../utils/rangeUtils.js";
import { chunkRegistry } from '../../chunk/chunkRegistry.js';
import { normalizeCursorData } from '../../../utils/cursorUtils.js';
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { calculateDeleteSelectionState} from '../service/keyCommonService.js'
import { cloneChunk, normalizeLineChunks } from '../../../utils/mergeUtils.js';


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
 * ⌫ Backspace Key 상태 계산 통합 함수
 */
function calculateBackspaceState(currentState, lineIndex, offset, ranges = []) {
    // 1. 선택 영역 삭제 (기존 유지)
    if (ranges?.length > 0 && (ranges.length > 1 || ranges[0].startIndex !== ranges[0].endIndex)) {
        return calculateDeleteSelectionState(currentState, ranges);
    }

    const nextState = [...currentState];
    const currentLine = currentState[lineIndex];

    // 🚀 [해결 1] 줄 병합 로직 (offset이 0일 때)
    // 이 부분이 정상적으로 살아있어야 윗줄 맨 뒤로 커서가 올라갑니다.
    if (offset === 0 && lineIndex > 0) {
        const prevLine = nextState[lineIndex - 1];
        const lastChunkIdx = Math.max(0, prevLine.chunks.length - 1);
        const lastChunk = prevLine.chunks[lastChunkIdx];
        const handler = chunkRegistry.get(lastChunk.type);
        const lastChunkLen = handler ? handler.getLength(lastChunk) : 0;

        const mergedChunks = [
            ...prevLine.chunks.map(cloneChunk), 
            ...currentLine.chunks.map(cloneChunk)
        ];

        nextState[lineIndex - 1] = EditorLineModel(
            prevLine.align, 
            normalizeLineChunks(mergedChunks)
        );
        nextState.splice(lineIndex, 1);

        return {
            newState: nextState,
            newPos: {
                lineIndex: lineIndex - 1,
                anchor: { 
                    chunkIndex: lastChunkIdx, 
                    type: lastChunk.type, 
                    offset: lastChunkLen 
                }
            },
            deletedLineIndex: lineIndex,
            updatedLineIndex: lineIndex - 1
        };
    }

    // 2. 현재 줄 내부 삭제 로직 시작
    const newChunks = [];
    let deleted = false;
    let acc = 0;
    let targetAnchor = null;

    // 🚀 [해결 2] 삭제 대상 청크(targetIndex) 정밀 탐색
    let targetIndex = -1;
    let tempAcc = 0;
    for (let i = 0; i < currentLine.chunks.length; i++) {
        const chunk = currentLine.chunks[i];
        const len = chunkRegistry.get(chunk.type).getLength(chunk);
        // 커서가 청크 범위 내에 있을 때 (Start < offset <= End)
        if (offset > tempAcc && offset <= tempAcc + len) {
            targetIndex = i;
            break;
        }
        tempAcc += len;
    }

    // 3. 청크 재구성 루프
    acc = 0;
    for (let i = 0; i < currentLine.chunks.length; i++) {
        const chunk = currentLine.chunks[i];
        const handler = chunkRegistry.get(chunk.type);
        const chunkLen = handler.getLength(chunk);
        const chunkStart = acc;

        // 타겟 청크를 만났고 아직 삭제를 수행하지 않은 경우
        if (i === targetIndex && !deleted) {
            if (handler.canSplit) { 
                // [텍스트 삭제]
                const cut = offset - chunkStart;
                const newText = chunk.text.slice(0, cut - 1) + chunk.text.slice(cut);
                
                if (newText.length > 0) {
                    newChunks.push(handler.create(newText, chunk.style));
                    targetAnchor = { chunkIndex: i, type: 'text', offset: cut - 1 };
                } else {
                    // 텍스트 청크가 비면 삭제, 커서는 이전 청크의 끝으로
                    targetAnchor = { 
                        chunkIndex: Math.max(0, i - 1), 
                        type: i > 0 ? currentLine.chunks[i-1].type : 'text', 
                        offset: i > 0 ? chunkRegistry.get(currentLine.chunks[i-1].type).getLength(currentLine.chunks[i-1]) : 0 
                    };
                }
            } else {
                // [Atomic(이미지/테이블) 삭제]
                console.log(`[Atomic Delete] ${chunk.type} 삭제`);
                targetAnchor = {
                    chunkIndex: Math.max(0, i - 1),
                    type: i > 0 ? currentLine.chunks[i-1].type : 'text',
                    offset: i > 0 ? chunkRegistry.get(currentLine.chunks[i-1].type).getLength(currentLine.chunks[i-1]) : 0
                };
                // push 하지 않음으로써 삭제
            }
            deleted = true;
        } else {
            // 삭제 대상이 아닌 청크는 그대로 복사
            newChunks.push(cloneChunk(chunk));
        }
        acc += chunkLen;
    }

    // 만약 삭제된 것이 없다면 (예: 줄의 맨 앞인데 위에서 병합 처리가 안 된 특수 상황 등)
    if (!deleted) return { newState: currentState, newPos: null };

    // 결과 반영
    nextState[lineIndex] = EditorLineModel(currentLine.align, normalizeLineChunks(newChunks));
    
    return {
        newState: nextState,
        newPos: {
            lineIndex,
            anchor: targetAnchor || { chunkIndex: 0, type: 'text', offset: Math.max(0, offset - 1) }
        },
        updatedLineIndex: lineIndex
    };
}
// utils/keyStateUtil.js
import { EditorLineModel } from '../model/editorLineModel.js';
import { mergeChunks, splitChunkByOffset } from '../utils/mergeUtils.js';
import { chunkRegistry } from '../core/chunk/chunkRegistry.js'; // 레지스트리 도입

// -----------------------------------------------------------------
// 🚀 공통 로직: Registry를 이용해 추상화된 복제
// -----------------------------------------------------------------
export function cloneChunk(chunk) {
    // Registry의 각 핸들러가 가진 clone 기능을 사용합니다.
    return chunkRegistry.get(chunk.type).clone(chunk);
}

// -----------------------------------------------------------------
// 🚀 공통 로직: 정규화
// -----------------------------------------------------------------
function normalizeLineChunks(chunks) {
    // 1. 길이가 0인 텍스트 청크를 필터링 (단, 전체가 비었을 때는 제외)
    let filtered = chunks.filter(chunk => {
        if (chunk.type === 'text' && chunk.text === "") return false;
        return true;
    });

    // 2. 만약 모든 청크가 지워졌다면(완전 빈 줄), 기본 빈 청크 하나 생성
    if (filtered.length === 0) {
        return [chunkRegistry.get('text').create("", { fontSize: "14px" })];
    }

    // 3. 연속된 텍스트 청크 병합
    return mergeChunks(filtered.map(cloneChunk));
}

/**
 * 선택 영역(Range) 삭제 상태 계산
 */
function calculateDeleteSelectionState(editorState, ranges) {
    const startRange = ranges[0];
    const endRange = ranges[ranges.length - 1];

    const { lineIndex: startLineIdx, startIndex: startOffset } = startRange;
    const { lineIndex: endLineIdx, endIndex: endOffset } = endRange;

    const newState = [...editorState];
    const startLine = editorState[startLineIdx];
    const endLine = editorState[endLineIdx];

    let beforeChunks = [];
    let afterChunks = [];

    // 시작 라인의 앞부분 수집
    let acc = 0;
    startLine.chunks.forEach(chunk => {
        const handler = chunkRegistry.get(chunk.type);
        const len = handler.getLength(chunk);
        if (acc + len <= startOffset) {
            beforeChunks.push(cloneChunk(chunk));
        } else if (acc < startOffset) {
            const { before } = splitChunkByOffset(chunk, startOffset - acc, len);
            beforeChunks.push(...before);
        }
        acc += len;
    });

    // 끝 라인의 뒷부분 수집
    acc = 0;
    endLine.chunks.forEach(chunk => {
        const handler = chunkRegistry.get(chunk.type);
        const len = handler.getLength(chunk);
        if (acc >= endOffset) {
            afterChunks.push(cloneChunk(chunk));
        } else if (acc < endOffset && acc + len > endOffset) {
            const { after } = splitChunkByOffset(chunk, 0, endOffset - acc);
            afterChunks.push(...after);
        }
        acc += len;
    });

    // 라인 합치기
    const finalChunks = normalizeLineChunks([...beforeChunks, ...afterChunks]);
    newState[startLineIdx] = EditorLineModel(startLine.align, finalChunks);

    // 사이 라인들 삭제
    const deleteCount = endLineIdx - startLineIdx;
    if (deleteCount > 0) {
        newState.splice(startLineIdx + 1, deleteCount);
    }

    // 커서는 선택 영역의 시작점에 위치
    return {
        newState,
        newPos: {
            lineIndex: startLineIdx,
            anchor: {
                chunkIndex: 0, // normalize 후 첫 번째 텍스트 청크일 확률이 높음 (추후 정교화 가능)
                type: 'text',
                offset: startOffset
            }
        },
        deletedLineIndex: deleteCount > 0 ? { start: startLineIdx + 1, count: deleteCount } : null,
        updatedLineIndex: startLineIdx
    };
}

/**
 * ⌫ Backspace Key 상태 계산 통합 함수
 */
export function calculateBackspaceState(currentState, lineIndex, offset, ranges = []) {
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
/*
export function calculateBackspaceState(currentState, lineIndex, offset, ranges = []) {
    // 1. 선택 영역 삭제
    if (ranges?.length > 0 && (ranges.length > 1 || ranges[0].startIndex !== ranges[0].endIndex)) {
        return calculateDeleteSelectionState(currentState, ranges);
    }

    const nextState = [...currentState];
    const currentLine = currentState[lineIndex];

    console.log("🔍 [디버그 레포트]");
    console.log("- 전체 오프셋(offset):", offset);
    console.log("- 청크 개수:", currentLine.chunks.length);

    // 2. 줄 병합 (커서가 줄 맨 앞에 있을 때)
    if (offset === 0 && lineIndex > 0) {
        const prevLine = nextState[lineIndex - 1];
        const lastChunkIdx = Math.max(0, prevLine.chunks.length - 1);
        const lastChunk = prevLine.chunks[lastChunkIdx];
        const handler = chunkRegistry.get(lastChunk.type);
        const lastChunkLen = handler.getLength(lastChunk);

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
                anchor: { chunkIndex: lastChunkIdx, type: lastChunk.type, offset: lastChunkLen }
            },
            deletedLineIndex: lineIndex,
            updatedLineIndex: lineIndex - 1
        };
    }

    // 3. 청크 내부 삭제 로직 (Atomic 삭제 대응)
    const newChunks = [];
    let deleted = false;
    let acc = 0;
    let targetAnchor = null;

    console.log("추가 확인중...!! : " + currentLine.chunks.length);

    for (let i = 0; i < currentLine.chunks.length; i++) {
        const chunk = currentLine.chunks[i];
        const handler = chunkRegistry.get(chunk.type);
        const chunkLen = handler.getLength(chunk);
        const chunkStart = acc;
        const chunkEnd = acc + chunkLen;

        // [핵심] Atomic 청크 삭제 분기 (비디오, 이미지 등)
        // 커서가 청크의 바로 뒤(chunkEnd)에 있을 때 백스페이스를 누르면 해당 청크를 건너뜀
        if (!handler.canSplit && offset === chunkEnd && !deleted) {
            console.log(`[Atomic Delete] ${chunk.type} 삭제됨`);
            deleted = true;
            targetAnchor = {
                chunkIndex: Math.max(0, i - 1),
                type: 'text',
                offset: i > 0 ? chunkRegistry.get(currentLine.chunks[i-1].type).getLength(currentLine.chunks[i-1]) : 0
            };
            // newChunks에 push하지 않음으로써 삭제
        } 
        // 삭제 대상이 아닌 청크들
        else if (deleted || !handler.canSplit || offset <= chunkStart || offset > chunkEnd) {
            console.log("삭제 대상 아닌 청크??");
            newChunks.push(cloneChunk(chunk));
        } 
        // 텍스트 청크 한 글자 삭제
        else {
            const cut = offset - chunkStart;
            const newText = chunk.text.slice(0, cut - 1) + chunk.text.slice(cut);

            if (newText.length > 0) {
                newChunks.push(handler.create(newText, chunk.style));
                targetAnchor = { chunkIndex: i, type: 'text', offset: cut - 1 };
            } else {
                targetAnchor = { chunkIndex: Math.max(0, i - 1), type: 'text', offset: 0 };
            }
            deleted = true;
        }
        acc += chunkLen;
    }

    if (!deleted) return { newState: currentState, newPos: null };

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
*/    

// ⏎ Enter Key
/**
 * 엔터 키 입력 시 현재 라인을 분할하고 새로운 상태를 계산
 * @param {Array} currentState - 전체 에디터 모델 (JSON)
 * @param {number} lineIndex - 엔터가 발생한 라인 인덱스
 * @param {number} offset - 현재 라인 내에서의 절대 오프셋 (텍스트 길이 + Atomic(1))
 */
export function calculateEnterState(currentState, lineIndex, offset) {
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

/*
export function calculateEnterState(currentState, lineIndex, offset) {
    const currentLine = currentState[lineIndex];
    const beforeChunks = [];
    const afterChunks = [];
    let acc = 0;

    currentLine.chunks.forEach(chunk => {
        const handler = chunkRegistry.get(chunk.type);
        const chunkLen = handler.getLength(chunk);
        
        if (!handler.canSplit) {
            // 비디오/이미지: 오프셋이 이 노드 끝보다 작거나 같으면 다음 줄로
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
                if (beforeText) beforeChunks.push(handler.create(beforeText, chunk.style));
                if (afterText) afterChunks.push(handler.create(afterText, chunk.style));
            }
        }
        acc += chunkLen;
    });

    // 핵심: 엔터 친 후 뒷부분이 비어있다면 반드시 빈 텍스트 노드 생성
    const finalAfterChunks = normalizeLineChunks(afterChunks);

    const nextState = [...currentState];
    nextState[lineIndex] = EditorLineModel(currentLine.align, normalizeLineChunks(beforeChunks));
    const newLineData = EditorLineModel(currentLine.align, finalAfterChunks);
    nextState.splice(lineIndex + 1, 0, newLineData);

    return { 
        newState: nextState, 
        newPos: { 
            lineIndex: lineIndex + 1, 
            anchor: { chunkIndex: 0, type: 'text', offset: 0 } 
        }, 
        newLineData 
    };
}
*/
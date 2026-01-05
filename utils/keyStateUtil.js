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
    // 1. 선택 영역이 있는 경우 (드래그 삭제)
    if (ranges?.length > 0 && (ranges.length > 1 || ranges[0].startIndex !== ranges[0].endIndex)) {
        return calculateDeleteSelectionState(currentState, ranges);
    }

    const nextState = [...currentState];
    const currentLine = currentState[lineIndex];

    // 2. 줄 병합 (커서가 줄 맨 앞에 있을 때)
    if (offset === 0 && lineIndex > 0) {
        const prevLine = nextState[lineIndex - 1];
        
        // 이전 줄의 마지막 청크 정보를 확인하여 커서 복원 지점 설정
        const lastChunkIdx = Math.max(0, prevLine.chunks.length - 1);
        const lastChunk = prevLine.chunks[lastChunkIdx];
        const handler = chunkRegistry.get(lastChunk.type);
        const lastChunkLen = handler.getLength(lastChunk);

        // 청크 병합 및 정규화
        const mergedChunks = [
            ...prevLine.chunks.map(cloneChunk), 
            ...currentLine.chunks.map(cloneChunk)
        ];

        nextState[lineIndex - 1] = EditorLineModel(
            prevLine.align, 
            normalizeLineChunks(mergedChunks)
        );
        nextState.splice(lineIndex, 1); // 현재 줄 삭제

        return {
            newState: nextState,
            newPos: {
                lineIndex: lineIndex - 1,
                anchor: {
                    chunkIndex: lastChunkIdx,
                    type: lastChunk.type,
                    offset: lastChunkLen // 이전 줄의 마지막 청크 바로 뒤
                }
            },
            deletedLineIndex: lineIndex,
            updatedLineIndex: lineIndex - 1
        };
    }

    // 3. 한 글자 삭제 (일반적인 경우)
    const newChunks = [];
    let deleted = false;
    let acc = 0;
    let targetAnchor = null;

    for (let i = 0; i < currentLine.chunks.length; i++) {
        const chunk = currentLine.chunks[i];
        const handler = chunkRegistry.get(chunk.type);
        const chunkLen = handler.getLength(chunk);
        const chunkStart = acc;
        const chunkEnd = acc + chunkLen;

        // 삭제 대상이 아닌 청크들
        if (!handler.canSplit || offset <= chunkStart || offset > chunkEnd) {
            newChunks.push(cloneChunk(chunk));
        } 
        // 삭제 대상 청크 발견 (커서가 이 청크 내부 혹은 바로 뒤에 있음)
        else {
            const cut = offset - chunkStart;
            // 한 글자 제거 (텍스트 기준)
            const newText = chunk.text.slice(0, cut - 1) + chunk.text.slice(cut);
            
            if (newText.length > 0) {
                const updatedChunk = handler.create(newText, chunk.style);
                newChunks.push(updatedChunk);
                targetAnchor = {
                    chunkIndex: i,
                    type: 'text',
                    offset: cut - 1
                };
            } else {
                // 청크가 비게 되면 생성하지 않음 (targetAnchor는 이전 혹은 다음으로 보정 필요)
                targetAnchor = {
                    chunkIndex: Math.max(0, i - 1),
                    type: 'text',
                    offset: 0 // 이전 청크 끝으로 붙도록 처리 필요 (normalize에서 처리됨)
                };
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
            anchor: targetAnchor || { chunkIndex: 0, type: 'text', offset: offset - 1 }
        },
        updatedLineIndex: lineIndex
    };
}

// ⏎ Enter Key
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
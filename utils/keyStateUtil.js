// utils/keyStateUtil.js

import { EditorLineModel, TextChunkModel, VideoChunkModel } from '../model/editorModel.js';
// chunkUtils에서 실제 구현된 유틸리티를 가져옵니다.
import { mergeChunks, splitChunkByOffset } from '../utils/mergeUtils.js';

// -----------------------------------------------------------------
// 🚀 공통 로직: chunk를 안전하게 복제 (확장 대비)
// -----------------------------------------------------------------
export function cloneChunk(chunk) {
    if (chunk.type === "text") {
        return TextChunkModel("text", chunk.text, chunk.style);
    }
    if (chunk.type === "video") {
        return VideoChunkModel(chunk.videoId, chunk.src);
    }
    return { ...chunk };
}

// -----------------------------------------------------------------
// 🚀 공통 로직: 정규화된 새 Chunk 배열을 반환하는 헬퍼
// -----------------------------------------------------------------
function normalizeLineChunks(chunks) {
    if (!chunks || chunks.length === 0) {
        return [TextChunkModel("text", "", {})];
    }
    // mergeChunks를 사용하여 연속된 텍스트 청크를 병합합니다.
    return mergeChunks(chunks.map(cloneChunk));
}

// -----------------------------------------------------------------
// ❌ Selection Deletion (선택 영역 삭제 로직)
// -----------------------------------------------------------------
/**
 * 다중/단일 라인 선택 영역을 삭제하고 시작 라인의 앞부분과 끝 라인의 뒷부분을 병합합니다.
 */
function calculateDeleteSelectionState(editorState, ranges) {
    const startRange = ranges[0];
    const endRange = ranges[ranges.length - 1];

    const startLineIndex = startRange.lineIndex;
    const startOffset = startRange.startIndex;
    const endLineIndex = endRange.lineIndex;
    const endOffset = endRange.endIndex;

    // 만약 시작점과 끝점이 같거나, 유효하지 않은 ranges라면 상태 변화 없음 반환
    if (startLineIndex === endLineIndex && startOffset === endOffset) {
        return { newState: editorState, newPos: null, deletedLineIndex: null, updatedLineIndex: null };
    }

    const newState = [...editorState];
    const startLine = editorState[startLineIndex];
    const endLine = editorState[endLineIndex];
    const newPos = { lineIndex: startLineIndex, offset: startOffset };

    let beforeChunks = []; // 시작 라인의 삭제 이전 부분
    let afterChunks = [];  // 끝 라인의 삭제 이후 부분

    // 1. 시작 라인 처리: startOffset 이전의 청크들을 가져옵니다.
    let acc = 0;
    for (const chunk of startLine.chunks) {
        const chunkLen = chunk.type === 'text' ? (chunk.text.length || 0) : 0;
        const chunkStart = acc;
        const chunkEnd = acc + chunkLen;

        if (chunk.type !== 'text' || chunkEnd <= startOffset) {
            beforeChunks.push(cloneChunk(chunk));
        } else if (chunkStart < startOffset && chunkEnd > startOffset) {
            // 삭제 시작 지점이 청크 중간에 있는 경우: 앞부분만 취함
            const { before } = splitChunkByOffset(chunk, startOffset - chunkStart, chunkLen);
            beforeChunks.push(...before);
            break; 
        } else if (chunkStart >= startOffset) {
            // 삭제 시작 지점 (텍스트의 시작)에 도달
            break;
        }
        acc = chunkEnd;
    }

    // 2. 끝 라인 처리: endOffset 이후의 청크들을 가져옵니다.
    acc = 0;
    for (const chunk of endLine.chunks) {
        const chunkLen = chunk.type === 'text' ? (chunk.text.length || 0) : 0;
        const chunkStart = acc;
        const chunkEnd = acc + chunkLen;
        
        if (chunkStart >= endOffset) {
            afterChunks.push(cloneChunk(chunk));
        } else if (chunkStart < endOffset && chunkEnd > endOffset) {
            // 삭제 끝 지점이 청크 중간에 있는 경우: 뒷부분만 취함
            const { after } = splitChunkByOffset(chunk, 0, endOffset - chunkStart);
            afterChunks.push(...after);
        }
        // chunkStart < endOffset && chunkEnd <= endOffset 인 경우는 선택 영역이므로 건너뜁니다.
        acc = chunkEnd;
    }

    // 3. 시작 라인 업데이트 (앞 청크 + 뒤 청크 병합)
    const mergedChunks = [...beforeChunks, ...afterChunks];
    
    newState[startLineIndex] = EditorLineModel(startLine.align, normalizeLineChunks(mergedChunks));

    // 4. 중간 라인 및 끝 라인 제거
    const deleteCount = endLineIndex - startLineIndex;
    
    let deletedLineIndex = null;
    if (deleteCount > 0) {
        // startLineIndex 바로 다음(startLineIndex + 1)부터 deleteCount 만큼 삭제
        newState.splice(startLineIndex + 1, deleteCount);
        deletedLineIndex = { start: startLineIndex + 1, count: deleteCount };
    }

    return {
        newState: newState,
        newPos: newPos,
        deletedLineIndex: deletedLineIndex,
        updatedLineIndex: startLineIndex // 시작 라인은 항상 업데이트됨
    };
}

// -----------------------------------------------------------------
// ⌫ Backspace Key (ranges 인수 추가 및 로직 분기)
// -----------------------------------------------------------------
export function calculateBackspaceState(currentState, lineIndex, offset, ranges = []) {
    
    // ⭐ 0️⃣ 선택 영역이 있는 경우 (Selection Deletion)
    if (ranges && ranges.length > 0 && 
        (ranges.length > 1 || ranges[0].startIndex !== ranges[0].endIndex)) {
        
        // 선택 영역 삭제 로직으로 위임
        return calculateDeleteSelectionState(currentState, ranges); 
    }

    // ----------------------------------------------------
    // 👇 선택 영역이 없을 때만 기존의 단일 커서/줄 병합 로직 실행
    // ----------------------------------------------------
    const nextState = [...currentState];
    const currentLine = currentState[lineIndex];

    let newPos = null;

    // 1️⃣ 줄 병합
    if (offset === 0 && lineIndex > 0) {
        const prevLine = nextState[lineIndex - 1];

        const merged = [
            ...prevLine.chunks.map(cloneChunk),
            ...currentLine.chunks.map(cloneChunk),
        ];

        const prevOffset = prevLine.chunks.reduce((s, c) => s + (c.text?.length || 0), 0);

        // normalizeLineChunks를 통해 병합 시 스타일 병합 처리
        nextState[lineIndex - 1] = EditorLineModel(prevLine.align, normalizeLineChunks(merged));
        nextState.splice(lineIndex, 1);

        return {
            newState: nextState,
            newPos: { lineIndex: lineIndex - 1, offset: prevOffset },
            deletedLineIndex: lineIndex,
            updatedLineIndex: lineIndex - 1
        };
    }

    // 2️⃣ 한 글자 삭제
    const newChunks = [];
    let deleted = false;
    let acc = 0;

    for (const chunk of currentLine.chunks) {
        if (chunk.type !== 'text') {
            newChunks.push(cloneChunk(chunk));
            continue;
        }

        const start = acc;
        const end = acc + chunk.text.length;

        if (offset <= start || offset > end) {
            newChunks.push(cloneChunk(chunk));
        } else {
            const cut = offset - start;
            const newText = chunk.text.slice(0, cut - 1) + chunk.text.slice(cut);
            
            if (newText.length > 0) {
                newChunks.push(TextChunkModel("text", newText, chunk.style));
            }

            newPos = { lineIndex, offset: offset - 1 };
            deleted = true;
        }

        acc = end;
    }

    // 상태 변화가 없으면 종료 시, 모든 필드를 명시적으로 null로 반환
    if (!deleted) return { newState: currentState, newPos: null, deletedLineIndex: null, updatedLineIndex: null };

    // 3️⃣ 빈 줄 처리 (삭제 후 라인이 비었을 때)
    if (newChunks.length === 0) {
        if (lineIndex === 0) {
            // 첫 줄이 비면 빈 텍스트 청크로 남김
            nextState[0] = EditorLineModel("left", normalizeLineChunks([]));
            return { newState: nextState, newPos: { lineIndex: 0, offset: 0 }, updatedLineIndex: 0, deletedLineIndex: null };
        }

        // 현재 라인을 삭제하고 이전 라인으로 커서를 옮김
        nextState.splice(lineIndex, 1);
        const prevLine = nextState[lineIndex - 1];
        const prevOffset = prevLine.chunks.reduce((s, c) => s + (c.text?.length || 0), 0); // 이전 라인의 끝 오프셋

        return {
            newState: nextState,
            newPos: { lineIndex: lineIndex - 1, offset: prevOffset },
            deletedLineIndex: lineIndex, // 이 라인은 삭제됨
            updatedLineIndex: null // 이전 라인은 업데이트되지 않음 (이미 normalizeLineChunks에서 처리됨)
        };
    }

    // 4️⃣ 단일 라인 업데이트
    nextState[lineIndex] = EditorLineModel(currentLine.align, normalizeLineChunks(newChunks));

    return {
        newState: nextState,
        newPos,
        updatedLineIndex: lineIndex,
        deletedLineIndex: null
    };
}


// -----------------------------------------------------------------
// ⏎ Enter Key (기존과 동일)
// -----------------------------------------------------------------
export function calculateEnterState(currentState, lineIndex, offset) {
    // ... (기존 calculateEnterState 로직) ...
    const nextState = [...currentState];
    const currentLine = currentState[lineIndex];

    const beforeChunks = [];
    const afterChunks = [];

    let acc = 0;

    currentLine.chunks.forEach(chunk => {
        const start = acc;
        const end = acc + (chunk.text?.length || 0);

        if (chunk.type !== 'text') {
            beforeChunks.push(cloneChunk(chunk));
        }
        else if (offset <= start) {
            afterChunks.push(TextChunkModel("text", chunk.text, chunk.style));
        }
        else if (offset >= end) {
            beforeChunks.push(TextChunkModel("text", chunk.text, chunk.style));
        }
        else {
            const cut = offset - start;
            const before = chunk.text.slice(0, cut);
            const after = chunk.text.slice(cut);
            if (before) beforeChunks.push(TextChunkModel("text", before, chunk.style));
            if (after) afterChunks.push(TextChunkModel("text", after, chunk.style));
        }

        acc = end;
    });

    nextState[lineIndex] = EditorLineModel(currentLine.align, normalizeLineChunks(beforeChunks));

    const newLineData = EditorLineModel(currentLine.align, normalizeLineChunks(afterChunks));

    nextState.splice(lineIndex + 1, 0, newLineData);

    return {
        newState: nextState,
        newPos: { lineIndex: lineIndex + 1, offset: 0 },
        updatedLineIndex: lineIndex,
        newLineData
    };
}
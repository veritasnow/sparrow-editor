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
    const cloned = (chunks || []).map(cloneChunk);
    const merged = mergeChunks(cloned);

    if (merged.length === 0) {
        // 빈 줄일 때 기본 텍스트 청크 생성도 Registry를 통합니다.
        return [chunkRegistry.get('text').create("", { fontSize: "14px" })];
    }
    return merged;
}

// Selection Deletion (선택 영역 삭제 로직)
function calculateDeleteSelectionState(editorState, ranges) {
    const startRange = ranges[0];
    const endRange   = ranges[ranges.length - 1];

    const { lineIndex: startLineIndex, startIndex: startOffset } = startRange;
    const { lineIndex: endLineIndex, endIndex: endOffset } = endRange;

    if (startLineIndex === endLineIndex && startOffset === endOffset) {
        return { newState: editorState, newPos: null, deletedLineIndex: null, updatedLineIndex: null };
    }

    const newState = [...editorState];
    const startLine = editorState[startLineIndex];
    const endLine = editorState[endLineIndex];

    let beforeChunks = [];
    let afterChunks = [];

    // 1. 시작 라인 처리
    let acc = 0;
    for (const chunk of startLine.chunks) {
        const handler    = chunkRegistry.get(chunk.type);
        const chunkLen   = handler.getLength(chunk); // chunk.text.length 대신 사용
        const chunkStart = acc;
        const chunkEnd   = acc + chunkLen;

        if (!handler.canSplit || chunkEnd <= startOffset) {
            beforeChunks.push(cloneChunk(chunk));
        } else if (chunkStart < startOffset && chunkEnd > startOffset) {
            const { before } = splitChunkByOffset(chunk, startOffset - chunkStart, chunkLen);
            beforeChunks.push(...before);
            break; 
        } else if (chunkStart >= startOffset) break;
        
        acc = chunkEnd;
    }

    // 2. 끝 라인 처리
    acc = 0;
    for (const chunk of endLine.chunks) {
        const handler    = chunkRegistry.get(chunk.type);
        const chunkLen   = handler.getLength(chunk);
        const chunkStart = acc;
        const chunkEnd   = acc + chunkLen;
        
        if (chunkStart >= endOffset) {
            afterChunks.push(cloneChunk(chunk));
        } else if (chunkStart < endOffset && chunkEnd > endOffset) {
            const { after } = splitChunkByOffset(chunk, 0, endOffset - chunkStart);
            afterChunks.push(...after);
        }
        acc = chunkEnd;
    }

    newState[startLineIndex] = EditorLineModel(startLine.align, normalizeLineChunks([...beforeChunks, ...afterChunks]));

    const deleteCount = endLineIndex - startLineIndex;
    if (deleteCount > 0) {
        newState.splice(startLineIndex + 1, deleteCount);
    }

    return { newState, newPos: { lineIndex: startLineIndex, offset: startOffset }, updatedLineIndex: startLineIndex };
}

// ⌫ Backspace Key
export function calculateBackspaceState(currentState, lineIndex, offset, ranges = []) {
    if (ranges?.length > 0 && (ranges.length > 1 || ranges[0].startIndex !== ranges[0].endIndex)) {
        return calculateDeleteSelectionState(currentState, ranges); 
    }

    const nextState   = [...currentState];
    const currentLine = currentState[lineIndex];

    // 1️⃣ 줄 병합
    if (offset === 0 && lineIndex > 0) {
        const prevLine = nextState[lineIndex - 1];
        const merged   = [...prevLine.chunks.map(cloneChunk), ...currentLine.chunks.map(cloneChunk)];
        // Registry를 사용하여 이전 라인의 길이를 안전하게 계산
        const prevOffset = prevLine.chunks.reduce((s, c) => s + chunkRegistry.get(c.type).getLength(c), 0);

        nextState[lineIndex - 1] = EditorLineModel(prevLine.align, normalizeLineChunks(merged));
        nextState.splice(lineIndex, 1);

        return { newState: nextState, newPos: { lineIndex: lineIndex - 1, offset: prevOffset }, deletedLineIndex: lineIndex, updatedLineIndex: lineIndex - 1 };
    }

    // 2️⃣ 한 글자 삭제
    const newChunks = [];
    let deleted = false;
    let acc     = 0;

    for (const chunk of currentLine.chunks) {
        const handler  = chunkRegistry.get(chunk.type);
        const chunkLen = handler.getLength(chunk);

        if (!handler.canSplit || offset <= acc || offset > acc + chunkLen) {
            newChunks.push(cloneChunk(chunk));
        } else {
            const cut = offset - acc;
            const newText = chunk.text.slice(0, cut - 1) + chunk.text.slice(cut);
            
            if (newText.length > 0) {
                // handler.create를 사용하여 모델명 명시 없이 생성
                newChunks.push(handler.create(newText, chunk.style));
            }
            deleted = true;
        }
        acc += chunkLen;
    }

    if (!deleted) return { newState: currentState, newPos: null };

    // 3️⃣ 빈 줄 처리 및 상태 업데이트
    if (newChunks.length === 0 && lineIndex > 0) {
        nextState.splice(lineIndex, 1);
        const prevLine = nextState[lineIndex - 1];
        const prevOffset = prevLine.chunks.reduce((s, c) => s + chunkRegistry.get(c.type).getLength(c), 0);
        return { newState: nextState, newPos: { lineIndex: lineIndex - 1, offset: prevOffset }, deletedLineIndex: lineIndex };
    }

    nextState[lineIndex] = EditorLineModel(currentLine.align, normalizeLineChunks(newChunks));
    return { newState: nextState, newPos: { lineIndex, offset: offset - 1 }, updatedLineIndex: lineIndex };
}

// ⏎ Enter Key
export function calculateEnterState(currentState, lineIndex, offset) {
    const nextState    = [...currentState];
    const currentLine  = currentState[lineIndex];
    const beforeChunks = [];
    const afterChunks  = [];
    let acc = 0;

    currentLine.chunks.forEach(chunk => {
        const handler = chunkRegistry.get(chunk.type);
        const chunkLen = handler.getLength(chunk);
        const start = acc;
        const end = acc + chunkLen;

        console.log('handler.canSplit : ', handler.canSplit);
        console.log('offset : ', offset);
        console.log('start : ', start);
        console.log('end : ', end);


        if (!handler.canSplit) {
            beforeChunks.push(cloneChunk(chunk));
        } else if (offset <= start) {
            afterChunks.push(cloneChunk(chunk));
        } else if (offset >= end) {
            beforeChunks.push(cloneChunk(chunk));
        } else {
            const cut    = offset - start;
            const before = chunk.text.slice(0, cut);
            const after  = chunk.text.slice(cut);
            if (before) beforeChunks.push(handler.create(before, chunk.style));
            if (after) afterChunks.push(handler.create(after, chunk.style));
        }
        acc += chunkLen;
    });

    nextState[lineIndex] = EditorLineModel(currentLine.align, normalizeLineChunks(beforeChunks));
    const newLineData    = EditorLineModel(currentLine.align, normalizeLineChunks(afterChunks));
    nextState.splice(lineIndex + 1, 0, newLineData);

    return { newState: nextState, newPos: { lineIndex: lineIndex + 1, offset: 0 }, updatedLineIndex: lineIndex, newLineData };
}
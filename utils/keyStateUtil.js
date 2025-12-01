import { EditorLineModel, TextChunkModel, VideoChunkModel } from '../model/editorModel.js';

// -----------------------------------------------------------------
// ⏎ Enter Key
// -----------------------------------------------------------------
export function calculateEnterState(currentState, lineIndex, offset) {
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

// -----------------------------------------------------------------
// ⌫ Backspace Key
// -----------------------------------------------------------------
export function calculateBackspaceState(currentState, lineIndex, offset) {
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

    if (!deleted) return { newState: currentState, newPos: null };

    // 3️⃣ 빈 줄 처리
    if (newChunks.length === 0) {
        if (lineIndex === 0) {
            nextState[0] = EditorLineModel("left", normalizeLineChunks([]));
            return { newState: nextState, newPos: { lineIndex: 0, offset: 0 }, updatedLineIndex: 0 };
        }

        nextState.splice(lineIndex, 1);
        const prevLine = nextState[lineIndex - 1];
        const prevOffset = prevLine.chunks.reduce((s, c) => s + (c.text?.length || 0), 0);

        return {
            newState: nextState,
            newPos: { lineIndex: lineIndex - 1, offset: prevOffset },
            deletedLineIndex: lineIndex
        };
    }

    nextState[lineIndex] = EditorLineModel(currentLine.align, normalizeLineChunks(newChunks));

    return {
        newState: nextState,
        newPos,
        updatedLineIndex: lineIndex
    };
}


// -----------------------------------------------------------------
// 🚀 공통 로직: 정규화된 새 Chunk 배열을 반환하는 헬퍼
// -----------------------------------------------------------------
function normalizeLineChunks(chunks) {
    if (!chunks || chunks.length === 0) {
        return [TextChunkModel("text", "", {})];
    }
    return chunks.map(cloneChunk);
}


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

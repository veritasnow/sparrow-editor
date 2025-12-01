import { EditorLineModel, TextChunkModel, VideoChunkModel } from '../model/editorModel.js'; // Model 팩토리 임포트

// === Enter Logic ===
/**
 * Enter 키 입력에 따른 다음 에디터 상태와 커서 위치를 계산합니다.
 * @param {Array} currentState - 현재 에디터 상태
 * @param {number} lineIndex - 커서가 위치한 라인 인덱스
 * @param {number} offset - 커서가 위치한 라인 내 오프셋
 * @returns {{ newState: Array, newPos: {lineIndex: number, offset: number}, newLineData: Object }}
 */
export function calculateEnterState(currentState, lineIndex, offset) {
    const nextState   = [...currentState];
    const currentLine = currentState[lineIndex];
    const lineChunks  = currentLine.chunks;

    // 💡 TextChunkModel을 사용하여 새 배열을 생성하므로, 얕은 복사 대신 모델 사용
    const textBeforeCursor = []; 
    const textAfterCursor  = [];
    let acc = 0;

    // 2. 청크 분할 로직 (상태 계산)
    lineChunks.forEach(chunk => {
        if (chunk.type === "text") {
            const start = acc;
            const end   = acc + chunk.text.length;

            if (offset <= start) {
                textAfterCursor.push(TextChunkModel(chunk.type, chunk.text, chunk.style));
            } else if (offset >= end) {
                textBeforeCursor.push(TextChunkModel(chunk.type, chunk.text, chunk.style));
            } else {
                const textBefore = chunk.text.slice(0, offset - start);
                const textAfter  = chunk.text.slice(offset - start);

                if (textBefore) textBeforeCursor.push(TextChunkModel("text", textBefore, chunk.style));
                if (textAfter)  textAfterCursor.push(TextChunkModel("text", textAfter, chunk.style));
            }

            acc += chunk.text.length;
        } else {
            textBeforeCursor.push(VideoChunkModel(chunk.videoId, chunk.src));
        }
    });    

    // 3. 상태 업데이트
    // 💡 [수정] 현재 라인(lineIndex)의 업데이트된 불변 모델 생성
    const updatedCurrentLine = EditorLineModel(
        currentLine.align,
        textBeforeCursor.length 
            ? textBeforeCursor 
            // 💡 [수정] 빈 경우에도 TextChunkModel 사용
            : [TextChunkModel("text", "", {})] 
    );
    nextState[lineIndex] = updatedCurrentLine;

    // 💡 [수정] 새로 삽입될 라인 모델 생성
    const newLineData = EditorLineModel(
        currentLine.align,
        textAfterCursor.length ? textAfterCursor : [TextChunkModel("text", "", {})]
    );

    nextState.splice(lineIndex + 1, 0, newLineData);
    const newPos = { lineIndex: lineIndex + 1, offset: 0 };
    
    return { newState: nextState, newPos, newLineData, updatedLineIndex: lineIndex };
}

// === Backspace Logic ===

/**
 * Backspace 키 입력에 따른 다음 에디터 상태와 커서 위치를 계산합니다.
 * @param {Array} currentState - 현재 에디터 상태
 * @param {number} lineIndex - 커서가 위치한 라인 인덱스
 * @param {number} offset - 커서가 위치한 라인 내 오프셋
 * @returns {{ newState: Array, newPos: {lineIndex: number, offset: number}|null, deletedLineIndex: number|null, updatedLineIndex: number|null }}
 */

export function calculateBackspaceState(currentState, lineIndex, offset) {
    const nextState = [...currentState];
    const currentLine = currentState[lineIndex];
    const lineChunks = currentLine.chunks;

    let newPos = null;
    let deletedLineIndex = null;
    let updatedLineIndex = null;

    // -----------------------------------------------------
    // 1️⃣ 줄 병합 (offset이 0이고, 첫 줄이 아닐 때)
    // -----------------------------------------------------
    if (offset === 0 && lineIndex > 0) {
        const prevLine = nextState[lineIndex - 1];

        const mergedChunks = [
            ...prevLine.chunks.map(c => cloneChunk(c)),
            ...currentLine.chunks.map(c => cloneChunk(c)),
        ];

        const prevOffset = prevLine.chunks.reduce((s, c) => s + (c.text?.length || 0), 0);

        nextState[lineIndex - 1] = EditorLineModel(prevLine.align, mergedChunks);
        nextState.splice(lineIndex, 1);

        newPos = { lineIndex: lineIndex - 1, offset: prevOffset };
        deletedLineIndex = lineIndex - 1;
        updatedLineIndex = lineIndex - 1;

        return { newState: nextState, newPos, deletedLineIndex, updatedLineIndex };
    }

    // -----------------------------------------------------
    // 2️⃣ 한 글자 삭제 (텍스트 청크만)
    // -----------------------------------------------------
    let acc = 0;
    const newChunks = [];
    let deleted = false;

    for (const chunk of lineChunks) {
        if (chunk.type !== 'text') {
            // 비텍스트 → offset 비교 생략하고 그대로 유지
            newChunks.push(cloneChunk(chunk));
            continue;
        }

        const start = acc;
        const end = acc + chunk.text.length;

        if (offset <= start || offset > end) {
            newChunks.push(cloneChunk(chunk));
        } else {
            const localOffset = offset - start;
            const newText = chunk.text.slice(0, localOffset - 1) +
                            chunk.text.slice(localOffset);

            if (newText.length > 0) {
                newChunks.push(TextChunkModel("text", newText, chunk.style));
            }

            newPos = { lineIndex, offset: offset - 1 };
            deleted = true;
        }

        acc = end;
    }

    if (!deleted) {
        return { newState: currentState, newPos: null, deletedLineIndex: null, updatedLineIndex: null };
    }

    // -----------------------------------------------------
    // 3️⃣ 빈 줄 처리
    // -----------------------------------------------------
    if (newChunks.length === 0) {
        if (lineIndex === 0) {
            nextState[0] = EditorLineModel("left", [TextChunkModel()]);
            updatedLineIndex = 0;
            newPos = { lineIndex: 0, offset: 0 };
        } else {
            nextState.splice(lineIndex, 1);
            deletedLineIndex = lineIndex;

            const prevLine = nextState[lineIndex - 1];
            const prevOffset = prevLine.chunks.reduce((s, c) => s + (c.text?.length || 0), 0);
            newPos = { lineIndex: lineIndex - 1, offset: prevOffset };
        }
    } else {
        nextState[lineIndex] = EditorLineModel(currentLine.align, newChunks);
        updatedLineIndex = lineIndex;
    }

    return { newState: nextState, newPos, deletedLineIndex, updatedLineIndex };
}

// ---------------------------------------------------------
// 🚀 비텍스트 포함 모든 청크를 안전하게 복사하는 헬퍼
// ---------------------------------------------------------
function cloneChunk(chunk) {
    if (chunk.type === "text") {
        return TextChunkModel("text", chunk.text, chunk.style);
    }
    if (chunk.type === "video") {
        return VideoChunkModel(chunk.videoId, chunk.src);
    }
    return { ...chunk }; // 혹시 미래 확장 대비
}
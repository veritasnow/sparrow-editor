// service/key/keyStateUtil.js

// === Enter Logic ===

/**
 * Enter 키 입력에 따른 다음 에디터 상태와 커서 위치를 계산합니다.
 * @param {Array} currentState - 현재 에디터 상태
 * @param {number} lineIndex - 커서가 위치한 라인 인덱스
 * @param {number} offset - 커서가 위치한 라인 내 오프셋
 * @returns {{ newState: Array, newPos: {lineIndex: number, offset: number}, newLineData: Object }}
 */
export function calculateEnterState(currentState, lineIndex, offset) {
    const nextState = [...currentState];
    const currentLine = currentState[lineIndex];
    const lineChunks = currentLine.chunks;

    const textBeforeCursor = [];
    const textAfterCursor = [];
    let acc = 0;

    // 2. 청크 분할 로직 (상태 계산)
    lineChunks.forEach(chunk => {
        const start = acc;
        const end = acc + chunk.text.length;

        if (offset <= start) textAfterCursor.push({ ...chunk });
        else if (offset >= end) textBeforeCursor.push({ ...chunk });
        else {
            textBeforeCursor.push({ ...chunk, text: chunk.text.slice(0, offset - start) });
            textAfterCursor.push({ ...chunk, text: chunk.text.slice(offset - start) });
        }
        acc = end;
    });

    // 3. 상태 업데이트
    nextState[lineIndex] = {
        align: currentLine.align,
        chunks: textBeforeCursor.length ? textBeforeCursor : [{ type: "text", text: "", style: {} }]
    };

    const newLineData = {
        align: currentLine.align,
        chunks: textAfterCursor.length ? textAfterCursor : [{ type: "text", text: "", style: {} }]
    };

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
    const lineChunks = currentLine.chunks.map(c => ({ ...c }));
    let newPos = null;
    let deletedLineIndex = null;
    let updatedLineIndex = null;

    // 2. 1️⃣ 줄 병합 (커서가 라인 맨 앞에 있고, 0번째 줄이 아닐 때)
    if (offset === 0 && lineIndex > 0) {
        const prevLine = nextState[lineIndex - 1];
        
        // 청크 병합
        const mergedChunks = [
            ...(prevLine.chunks || []).map(c => ({ ...c })),
            ...(currentLine.chunks || []).map(c => ({ ...c })) 
        ].filter(c => c && c.type === 'text'); // 비텍스트 청크를 제외하고 병합하는 로직은 유틸리티에 남깁니다.

        // 병합 후 상태 업데이트
        const prevOffset = (prevLine.chunks || []).reduce((sum, c) => sum + c.text.length, 0);

        nextState[lineIndex - 1] = {
            align: prevLine.align,
            chunks: mergedChunks.length ? mergedChunks : [{ type: "text", text: "", style: {} }]
        };
        
        deletedLineIndex = lineIndex;
        updatedLineIndex = lineIndex - 1; // 병합된 이전 라인의 인덱스
        
        nextState.splice(lineIndex, 1); // 현재 라인 삭제
        
        newPos = { lineIndex: lineIndex - 1, offset: prevOffset };
        
        return { newState: nextState, newPos, deletedLineIndex, updatedLineIndex };
    }

    // 3. 2️⃣ 한 글자 삭제 (라인 내부)
    let acc = 0;
    const newChunks = [];
    let deleted = false;

    for (const chunk of lineChunks) {
        const start = acc;
        const end = acc + chunk.text.length;

        if (offset <= start) newChunks.push({ ...chunk });
        else if (offset > end) newChunks.push({ ...chunk });
        else {
            // 삭제가 발생할 청크
            const localOffset = offset - start;
            // 텍스트 한 글자 삭제
            const newText = chunk.text.slice(0, localOffset - 1) + chunk.text.slice(localOffset); 
            if (newText.length > 0) newChunks.push({ ...chunk, text: newText });
            
            newPos = { lineIndex, offset: offset - 1 };
            deleted = true;
        }
        acc = end;
    }

    // 삭제가 전혀 일어나지 않은 경우 (e.g., 라인 맨 앞인데 0번째 줄이거나 비텍스트 청크 앞)
    if (!deleted && offset === 0) {
        return { newState: currentState, newPos: null, deletedLineIndex: null, updatedLineIndex: null };
    }

    // 4. 3️⃣ 빈 줄 처리 (삭제 후 줄이 비었을 때)
    if (deleted && newChunks.length === 0) {
        if (lineIndex === 0) {
            // 0번째 줄이 비면, 빈 텍스트 청크 유지 (최소 상태 유지)
            nextState[0] = { align: nextState[0].align || "left", chunks: [{ type: "text", text: "", style: {} }] };
            updatedLineIndex = 0;
            newPos = { lineIndex: 0, offset: 0 };
        } else {
            // 빈 줄 삭제 (상태 업데이트)
            deletedLineIndex = lineIndex;
            nextState.splice(lineIndex, 1);
            
            // 커서 위치 조정: 이전 줄의 끝으로 이동
            const prevLine = nextState[lineIndex - 1]; 
            const prevOffset = (prevLine.chunks || []).reduce((sum, c) => sum + (c.text?.length || 0), 0);
            newPos = { lineIndex: lineIndex - 1, offset: prevOffset };
        }
    } else if (deleted) {
        // 글자가 삭제되었고 줄이 남아있을 때 상태 업데이트
        nextState[lineIndex] = { ...currentLine, chunks: newChunks };
        updatedLineIndex = lineIndex;
    }
    
    // 상태 변화가 없다면 (deleted === false && offset > 0)
    if (!deleted && deletedLineIndex === null && updatedLineIndex === null) {
        return { newState: currentState, newPos: null, deletedLineIndex: null, updatedLineIndex: null };
    }

    return { newState: nextState, newPos, deletedLineIndex, updatedLineIndex };
}
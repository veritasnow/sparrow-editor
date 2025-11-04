import { EditorLineModel, TextChunkModel } from '../../model/editorModel.js'; // Model 팩토리 임포트

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
        const start = acc;
        const end   = acc + chunk.text.length;

        if (offset <= start) {
            // 💡 TextChunkModel로 불변 객체 복사
            textAfterCursor.push(TextChunkModel(chunk.type, chunk.text, chunk.style));
        }
        else if (offset >= end) {
            // 💡 TextChunkModel로 불변 객체 복사
            textBeforeCursor.push(TextChunkModel(chunk.type, chunk.text, chunk.style));
        }
        else {
            // 💡 TextChunkModel로 새로운 텍스트를 가진 불변 객체 생성
            const textBefore = chunk.text.slice(0, offset - start);
            const textAfter  = chunk.text.slice(offset - start);

            textBeforeCursor.push(TextChunkModel(chunk.type, textBefore, chunk.style));
            textAfterCursor.push(TextChunkModel(chunk.type, textAfter, chunk.style));
        }
        acc = end;
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
    // 💡 [수정] 청크를 복사할 필요 없이, Model을 통해 안전하게 처리되므로 제거: .map(c => ({ ...c }))
    const lineChunks = currentLine.chunks; 
    let newPos = null;
    let deletedLineIndex = null;
    let updatedLineIndex = null;

    // 2. 1️⃣ 줄 병합 (커서가 라인 맨 앞에 있고, 0번째 줄이 아닐 때)
    if (offset === 0 && lineIndex > 0) {
        const prevLine = nextState[lineIndex - 1];
        
        // 청크 병합
        // 💡 [수정] 병합 시에도 TextChunkModel을 사용하여 새 불변 객체 생성
        const mergedChunks = [
            ...(prevLine.chunks || []).map(c => TextChunkModel(c.type, c.text, c.style)),
            ...(currentLine.chunks || []).map(c => TextChunkModel(c.type, c.text, c.style)) 
        ].filter(c => c && c.type === 'text'); 

        // 병합 후 상태 업데이트
        const prevOffset = (prevLine.chunks || []).reduce((sum, c) => sum + c.text.length, 0);

        // 💡 [수정] 병합된 새 라인 모델 생성
        const updatedPrevLine = EditorLineModel(
            prevLine.align,
            mergedChunks.length ? mergedChunks : [TextChunkModel("text", "", {})]
        );
        nextState[lineIndex - 1] = updatedPrevLine;
        
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

        if (offset <= start) {
            // 💡 [수정] TextChunkModel로 불변 객체 복사
            newChunks.push(TextChunkModel(chunk.type, chunk.text, chunk.style));
        }
        else if (offset > end) {
             // 💡 [수정] TextChunkModel로 불변 객체 복사
            newChunks.push(TextChunkModel(chunk.type, chunk.text, chunk.style));
        }
        else {
            // 삭제가 발생할 청크
            const localOffset = offset - start;
            // 텍스트 한 글자 삭제
            const newText = chunk.text.slice(0, localOffset - 1) + chunk.text.slice(localOffset); 
            
            if (newText.length > 0) {
                // 💡 [수정] TextChunkModel로 새로운 텍스트를 가진 불변 객체 생성
                newChunks.push(TextChunkModel(chunk.type, newText, chunk.style));
            }
            
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
            // 💡 [수정] EditorLineModel과 TextChunkModel 사용
            nextState[0] = EditorLineModel(
                nextState[0].align || "left", 
                [TextChunkModel("text", "", {})]
            );
            updatedLineIndex = 0;
            newPos = { lineIndex: 0, offset: 0 };
        } else {
            // 빈 줄 삭제 로직은 그대로
            deletedLineIndex = lineIndex;
            nextState.splice(lineIndex, 1);
            
            // 커서 위치 조정: 이전 줄의 끝으로 이동
            const prevLine = nextState[lineIndex - 1]; 
            const prevOffset = (prevLine.chunks || []).reduce((sum, c) => sum + (c.text?.length || 0), 0);
            newPos = { lineIndex: lineIndex - 1, offset: prevOffset };
        }
    } else if (deleted) {
        // 글자가 삭제되었고 줄이 남아있을 때 상태 업데이트
        // 💡 [수정] EditorLineModel을 사용하여 새 불변 라인 모델 생성
        nextState[lineIndex] = EditorLineModel(currentLine.align, newChunks);
        updatedLineIndex = lineIndex;
    }
    
    // 상태 변화가 없다면 (deleted === false && deletedLineIndex === null && updatedLineIndex === null)
    if (!deleted && deletedLineIndex === null && updatedLineIndex === null) {
        return { newState: currentState, newPos: null, deletedLineIndex: null, updatedLineIndex: null };
    }


    return { newState: nextState, newPos, deletedLineIndex, updatedLineIndex };
}

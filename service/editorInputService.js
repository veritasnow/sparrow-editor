// 기존 bindInputEvent 함수 (변화 없음)
export function bindInputEvent(editorEl, app, ui) {
    let composing = false;
    let lastCompositionEnd = 0;

    editorEl.addEventListener('compositionstart', () => {
        composing = true;
    });

    editorEl.addEventListener('compositionend', () => {
        composing = false;
        lastCompositionEnd = Date.now();
        handleInput();
    });

    editorEl.addEventListener('input', (e) => {
        // 개행 중복 방지
        if (e.inputType === 'insertParagraph') return;

        const timeSinceCompositionEnd = Date.now() - lastCompositionEnd;
        const inputData = e.data || '';
        
        const PUNCTUATION_MARKS = ['.', ' ', '?', '!', ',', ':', ';', '"', "'"];
        const isPunctuationOrSpace = e.inputType === 'insertText' && PUNCTUATION_MARKS.includes(inputData);

        // 문장 부호가 아니면서, 한글 입력 직후 짧은 시간 내에 입력된 것은 무시 (중복 방지)
        if (!isPunctuationOrSpace && timeSinceCompositionEnd < 50) {
            return;
        }

        if (!composing) handleInput();
    });


    // ----------------------------------------------------------------------
    // 리팩토링된 handleInput 함수
    // ----------------------------------------------------------------------
    function handleInput() {
    // 💡 변경: window.getSelection()과 중복 DOM 탐색 대신 ui 서비스 호출
        const selectionContext = ui.getSelectionContext(); // ui.getSelectionContext() 호출
        
        if (!selectionContext) return;
        
        // 1. ui모듈이 제공 - 선택영역 정보
        const { 
                lineIndex, 
                parentP, 
                container, 
                cursorOffset,
                activeNode,        
                dataIndex          
            } = selectionContext;
            
        ui.ensureFirstLine();

        if (lineIndex < 0) return;

        const currentState   = app.getState().present.editorState;
        const currentLine    = currentState[lineIndex] || { align: "left", chunks: [] };

        const updatedLine    = { ...currentLine, chunks: [...currentLine.chunks] };
        let isNewChunk       = false;
        let isChunkRendering = false;
        let restoreData      = null;

        // 1. 기존 [data-index] 텍스트 청크 업데이트 (가장 일반적인 경우)
        if (dataIndex !== null && updatedLine.chunks[dataIndex] && updatedLine.chunks[dataIndex].type === 'text') {
            const oldChunk = updatedLine.chunks[dataIndex];
            const newText  = activeNode.textContent;

            if (oldChunk.text !== newText) {
                updatedLine.chunks[dataIndex] = { ...oldChunk, text: newText };
                isChunkRendering = true;
                restoreData = { lineIndex, chunkIndex: dataIndex, offset: cursorOffset };
            }
        } 
        // 2. 새로운 청크 추가 또는 청크 배열 재구성 (data-index 밖에서 입력 발생)
        else {
            const { newChunks, restoreData: newRestoreData } = ui.parseParentPToChunks(
                parentP, 
                currentLine.chunks, 
                container, 
                cursorOffset, 
                lineIndex
            );
            
            restoreData = newRestoreData;

            // 청크 배열이 실제로 변경되었을 때만 업데이트
            if (JSON.stringify(newChunks) !== JSON.stringify(currentLine.chunks)) {
                updatedLine.chunks = newChunks;
                isNewChunk = true; // DOM 구조가 변경되었으므로 전체 렌더링이 필요
            }
        }

        // 상태 저장
        const nextState      = [...currentState];
        nextState[lineIndex] = updatedLine;
        app.saveEditorState(nextState);

        // 3. 렌더링 및 커서 복원
        if (isNewChunk) {
            // 라인 전체를 재렌더링하여 DOM을 상태에 동기화
            ui.renderLine(editorEl.id, lineIndex, updatedLine);
            
            // 재파싱으로 얻은 위치로 커서 복원
            if (restoreData) {
                ui.restoreSelectionPositionByChunk(restoreData);
            } else {
                 // 복원 위치를 찾지 못했다면 라인 끝으로 이동 (안전 장치)
                 const lastChunk = updatedLine.chunks[updatedLine.chunks.length - 1];
                 if (lastChunk && lastChunk.type === 'text') {
                     ui.restoreSelectionPositionByChunk({
                         lineIndex,
                         chunkIndex: updatedLine.chunks.length - 1,
                         offset: lastChunk.text.length
                     });
                 }
            }
            
        } else if (isChunkRendering) {
            // 기존 텍스트 청크만 업데이트된 경우 (부분 렌더링)
            ui.renderChunk(editorEl.id, lineIndex, dataIndex, updatedLine.chunks[dataIndex]);
            ui.restoreSelectionPositionByChunk(restoreData);
        }
    }
}
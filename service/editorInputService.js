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
        const isPunctuationOrSpace = e.inputType === 'insertText' && (inputData === '.' || inputData === ' ');

        if (!isPunctuationOrSpace && timeSinceCompositionEnd < 50) {
            return;
        }

        if (!composing) handleInput();
    });


// ----------------------------------------------------------------------
// 리팩토링된 handleInput 함수
// ----------------------------------------------------------------------

    function handleInput() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        ui.ensureFirstLine();

        const range = selection.getRangeAt(0);
        const container = range.startContainer;
        const cursorOffset = range.startOffset;

        const parentP = container.nodeType === Node.TEXT_NODE
            ? container.parentElement.closest('p')
            : container.closest('p');
        if (!parentP) return;

        const lineIndex = Array.prototype.indexOf.call(editorEl.children, parentP);
        if (lineIndex < 0) return;

        const currentState = app.getState().present.editorState;
        const currentLine = currentState[lineIndex] || { align: "left", chunks: [] };

        const activeNode = container.nodeType === Node.TEXT_NODE
            ? container.parentElement.closest('[data-index]')
            : container.closest('[data-index]');
        const dataIndex = activeNode ? parseInt(activeNode.dataset.index, 10) : null;

        const updatedLine = { ...currentLine, chunks: [...currentLine.chunks] };
        let isNewChunk = false;
        let isChunkRendering = false;
        let restoreData = null;

        // 1. 기존 [data-index] 텍스트 청크 업데이트 (가장 일반적인 경우)
        if (dataIndex !== null && updatedLine.chunks[dataIndex] && updatedLine.chunks[dataIndex].type === 'text') {
            const oldChunk = updatedLine.chunks[dataIndex];
            const newText = activeNode.textContent;

            if (oldChunk.text !== newText) {
                updatedLine.chunks[dataIndex] = { ...oldChunk, text: newText };
                isChunkRendering = true;
                restoreData = { lineIndex, chunkIndex: dataIndex, offset: cursorOffset };
            }
        } 
        // 2. 새로운 청크 추가 또는 청크 배열 재구성 (data-index 밖에서 입력 발생)
        else {
            const { newChunks, restoreData: newRestoreData } = parseDOMToChunks(
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
        const nextState = [...currentState];
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


// 새로운 유틸리티 함수: DOM 구조를 읽어 청크 배열을 생성하고 커서 복원 데이터를 반환
function parseDOMToChunks(parentP, currentLineChunks, selectionContainer, cursorOffset, lineIndex) {
    const newChunks = [];
    let textBuffer = '';
    let restoreData = null;
    let newChunkIndex = 0; // 커서가 위치한 텍스트 청크의 최종 인덱스

    Array.from(parentP.childNodes).forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            // 텍스트 노드는 버퍼에 추가
            textBuffer += node.textContent;
            
            // 현재 커서가 이 텍스트 노드에 있으면 복원 정보 기록
            if (node === selectionContainer) {
                // 이 텍스트가 다음 번 청크로 추가될 것이므로, newChunks.length가 임시 인덱스
                newChunkIndex = newChunks.length;
                restoreData = { lineIndex, chunkIndex: newChunkIndex, offset: cursorOffset };
            }

        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // 텍스트 버퍼가 차 있으면, 하나의 'text' 청크로 변환하여 추가
            if (textBuffer.length > 0) {
                newChunks.push({ type: 'text', text: textBuffer, style: {} });
                textBuffer = '';
            }

            // [data-index]를 가진 청크 엘리먼트 (예: iframe) 처리
            if (node.hasAttribute('data-index')) {
                const oldIndex = parseInt(node.dataset.index, 10);
                // 기존 상태에서 해당 청크를 찾아 복사
                const existingChunk = currentLineChunks[oldIndex] || 
                                      currentLineChunks.find(c => c.type !== 'text' && c.src === node.getAttribute('src')); 
                
                if (existingChunk) {
                    newChunks.push(existingChunk);
                }
            }
        }
    });

    // 순회 후 텍스트 버퍼에 남은 내용이 있다면 마지막 청크로 추가
    if (textBuffer.length > 0) {
        newChunks.push({ type: 'text', text: textBuffer, style: {} });
    }
    
    // 만약 커서 위치를 찾지 못했고, 마지막에 텍스트 청크가 있다면 그 끝으로 복원
    if (!restoreData && newChunks.length > 0 && newChunks[newChunks.length - 1].type === 'text' && selectionContainer.nodeType === Node.TEXT_NODE) {
         restoreData = { 
             lineIndex, 
             chunkIndex: newChunks.length - 1, 
             offset: newChunks[newChunks.length - 1].text.length 
         };
    }

    return { newChunks, restoreData };
}
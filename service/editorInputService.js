// /service/createEditorInputService.js (신설)

/**
 * 에디터의 입력(Input) 이벤트 발생 시, State를 업데이트하고
 * UI 렌더링을 요청하는 핵심 도메인 로직을 처리하는 서비스 팩토리입니다.
 * * @param {Object} app - Editor State Application
 * @param {Object} ui - UI Application (DOM/Selection/Rendering)
 * @returns {Object} processInput 함수
 */
export function createEditorInputService(app, ui) {

    /**
     * DOM의 현재 상태를 읽어 State에 반영하고, 필요한 UI 갱신을 요청합니다.
     */
    function processInput() {
        // 💡 기존 editorInputService.js의 handleInput() 내부 로직 전체를 여기에 붙여넣습니다.
        
        const selectionContext = ui.getSelectionContext();
        if (!selectionContext) return;
        
        // 1. ui모듈이 제공 - 선택영역 정보
        const { 
            lineIndex, parentP, container, cursorOffset, activeNode, dataIndex          
        } = selectionContext;
        
        ui.ensureFirstLine();

        if (lineIndex < 0) return;

        const currentState   = app.getState().present.editorState;
        const currentLine    = currentState[lineIndex] || { align: "left", chunks: [] };

        const updatedLine    = { ...currentLine, chunks: [...currentLine.chunks] };
        let isNewChunk       = false;
        let isChunkRendering = false;
        let restoreData      = null;

        // 1. 기존 [data-index] 텍스트 청크 업데이트 (가장 일반적인 경우)
        if (dataIndex !== null && updatedLine.chunks[dataIndex] && updatedLine.chunks[dataIndex].type === 'text') {
            const oldChunk = updatedLine.chunks[dataIndex];
            const newText  = activeNode.textContent;

            if (oldChunk.text !== newText) {
                updatedLine.chunks[dataIndex] = { ...oldChunk, text: newText };
                isChunkRendering = true;
                restoreData = { lineIndex, chunkIndex: dataIndex, offset: cursorOffset };
            }
        } 
        // 2. 새로운 청크 추가 또는 청크 배열 재구성 (data-index 밖에서 입력 발생)
        else {
            const { newChunks, restoreData: newRestoreData } = ui.parseParentPToChunks(
                parentP, currentLine.chunks, container, cursorOffset, lineIndex
            );
            
            restoreData = newRestoreData;

            // 청크 배열이 실제로 변경되었을 때만 업데이트
            if (JSON.stringify(newChunks) !== JSON.stringify(currentLine.chunks)) {
                updatedLine.chunks = newChunks;
                isNewChunk = true; 
            }
        }

        // 상태 저장 (Core 책임)
        const nextState      = [...currentState];
        nextState[lineIndex] = updatedLine;
        app.saveEditorState(nextState);

        // 3. 렌더링 및 커서 복원 (UI 요청)
        if (isNewChunk) {
            ui.renderLine(lineIndex, updatedLine);
            
            if (restoreData) {
                ui.restoreSelectionPositionByChunk(restoreData);
            } else {
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
            ui.renderChunk(lineIndex, dataIndex, updatedLine.chunks[dataIndex]);
            ui.restoreSelectionPositionByChunk(restoreData);
        }
    }

    return {
        processInput
    };
}
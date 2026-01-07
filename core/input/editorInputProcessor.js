import { EditorLineModel } from '../../model/editorLineModel.js';
import { chunkRegistry } from '../chunk/chunkRegistry.js';
import { inputModelService } from './inputModelService.js';

export function createEditorInputProcessor(app, ui, domSelection) {

    function processInput() {
        const selection = domSelection.getSelectionContext();
        if (!selection) return;

        ui.ensureFirstLine();
        if (selection.lineIndex < 0) return;

        const currentState = app.getState().present.editorState;
        const currentLine = currentState[selection.lineIndex] || EditorLineModel();

        // 1. 모델 업데이트 계산
        const { updatedLine, flags, restoreData } = updateLineModel(currentLine, selection);
        if (!flags.hasChange) return;

        // 2. 상태 저장
        saveEditorState(currentState, selection.lineIndex, updatedLine);
        
        // 3. 커서 데이터 정규화 및 저장
        const finalRestoreData = inputModelService.normalizeRestoreData(restoreData);
        if (finalRestoreData) {
            app.saveCursorState(finalRestoreData);
        }
        
        // 4. 렌더링 및 통합 복원
        renderAndRestoreCursor(updatedLine, selection.lineIndex, flags, finalRestoreData);
    }

    function updateLineModel(currentLine, selection) {
        let updatedLine = EditorLineModel(currentLine.align, [...currentLine.chunks]);
        let isNewChunk = false;
        let isChunkRendering = false;
        let restoreData = null;

        const { dataIndex, cursorOffset, activeNode, lineIndex } = selection;

        // [청크 분기] 텍스트 청크
        if (dataIndex !== null && updatedLine.chunks[dataIndex]?.type === 'text') {
            const result = inputModelService.updateTextChunk(updatedLine, dataIndex, activeNode, cursorOffset, lineIndex);
            if (result) {
                ({ updatedLine, restoreData } = result);
                isChunkRendering = true;
            }
        } 
        // [청크 분기] 테이블 청크 (UI 의존성 때문에 일단 유지)
        else if (dataIndex !== null && updatedLine.chunks[dataIndex]?.type === 'table') {
            const result = updateExistingTableChunk(updatedLine, dataIndex, activeNode, lineIndex);
            if (result) {
                ({ updatedLine, restoreData } = result);
                isChunkRendering = true;
            }
        } 
        // [청크 분기] 구조적 변화 (DOM 파싱)
        else {
            const result = createOrRebuildChunks(updatedLine, currentLine, selection);
            if (result) {
                ({ updatedLine, restoreData } = result);
                isNewChunk = true;
            }
        }

        if (isNewChunk && !restoreData) {
            restoreData = inputModelService.createDefaultRestoreData(updatedLine, selection.lineIndex);
        }

        return {
            updatedLine,
            flags: { isNewChunk, isChunkRendering, hasChange: isNewChunk || isChunkRendering },
            restoreData
        };
    }

    function updateExistingTableChunk(updatedLine, dataIndex, activeNode, lineIndex) {
        const oldChunk = updatedLine.chunks[dataIndex];
        const tableEl = activeNode.tagName === 'TABLE' ? activeNode : activeNode.closest?.('table');
        if (!tableEl) return null;

        const { data } = ui.extractTableDataFromDOM(tableEl);
        if (JSON.stringify(oldChunk.data) === JSON.stringify(data)) return null;

        const sel = window.getSelection();
        const range = sel.getRangeAt(0);
        const td = range.startContainer.nodeType === 3 ? range.startContainer.parentElement.closest('td') : range.startContainer.closest('td');
        
        const rowIndex = td ? Array.from(td.parentElement.parentElement.children).indexOf(td.parentElement) : 0;
        const colIndex = td ? Array.from(td.parentElement.children).indexOf(td) : 0;

        const handler = chunkRegistry.get('table');
        const newChunk = handler.clone({ data });
        const newChunks = [...updatedLine.chunks];
        newChunks[dataIndex] = newChunk;

        return {
            updatedLine: EditorLineModel(updatedLine.align, newChunks),
            restoreData: {
                lineIndex,
                anchor: {
                    chunkIndex: dataIndex,
                    type: 'table',
                    detail: { rowIndex, colIndex, offset: range.startOffset }
                }
            }
        };
    }

    function createOrRebuildChunks(updatedLine, currentLine, selection) {
        const { parentP, container, cursorOffset, lineIndex } = selection;
        const { newChunks, restoreData } = ui.parseLineDOM(
            parentP, currentLine.chunks, container, cursorOffset, lineIndex
        );

        if (JSON.stringify(newChunks) === JSON.stringify(currentLine.chunks)) return null;

        return {
            updatedLine: EditorLineModel(updatedLine.align, newChunks),
            restoreData
        };
    }

    function saveEditorState(currentState, lineIndex, updatedLine) {
        const nextState = [...currentState];
        nextState[lineIndex] = updatedLine;
        app.saveEditorState(nextState);
    }

    function renderAndRestoreCursor(updatedLine, lineIndex, flags, restoreData) {
        const { isNewChunk, isChunkRendering } = flags;

        if (isNewChunk) {
            ui.renderLine(lineIndex, updatedLine);
            if (restoreData) domSelection.restoreCursor(restoreData);
            return;
        }

        if (isChunkRendering) {
            const chunkIndex = restoreData.anchor.chunkIndex;
            const chunk = updatedLine.chunks[chunkIndex];

            if (!chunk || chunk.type === 'table') {
                ui.renderLine(lineIndex, updatedLine);
                if (restoreData) domSelection.restoreCursor(restoreData);
                return;
            }

            ui.renderChunk(lineIndex, chunkIndex, chunk);
            domSelection.restoreCursor(restoreData);
        }
    }

    return { processInput };
}
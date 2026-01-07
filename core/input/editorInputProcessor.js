import { EditorLineModel } from '../../model/editorLineModel.js';
import { inputModelService } from './inputModelService.js';

export function createEditorInputProcessor(app, ui, domSelection) {

    function processInput() {
        const selection = domSelection.getSelectionContext();
        if (!selection || selection.lineIndex < 0) return;

        ui.ensureFirstLine();

        const currentState = app.getState().present.editorState;
        const currentLine = currentState[selection.lineIndex] || EditorLineModel();

        // 1. 모델 업데이트 계산
        const { updatedLine, flags, restoreData } = calculateUpdate(currentLine, selection);
        if (!flags.hasChange) return;

        // 2. 상태 저장 (State & Cursor)
        saveFinalState(selection.lineIndex, updatedLine, restoreData);
        
        // 3. 렌더링 실행
        const finalRestoreData = inputModelService.normalizeRestoreData(restoreData);
        executeRendering(updatedLine, selection.lineIndex, flags, finalRestoreData);
    }

    /**
     * 비즈니스 로직 분기: 어떤 업데이트를 수행할지 결정
     */
    function calculateUpdate(currentLine, selection) {
        const { dataIndex, activeNode, cursorOffset, lineIndex } = selection;
        let updatedLine = EditorLineModel(currentLine.align, [...currentLine.chunks]);
        let result = null;
        let flags = { isNewChunk: false, isChunkRendering: false };

        // Case 1: 텍스트 청크 업데이트
        if (dataIndex !== null && updatedLine.chunks[dataIndex]?.type === 'text') {
            result = inputModelService.updateTextChunk(updatedLine, dataIndex, activeNode.textContent, cursorOffset, lineIndex);
            flags.isChunkRendering = !!result;
        } 
        // Case 2: 테이블 청크 업데이트
        else if (dataIndex !== null && updatedLine.chunks[dataIndex]?.type === 'table') {
            const tableEl = activeNode.closest?.('table');
            if (tableEl) {
                const { data } = ui.extractTableDataFromDOM(tableEl);
                const tablePos = domSelection.getTableInternalPosition(); // Selection 서비스에서 좌표 획득
                result = inputModelService.updateTableModel(updatedLine, dataIndex, data, tablePos, lineIndex);
                flags.isChunkRendering = !!result;
            }
        } 
        // Case 3: 구조적 변화 (DOM Rebuild)
        if (!result) {
            const rebuild = ui.parseLineDOM(selection.parentP, currentLine.chunks, selection.container, cursorOffset, lineIndex);
            if (JSON.stringify(rebuild.newChunks) !== JSON.stringify(currentLine.chunks)) {
                result = { updatedLine: EditorLineModel(updatedLine.align, rebuild.newChunks), restoreData: rebuild.restoreData };
                flags.isNewChunk = true;
            }
        }

        if (!result) return { flags: { hasChange: false } };

        // 기본 복원 데이터 보정
        if (flags.isNewChunk && !result.restoreData) {
            result.restoreData = inputModelService.createDefaultRestoreData(result.updatedLine, lineIndex);
        }

        return { ...result, flags: { ...flags, hasChange: true } };
    }

    function saveFinalState(lineIndex, updatedLine, restoreData) {
        const nextState = [...app.getState().present.editorState];
        nextState[lineIndex] = updatedLine;
        app.saveEditorState(nextState);

        const normalized = inputModelService.normalizeRestoreData(restoreData);
        if (normalized) app.saveCursorState(normalized);
    }

    function executeRendering(updatedLine, lineIndex, flags, restoreData) {
        if (flags.isNewChunk) {
            ui.renderLine(lineIndex, updatedLine);
            if (restoreData) domSelection.restoreCursor(restoreData);
            return;
        }

        if (flags.isChunkRendering && restoreData) {
            const chunkIndex = restoreData.anchor.chunkIndex;
            const chunk = updatedLine.chunks[chunkIndex];

            // 테이블은 줄 전체 렌더링이 안전함
            if (!chunk || chunk.type === 'table') {
                ui.renderLine(lineIndex, updatedLine);
                domSelection.restoreCursor(restoreData);
                return;
            }

            ui.renderChunk(lineIndex, chunkIndex, chunk);
            domSelection.restoreCursor(restoreData);
        }
    }

    return { processInput };
}
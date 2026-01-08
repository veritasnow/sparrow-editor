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
            result = handleTableUpdate(updatedLine, dataIndex, activeNode, lineIndex);
            flags.isChunkRendering = !!result; // 데이터 변화가 있을 때만 true가 됨
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

    function handleTableUpdate(updatedLine, dataIndex, activeNode, lineIndex) {
        const tableEl = activeNode.tagName === 'TABLE' ? activeNode : activeNode.closest?.('table');
        if (!tableEl) return null;

        // 1. 데이터 추출 및 변경 확인
        const { data } = ui.extractTableDataFromDOM(tableEl);
        const oldChunk = updatedLine.chunks[dataIndex];
        if (JSON.stringify(oldChunk.data) === JSON.stringify(data)) return null;

        // 2. 현재 커서의 셀 위치(Row/Col) 추적
        const sel = window.getSelection();
        if (!sel.rangeCount) return null;

        const range = sel.getRangeAt(0);
        const td = range.startContainer.nodeType === 3 
            ? range.startContainer.parentElement.closest('td') 
            : range.startContainer.closest('td');

        if (!td) return null;

        const tr = td.parentElement;
        const rowIndex = Array.from(tr.parentElement.children).indexOf(tr);
        const colIndex = Array.from(tr.children).indexOf(td);

        // 3. 모델 교체 및 결과 반환
        const newChunks = [...updatedLine.chunks];
        newChunks[dataIndex] = { ...oldChunk, data };

        return {
            updatedLine: { ...updatedLine, chunks: newChunks },
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

    return { processInput };
}
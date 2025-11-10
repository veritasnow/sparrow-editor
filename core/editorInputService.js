import { EditorLineModel, TextChunkModel } from '../../model/editorModel.js';

/**
 * 에디터의 입력(Input) 이벤트 발생 시, State를 업데이트하고
 * UI 렌더링을 요청하는 핵심 도메인 로직을 처리하는 서비스 팩토리입니다.
 */
export function createEditorInputService(app, ui) {

    function processInput() {
        const selection = ui.getSelectionContext();
        if (!selection) return;

        ui.ensureFirstLine();
        if (selection.lineIndex < 0) return;

        const currentState = app.getState().present.editorState;
        const currentLine = currentState[selection.lineIndex] || EditorLineModel();

        const { updatedLine, flags, restoreData } = updateLineModel(currentLine, selection);
        if (!flags.hasChange) return;

        saveEditorState(currentState, selection.lineIndex, updatedLine);
        renderAndRestoreCursor(updatedLine, selection.lineIndex, flags, restoreData);
    }

    // ----------------------------
    // [1] 라인 모델 업데이트 단계
    // ----------------------------
    function updateLineModel(currentLine, selection) {
        let updatedLine = EditorLineModel(currentLine.align, [...currentLine.chunks]);
        let isNewChunk = false;
        let isChunkRendering = false;
        let restoreData = null;

        const { dataIndex, cursorOffset, activeNode, lineIndex } = selection;

        if (dataIndex !== null && updatedLine.chunks[dataIndex]?.type === 'text') {
            const result = updateExistingChunk(updatedLine, dataIndex, activeNode, cursorOffset, lineIndex);
            if (result) {
                ({ updatedLine, restoreData } = result);
                isChunkRendering = true;
            }
        } else {
            const result = createOrRebuildChunks(updatedLine, currentLine, selection);
            if (result) {
                ({ updatedLine, restoreData } = result);
                isNewChunk = true;
            }
        }

        if (isNewChunk && !restoreData) {
            restoreData = createDefaultRestoreData(updatedLine, selection.lineIndex);
        }

        return {
            updatedLine,
            flags: { isNewChunk, isChunkRendering, hasChange: isNewChunk || isChunkRendering },
            restoreData
        };
    }

    // ----------------------------
    // [2] 기존 청크 업데이트
    // ----------------------------
    function updateExistingChunk(updatedLine, dataIndex, activeNode, cursorOffset, lineIndex) {
        const oldChunk = updatedLine.chunks[dataIndex];
        const newText = activeNode.textContent;

        if (oldChunk.text === newText) return null;

        const newChunk = TextChunkModel(oldChunk.type, newText, oldChunk.style);
        const newChunks = [...updatedLine.chunks];
        newChunks[dataIndex] = newChunk;

        return {
            updatedLine: EditorLineModel(updatedLine.align, newChunks),
            restoreData: { lineIndex, chunkIndex: dataIndex, offset: cursorOffset }
        };
    }

    // ----------------------------
    // [3] 새로운 청크 구성
    // ----------------------------
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

    // ----------------------------
    // [4] 기본 커서 복원 데이터 생성
    // ----------------------------
    function createDefaultRestoreData(updatedLine, lineIndex) {
        const lastChunk = updatedLine.chunks[updatedLine.chunks.length - 1];
        if (!lastChunk || lastChunk.type !== 'text') return null;
        return {
            lineIndex,
            chunkIndex: updatedLine.chunks.length - 1,
            offset: lastChunk.text.length
        };
    }

    // ----------------------------
    // [5] 상태 저장
    // ----------------------------
    function saveEditorState(currentState, lineIndex, updatedLine) {
        const nextState = [...currentState];
        nextState[lineIndex] = updatedLine;
        app.saveEditorState(nextState);
    }

    // ----------------------------
    // [6] 렌더링 및 커서 복원
    // ----------------------------
    function renderAndRestoreCursor(updatedLine, lineIndex, flags, restoreData) {
        const { isNewChunk, isChunkRendering } = flags;

        if (isNewChunk) {
            ui.renderLine(lineIndex, updatedLine);
            if (restoreData) ui.restoreSelectionPositionByChunk(restoreData);
        } else if (isChunkRendering) {
            const { chunkIndex } = restoreData;
            ui.renderChunk(lineIndex, chunkIndex, updatedLine.chunks[chunkIndex]);
            ui.restoreSelectionPositionByChunk(restoreData);
        }
    }

    return { processInput };
}

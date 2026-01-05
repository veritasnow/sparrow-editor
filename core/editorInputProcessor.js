import { EditorLineModel } from '../model/editorLineModel.js';
import { chunkRegistry } from '../core/chunk/chunkRegistry.js';

/**
 * 에디터의 입력(Input) 이벤트 발생 시, State를 업데이트하고
 * UI 렌더링을 요청하는 핵심 도메인 로직을 처리하는 서비스 팩토리입니다.
 */
export function createEditorInputProcessor(app, ui) {

    function processInput() {
        // [수정] ui.getSelectionPosition()을 호출하여 통합 커서 정보를 가져옴
        // (선택 사항: 기존 getSelectionContext를 사용하되 정보를 보강해서 사용 가능)
        const selection = ui.getSelectionContext(); 
        if (!selection) return;

        ui.ensureFirstLine();
        if (selection.lineIndex < 0) return;

        const currentState = app.getState().present.editorState;
        const currentLine  = currentState[selection.lineIndex] || EditorLineModel();

        // 1. 모델 업데이트 시도
        const { updatedLine, flags, restoreData } = updateLineModel(currentLine, selection);
        if (!flags.hasChange) return;

        // 2. 상태 저장
        saveEditorState(currentState, selection.lineIndex, updatedLine);
        
        // 3. 커서 데이터 정규화 (추출한 함수 사용)
        const finalRestoreData = normalizeRestoreData(restoreData);

        // 4. 커서 상태 저장
        saveCursorState(finalRestoreData);
        
        // 5. 렌더링 및 통합 복원 함수 호출
        renderAndRestoreCursor(updatedLine, selection.lineIndex, flags, finalRestoreData);
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

        // [청크 분기] 텍스트 청크 업데이트
        if (dataIndex !== null && updatedLine.chunks[dataIndex]?.type === 'text') {
            const result = updateExistingChunk(updatedLine, dataIndex, activeNode, cursorOffset, lineIndex);
            if (result) {
                ({ updatedLine, restoreData } = result);
                isChunkRendering = true;
            }
        } 
        // [청크 분기] 테이블 청크 업데이트
        else if (dataIndex !== null && updatedLine.chunks[dataIndex]?.type === 'table') {
            const result = updateExistingTableChunk(updatedLine, dataIndex, activeNode, lineIndex);
            if (result) {
                ({ updatedLine, restoreData } = result);
                isChunkRendering = true;
            }
        } 
        // [청크 분기] 구조적 변화(태그 삭제, 병합 등)가 감지된 경우
        else {
            const result = createOrRebuildChunks(updatedLine, currentLine, selection);
            if (result) {
                ({ updatedLine, restoreData } = result);
                isNewChunk = true;
            }
        }

        // 기본 복원 데이터 보정
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
    // [2] 기존 청크 업데이트 (Text)
    // ----------------------------
    function updateExistingChunk(updatedLine, dataIndex, activeNode, cursorOffset, lineIndex) {
        const oldChunk = updatedLine.chunks[dataIndex];
        const newText = activeNode.textContent;

        if (oldChunk.text === newText) return null;

        const handler  = chunkRegistry.get(oldChunk.type);
        const newChunk = handler.create(newText, oldChunk.style);
        const newChunks = [...updatedLine.chunks];
        newChunks[dataIndex] = newChunk;

        return {
            updatedLine: EditorLineModel(updatedLine.align, newChunks),
            // 통합 모델 규격에 맞춤
            restoreData: { 
                lineIndex, 
                anchor: { chunkIndex: dataIndex, type: 'text', offset: cursorOffset } 
            }
        };
    }

    // ----------------------------
    // [2-1] 기존 테이블 청크 업데이트
    // ----------------------------
    function updateExistingTableChunk(updatedLine, dataIndex, activeNode, lineIndex) {
        const oldChunk = updatedLine.chunks[dataIndex];
        const tableEl = activeNode.tagName === 'TABLE' ? activeNode : activeNode.closest?.('table');
        if (!tableEl) return null;

        const { data } = ui.extractTableDataFromDOM(tableEl);
        if (JSON.stringify(oldChunk.data) === JSON.stringify(data)) return null;

        // 현재 포커스된 셀의 좌표를 SelectionService 기능을 빌려 추출
        // (UI 서비스에 해당 기능이 있다고 가정하거나 직접 추출)
        const sel = window.getSelection();
        const range = sel.getRangeAt(0);
        const td = range.startContainer.nodeType === 3 ? range.startContainer.parentElement.closest('td') : range.startContainer.closest('td');
        
        const rowIndex = td ? Array.from(td.parentElement.parentElement.children).indexOf(td.parentElement) : 0;
        const colIndex = td ? Array.from(td.parentElement.children).indexOf(td) : 0;

        const handler  = chunkRegistry.get('table');
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

    // ----------------------------
    // [3] 새로운 청크 구성 (DOM 파싱)
    // ----------------------------
    function createOrRebuildChunks(updatedLine, currentLine, selection) {
        const { parentP, container, cursorOffset, lineIndex } = selection;

        // ui.parseLineDOM이 이미 lineIndex, anchor 등을 포함한 통합 restoreData를 반환하도록 설계됨
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
        const lastIdx = updatedLine.chunks.length - 1;
        const lastChunk = updatedLine.chunks[lastIdx];
        if (!lastChunk) return null;

        return {
            lineIndex,
            anchor: {
                chunkIndex: lastIdx,
                type: lastChunk.type,
                offset: lastChunk.text ? lastChunk.text.length : 0,
                detail: lastChunk.type === 'table' ? { rowIndex: 0, colIndex: 0, offset: 0 } : null
            }
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
    // [6] 커서 위치 저장 (통합 구조로 통일)
    // ----------------------------
    function saveCursorState(restoreData) {
       if (!restoreData) return;
       app.saveCursorState(restoreData);
    }

    // ----------------------------
    // [7] 렌더링 및 커서 복원
    // ----------------------------
    function renderAndRestoreCursor(updatedLine, lineIndex, flags, restoreData) {
        const { isNewChunk, isChunkRendering } = flags;

        // Case 1: 라인 전체가 다시 그려지는 경우
        if (isNewChunk) {
            ui.renderLine(lineIndex, updatedLine);
            if (restoreData) ui.restoreCursor(restoreData);
            return;
        }

        // Case 2: 특정 청크만 부분 렌더링하는 경우
        if (isChunkRendering) {
            const chunkIndex = restoreData.anchor.chunkIndex;
            const chunk      = updatedLine.chunks[chunkIndex];

            // 테이블이거나 특수 청크는 해당 줄 전체를 렌더링하여 구조 안정성 확보
            if (!chunk || chunk.type === 'table') {
                ui.renderLine(lineIndex, updatedLine);
                if (restoreData) ui.restoreCursor(restoreData);
                return;
            }

            // 일반 텍스트 청크만 DOM 부분 교체 후 커서 복원
            ui.renderChunk(lineIndex, chunkIndex, chunk);
            ui.restoreCursor(restoreData);
        }
    }

    // ----------------------------
    // [8] TODO 구형 restoreData 구조를 최신 anchor 기반 통합 모델로 정규화 -> 추후 구형 restoreData 개선 후 이거 없애야함
    // ----------------------------    
    function normalizeRestoreData(restoreData) {
        if (!restoreData) return null;

        // 이미 최신 구조(anchor 존재)라면 그대로 반환
        if (restoreData.anchor) return restoreData;

        // 구형 구조({lineIndex, chunkIndex, offset})를 최신 구조로 변환
        return {
            lineIndex: restoreData.lineIndex,
            anchor: {
                chunkIndex: restoreData.chunkIndex ?? 0,
                type: 'text', // 기본값으로 text 지정
                offset: restoreData.offset ?? 0,
                detail: null
            }
        };
    }    

    return { processInput };
}
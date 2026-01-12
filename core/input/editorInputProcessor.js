// /module/uiModule/processor/editorInputProcessor.js
import { EditorLineModel } from '../../model/editorLineModel.js';
import { inputModelService } from './inputModelService.js';
import { normalizeCursorData } from '../../utils/cursorUtils.js';



export function createEditorInputProcessor(state, ui, domSelection, defaultKey) {

    /**
     * [Main Entry] 입력 이벤트 발생 시 호출
     */
    function processInput() {
        // 1. 현재 포커스가 위치한 컨테이너(본문 root 또는 특정 TD/TH)의 ID 확보
        const activeKey = domSelection.getActiveKey() || defaultKey;
        const selection = domSelection.getSelectionContext();

        if (!selection || selection.lineIndex < 0) return;

        ui.ensureFirstLine(); 

        // 2. 해당 영역(Key)의 상태 데이터 및 현재 줄 모델 확보
        const currentState = state.getState(activeKey); 
        const currentLine = currentState[selection.lineIndex] || EditorLineModel();

        // 3. 모델 업데이트 계산 (activeKey를 전달하여 restoreData에 귀속시킴)
        const { updatedLine, flags, restoreData } = calculateUpdate(currentLine, selection, activeKey);
        
        if (!flags || !flags.hasChange || updatedLine === currentLine) return;

        // 4. 상태 저장 및 커서 위치 기록
        saveFinalState(activeKey, selection.lineIndex, updatedLine, restoreData);
        
        // 5. UI 렌더링 실행
        const finalRestoreData = normalizeCursorData(restoreData, activeKey);
        executeRendering(updatedLine, selection.lineIndex, flags, finalRestoreData);
    }

    /**
     * 현재 라인 상태와 DOM 정보를 비교하여 업데이트된 모델 생성
     */
    function calculateUpdate(currentLine, selection, activeKey) {
        const { dataIndex, activeNode, cursorOffset, lineIndex, container } = selection;
        let result = null;
        let flags = { isNewChunk: false, isChunkRendering: false };

        // --- Case 1: 단순 텍스트 업데이트 (본문/테이블 셀 공통) ---
        if (dataIndex !== null && currentLine.chunks[dataIndex]?.type === 'text') {
            result = inputModelService.updateTextChunk(
                currentLine, dataIndex, activeNode.textContent, cursorOffset, lineIndex, activeKey
            );
            flags.isChunkRendering = !!result;
        } 
        
        // --- Case 2: 구조적 변화 (Enter, Delete, 스타일 변경 등 DOM Rebuild) ---
        if (!result) {
            const rebuild = ui.parseLineDOM(
                selection.parentP, 
                currentLine.chunks, 
                container, 
                cursorOffset, 
                lineIndex
            );
            
            if (rebuild.newChunks !== currentLine.chunks) {
                result = { 
                    updatedLine: EditorLineModel(currentLine.align, rebuild.newChunks), 
                    restoreData: { ...rebuild.restoreData, containerId: activeKey } 
                };
                flags.isNewChunk = true;
            }
        }

        if (!result) return { flags: { hasChange: false } };

        // 복원 데이터가 없는 경우 기본값 생성
        if (flags.isNewChunk && !result.restoreData) {
            result.restoreData = inputModelService.createDefaultRestoreData(result.updatedLine, lineIndex, activeKey);
        }

        return { ...result, flags: { ...flags, hasChange: true } };
    }

    /**
     * 상태 저장소(Key별 분리)에 저장
     */
    function saveFinalState(key, lineIndex, updatedLine, restoreData) {
        const currentState = state.getState(key);
        const nextState = [...currentState];
        nextState[lineIndex] = updatedLine;
        
        state.saveEditorState(key, nextState);

        const normalized = normalizeCursorData(restoreData, key);
        if (normalized) {
            state.saveCursorState(normalized);
        }
    }

    /**
     * 변경된 모델에 맞춰 UI 업데이트
     */
    function executeRendering(updatedLine, lineIndex, flags, restoreData) {
        if (flags.isNewChunk) {
            ui.renderLine(lineIndex, updatedLine);
            if (restoreData) domSelection.restoreCursor(restoreData);
            return;
        }

        if (flags.isChunkRendering && restoreData) {
            const chunkIndex = restoreData.anchor.chunkIndex;
            const chunk = updatedLine.chunks[chunkIndex];

            // 텍스트 청크만 부분 렌더링, 나머지는 라인 전체 렌더링
            if (!chunk || chunk.type !== 'text') {
                ui.renderLine(lineIndex, updatedLine);
            } else {
                ui.renderChunk(lineIndex, chunkIndex, chunk);
            }
            domSelection.restoreCursor(restoreData);
        }
    }

    return { processInput };
}
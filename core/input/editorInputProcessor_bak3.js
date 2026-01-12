import { EditorLineModel } from '../../model/editorLineModel.js';
import { inputModelService } from './inputModelService.js';
import { chunkRegistry } from '../chunk/chunkRegistry.js';

/**
 * 에디터의 실시간 텍스트 입력 및 청크 업데이트를 처리하는 프로세서
 */
export function createEditorInputProcessor(state, ui, domSelection, defaultKey) {

    /**
     * [Main Entry] 입력 이벤트 발생 시 호출
     */
    function processInput() {
        const activeKey = domSelection.getActiveKey() || defaultKey;
        const selection = domSelection.getSelectionContext();

        if (!selection || selection.lineIndex < 0) return;

        ui.ensureFirstLine(); 

        // 1. 해당 영역(Key)의 상태 데이터 확보
        const currentState = state.getState(activeKey); 
        const currentLine = currentState[selection.lineIndex] || EditorLineModel();

        // 2. 모델 업데이트 계산 (원본 참조를 유지하며 계산)
        const { updatedLine, flags, restoreData } = calculateUpdate(currentLine, selection);
        
        // [수정] flags.hasChange 뿐만 아니라, 참조값(updatedLine === currentLine)도 체크
        if (!flags || !flags.hasChange || updatedLine === currentLine) return;

        // 3. 상태 저장 (Key 기반 저장 및 커서 위치 기록)
        saveFinalState(activeKey, selection.lineIndex, updatedLine, restoreData);
        
        // 4. UI 렌더링 실행
        const finalRestoreData = inputModelService.normalizeRestoreData(restoreData);
        executeRendering(updatedLine, selection.lineIndex, flags, finalRestoreData);
    }

    /**
     * 현재 라인 상태와 DOM 정보를 비교하여 업데이트된 모델을 생성
     */
    function calculateUpdate(currentLine, selection) {
        const { dataIndex, activeNode, cursorOffset, lineIndex, container } = selection;
        
        // [중요] 미리 [...chunks]를 복사하지 않습니다. (Lazy Copy)
        let result = null;
        let flags = { isNewChunk: false, isChunkRendering: false };

        // --- Case 1 & 2: 인덱스가 있고 청크 타입이 일치할 때 ---
        if (dataIndex !== null) {
            const targetChunk = currentLine.chunks[dataIndex];
            
            if (targetChunk?.type === 'text') {
                // updateTextChunk 내부에서 "진짜 변했을 때만" 새 객체를 반환하도록 구현됨을 전제
                result = inputModelService.updateTextChunk(
                    currentLine, 
                    dataIndex, 
                    activeNode.textContent, 
                    cursorOffset, 
                    lineIndex
                );
                flags.isChunkRendering = !!result;
            } else if (targetChunk?.type === 'table') {
                result = handleTableUpdate(currentLine, dataIndex, activeNode, lineIndex);
                flags.isChunkRendering = !!result;
            }
        } 
        
        // --- Case 3: 구조적 변화 (DOM Rebuild) ---
        if (!result) {
            const rebuild = ui.parseLineDOM(
                selection.parentP, 
                currentLine.chunks, 
                container, 
                cursorOffset, 
                lineIndex
            );
            
            // [개선] JSON.stringify를 삭제하고 rebuild 결과의 dirty 여부를 확인
            // rebuild 과정에서 내용이 같다면 currentLine.chunks 참조를 그대로 반환하도록 설계해야 함
            if (rebuild.newChunks !== currentLine.chunks) {
                result = { 
                    updatedLine: EditorLineModel(currentLine.align, rebuild.newChunks), 
                    restoreData: rebuild.restoreData 
                };
                flags.isNewChunk = true;
            }
        }

        if (!result) return { flags: { hasChange: false } };

        if (flags.isNewChunk && !result.restoreData) {
            result.restoreData = inputModelService.createDefaultRestoreData(result.updatedLine, lineIndex);
        }

        return { ...result, flags: { ...flags, hasChange: true } };
    }

    /**
     * 상태를 Key별 저장소에 저장하고 커서 위치를 기록
     */
    function saveFinalState(key, lineIndex, updatedLine, restoreData) {
        // [개선] 전체 배열을 수동으로 복사하는 대신, 필요한 정보만 state에 전달
        // state(EditorApp) 내부에서 snapshotService가 효율적으로 처리할 수 있게 유도
        const currentState = state.getState(key);
        
        // 참조가 다를 때만 새 배열 생성 (Shallow Copy)
        const nextState = [...currentState];
        nextState[lineIndex] = updatedLine;
        
        // Key와 함께 저장
        state.saveEditorState(key, nextState);

        const normalized = inputModelService.normalizeRestoreData(restoreData);
        if (normalized) {
            state.saveCursorState({ 
                ...normalized, 
                containerId: key 
            });
        }
    }

    /**
     * 변경된 모델에 맞춰 UI 조각 또는 전체 라인을 업데이트
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

            if (!chunk || chunk.type === 'table') {
                ui.renderLine(lineIndex, updatedLine);
                domSelection.restoreCursor(restoreData);
                return;
            }

            ui.renderChunk(lineIndex, chunkIndex, chunk);
            domSelection.restoreCursor(restoreData);
        }
    }

    /**
     * 테이블 청크 데이터 동기화
     */
    function handleTableUpdate(currentLine, dataIndex, activeNode, lineIndex) {
        const chunk = currentLine.chunks[dataIndex];
        const handler = chunkRegistry.get('table');
        
        if (!handler) return null;

        const updatedTableChunk = handler.updateFromDOM(chunk, activeNode);
        
        // [중요] 테이블 데이터가 이전과 같다면(참조 동일) 업데이트 스킵
        if (updatedTableChunk === chunk) return null;

        // 바뀐 줄에 대해서만 새 line 객체 생성
        const newChunks = [...currentLine.chunks];
        newChunks[dataIndex] = updatedTableChunk;

        return {
            updatedLine: EditorLineModel(currentLine.align, newChunks),
            restoreData: {
                lineIndex,
                anchor: domSelection.getSelectionPosition().anchor
            }
        };
    }    

    return { processInput };
}
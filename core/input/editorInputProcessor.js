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
        // 1. 현재 커서가 위치한 컨테이너의 Key(ID)와 Selection 정보 확보
        const activeKey = domSelection.getActiveKey() || defaultKey;
        const selection = domSelection.getSelectionContext();

        // 비정상적인 위치거나 라인 인덱스가 없으면 중단
        if (!selection || selection.lineIndex < 0) return;

        // UI 기본 구조 보장 (필요 시 첫 줄 생성)
        ui.ensureFirstLine(); 

        // 2. 해당 영역(Key)의 상태 데이터 확보
        const currentState = state.getState(activeKey); 
        const currentLine = currentState[selection.lineIndex] || EditorLineModel();

        // 3. 모델 업데이트 계산 (비즈니스 로직 분기)
        const { updatedLine, flags, restoreData } = calculateUpdate(currentLine, selection);
        
        // 변경 사항이 없으면 프로세스 종료
        if (!flags || !flags.hasChange) return;

        // 4. 상태 저장 (Key 기반 저장 및 커서 위치 기록)
        saveFinalState(activeKey, selection.lineIndex, updatedLine, restoreData);
        
        // 5. UI 렌더링 실행
        const finalRestoreData = inputModelService.normalizeRestoreData(restoreData);
        executeRendering(updatedLine, selection.lineIndex, flags, finalRestoreData);
    }

    /**
     * 현재 라인 상태와 DOM 정보를 비교하여 업데이트된 모델을 생성
     */
    function calculateUpdate(currentLine, selection) {
        const { dataIndex, activeNode, cursorOffset, lineIndex, container } = selection;
        let updatedLine = EditorLineModel(currentLine.align, [...currentLine.chunks]);
        let result = null;
        let flags = { isNewChunk: false, isChunkRendering: false };

        // --- Case 1: 특정 텍스트 청크 내부에서 입력이 일어난 경우 ---
        if (dataIndex !== null && updatedLine.chunks[dataIndex]?.type === 'text') {
            result = inputModelService.updateTextChunk(
                updatedLine, 
                dataIndex, 
                activeNode.textContent, 
                cursorOffset, 
                lineIndex
            );
            flags.isChunkRendering = !!result;
        } 
        
        // --- Case 2: 테이블 청크 내부 수정 (셀 에디팅이 아닌 테이블 구조 내 수정 시) ---
        else if (dataIndex !== null && updatedLine.chunks[dataIndex]?.type === 'table') {
            result = handleTableUpdate(updatedLine, dataIndex, activeNode, lineIndex);
            flags.isChunkRendering = !!result;
        }
        
        // --- Case 3: 구조적 변화 (한글 조합, 복사 붙여넣기, 청크 삭제 등 DOM Rebuild가 필요한 경우) ---
        if (!result) {
            const rebuild = ui.parseLineDOM(
                selection.parentP, 
                currentLine.chunks, 
                container, 
                cursorOffset, 
                lineIndex
            );
            
            // 데이터가 실제로 변했는지 체크
            if (JSON.stringify(rebuild.newChunks) !== JSON.stringify(currentLine.chunks)) {
                result = { 
                    updatedLine: EditorLineModel(updatedLine.align, rebuild.newChunks), 
                    restoreData: rebuild.restoreData 
                };
                flags.isNewChunk = true;
            }
        }

        // 아무런 변화가 없다면
        if (!result) return { flags: { hasChange: false } };

        // Rebuild 시 복구 데이터가 없다면 기본값 생성
        if (flags.isNewChunk && !result.restoreData) {
            result.restoreData = inputModelService.createDefaultRestoreData(result.updatedLine, lineIndex);
        }

        return { ...result, flags: { ...flags, hasChange: true } };
    }

    /**
     * 상태를 Key별 저장소에 저장하고 커서 위치를 기록
     */
    function saveFinalState(key, lineIndex, updatedLine, restoreData) {
        // 1. 해당 Key의 전체 라인 배열 복사 및 특정 라인 교체
        const nextState = [...state.getState(key)];
        nextState[lineIndex] = updatedLine;
        
        // 2. Key 기반 State 저장
        state.saveEditorState(key, nextState);

        // 3. 커서 상태 저장 (영역 ID 포함)
        const normalized = inputModelService.normalizeRestoreData(restoreData);
        if (normalized) {
            state.saveCursorState({ 
                ...normalized, 
                containerId: key // 💡 어떤 영역의 커서인지 명시
            });
        }
    }

    /**
     * 변경된 모델에 맞춰 UI 조각 또는 전체 라인을 업데이트
     */
    function executeRendering(updatedLine, lineIndex, flags, restoreData) {
        // 전체 라인 리빌드 (P 태그 내부 전체 교체)
        if (flags.isNewChunk) {
            ui.renderLine(lineIndex, updatedLine);
            if (restoreData) domSelection.restoreCursor(restoreData);
            return;
        }

        // 부분 청크 렌더링 (성능 최적화: 바뀐 Span만 교체)
        if (flags.isChunkRendering && restoreData) {
            const chunkIndex = restoreData.anchor.chunkIndex;
            const chunk = updatedLine.chunks[chunkIndex];

            // 안전장치: 청크가 없거나 테이블 타입이면 전체 렌더링으로 전환
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
    function handleTableUpdate(updatedLine, dataIndex, activeNode, lineIndex) {
        const chunk = updatedLine.chunks[dataIndex];
        const handler = chunkRegistry.get('table');
        
        if (!handler) return null;

        // 테이블 핸들러를 통해 DOM의 현재 상태를 모델로 가져옴
        const updatedTableChunk = handler.updateFromDOM(chunk, activeNode);
        updatedLine.chunks[dataIndex] = updatedTableChunk;

        // 테이블은 복잡하므로 렌더링 시 restoreData가 필요함
        const pos = domSelection.getSelectionPosition();
        return {
            updatedLine,
            restoreData: {
                lineIndex,
                anchor: pos.anchor
            }
        };
    }    

    return { processInput };
}
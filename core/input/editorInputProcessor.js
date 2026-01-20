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
        
        console.log('[InputProcessor] ActiveKey:', activeKey);
        console.log('[selection] :', selection);        
        
        if (!selection || selection.lineIndex < 0) return;

        // 💡 렌더링 시 targetKey(activeKey)를 전달하도록 수정
        ui.ensureFirstLine(activeKey); 

        // 2. 해당 영역(Key)의 상태 데이터 및 현재 줄 모델 확보
        const currentState = state.getState(activeKey); 
        const currentLine = currentState[selection.lineIndex] || EditorLineModel();

        // 3. 모델 업데이트 계산
        const { updatedLine, flags, restoreData } = calculateUpdate(currentLine, selection, activeKey);

        if (!flags || !flags.hasChange || updatedLine === currentLine) return;

        // 4. 상태 저장 및 커서 위치 기록
        saveFinalState(activeKey, selection.lineIndex, updatedLine, restoreData);
        
        // 5. [중요] UI 렌더링 실행 (activeKey 전달)
        const finalRestoreData = normalizeCursorData(restoreData, activeKey);
        executeRendering(updatedLine, selection.lineIndex, flags, finalRestoreData, activeKey);
    }

    /**
     * 현재 라인 상태와 DOM 정보를 비교하여 업데이트된 모델 생성
     */
    function calculateUpdate(currentLine, selection, activeKey) {
        const {
            dataIndex,
            activeNode,
            cursorOffset,
            lineIndex,
            container,
            range
        } = selection;

        let result = null;
        let flags = { isNewChunk: false, isChunkRendering: false };

        // --- Case 1: 단순 텍스트 업데이트 ---
        if (
            dataIndex !== null &&
            activeNode &&
            currentLine.chunks[dataIndex]?.type === 'text'
        ) {
            const safeText = getSafeTextFromRange(range);

            result = inputModelService.updateTextChunk(
                currentLine,
                dataIndex,
                safeText,          // ✅ textContent 제거
                cursorOffset,
                lineIndex,
                activeKey
            );

            flags.isChunkRendering = !!result;
        }

        // --- Case 2: DOM Rebuild ---
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
                    updatedLine: EditorLineModel(
                        currentLine.align,
                        rebuild.newChunks
                    ),
                    restoreData: {
                        ...rebuild.restoreData,
                        containerId: activeKey
                    }
                };
                flags.isNewChunk = true;
            }
        }

        if (!result) return { flags: { hasChange: false } };

        return { ...result, flags: { ...flags, hasChange: true } };
    }
    
    function getSafeTextFromRange(range) {
        if (!range) return '';

        const node = range.startContainer;

        // ✅ 진짜 입력이 발생한 텍스트 노드만
        if (node.nodeType === Node.TEXT_NODE) {
            return node.nodeValue ?? '';
        }

        return '';
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
     * 💡 변경된 모델에 맞춰 UI 업데이트 (targetKey 추가)
     */
    function executeRendering(updatedLine, lineIndex, flags, restoreData, targetKey) {
        // 1. 컨테이너 및 현재 라인 엘리먼트 확보
        const container = document.getElementById(targetKey);
        const lineEl = container?.querySelectorAll(':scope > .text-block')[lineIndex];

        if (flags.isNewChunk) {
            // 💡 [추가] 새로운 청크가 생겨서 라인 전체를 다시 그릴 때, 기존 테이블 DOM을 백업합니다.
            const tablePool = lineEl ? Array.from(lineEl.querySelectorAll('.chunk-table')) : null;

            // 💡 uiAPI.renderLine에 targetKey와 tablePool 전달
            ui.renderLine(lineIndex, updatedLine, targetKey, tablePool);
            
            if (restoreData) domSelection.restoreCursor(restoreData);
            return;
        }

        if (flags.isChunkRendering && restoreData) {
            const chunkIndex = restoreData.anchor.chunkIndex;
            const chunk = updatedLine.chunks[chunkIndex];

            if (!chunk || chunk.type !== 'text') {
                // 💡 여기도 마찬가지로 라인 전체 렌더링 시 테이블 보호
                const tablePool = lineEl ? Array.from(lineEl.querySelectorAll('.chunk-table')) : null;
                ui.renderLine(lineIndex, updatedLine, targetKey, tablePool);
            } else {
                // renderChunk는 해당 텍스트 노드의 값만 바꾸므로 테이블 Pool이 필요 없습니다.
                ui.renderChunk(lineIndex, chunkIndex, chunk, targetKey);
            }
            domSelection.restoreCursor(restoreData);
        }
    }
    return { processInput };
}
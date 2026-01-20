// /module/uiModule/processor/editorInputProcessor.js
import { EditorLineModel } from '../../model/editorLineModel.js';
import { inputModelService } from './inputModelService.js';
import { normalizeCursorData } from '../../utils/cursorUtils.js';

export function createEditorInputProcessor(state, ui, domSelection, defaultKey) {

    /**
     * [Main Entry] 입력 이벤트 발생 시 호출
     */
    function processInput() {
        const activeKey = domSelection.getActiveKey() || defaultKey;
        const selection = domSelection.getSelectionContext();
        
        if (!selection || selection.lineIndex < 0) return;

        // 1. 최소 한 줄 보장
        ui.ensureFirstLine(activeKey); 

        // 2. 현재 상태 데이터 확보
        const currentState = state.getState(activeKey); 
        const currentLine = currentState[selection.lineIndex] || EditorLineModel();

        // 💡 [핵심] 테이블이 있는 행에서 입력 시 분리 처리
        const hasTable = currentLine.chunks.some(c => c.type === 'table');
        if (hasTable) {
            handleTableLineInput(activeKey, selection, currentLine, currentState);
            return; 
        }

        // 3. 일반 텍스트 업데이트 모델 계산
        const { updatedLine, flags, restoreData } = calculateUpdate(currentLine, selection, activeKey);

        if (!flags || !flags.hasChange || updatedLine === currentLine) return;

        // 4. 상태 저장 및 커서 위치 기록
        saveFinalState(activeKey, selection.lineIndex, updatedLine, restoreData);
        
        // 5. UI 렌더링 실행
        const finalRestoreData = normalizeCursorData(restoreData, activeKey);
        executeRendering(updatedLine, selection.lineIndex, flags, finalRestoreData, activeKey);
    }

    /**
     * 테이블 행 분리 및 커서 상태 강제 동기화
     */
    function handleTableLineInput(activeKey, selection, currentLine, currentState) {
        const { lineIndex, range, parentP } = selection;
        
        const tableChunk = currentLine.chunks.find(c => c.type === 'table');
        const tableEl = parentP.querySelector('.chunk-table'); // 실제 테이블 DOM
        
        if (!tableChunk || !tableEl) return;

        // 1. 입력된 텍스트 추출
        const inputText = getSafeTextFromRange(range);
        if (!inputText) return; 

        const nextState = [...currentState];
        const pureTableLine = EditorLineModel(currentLine.align, [tableChunk]);
        
        const newTextLine = EditorLineModel("left", [{ 
            type: 'text', 
            text: inputText, 
            style: { fontSize: "14px" } 
        }]);

        let targetLineIndex;

        // 💡 [해결책 1] 물리적 위치 비교 (comparePoint)
        // 결과가 1이면 테이블이 커서보다 뒤에 있음 -> 커서가 테이블 앞임
        const compareResult = range.comparePoint(tableEl, 0);
        const isBeforeTable = compareResult > 0;

        if (isBeforeTable) {
            nextState[lineIndex] = pureTableLine; 
            nextState.splice(lineIndex, 0, newTextLine); 
            targetLineIndex = lineIndex;
        } else {
            nextState[lineIndex] = pureTableLine; 
            nextState.splice(lineIndex + 1, 0, newTextLine); 
            targetLineIndex = lineIndex + 1;
        }

        // 2. 상태 저장
        state.saveEditorState(activeKey, nextState);

        // 💡 [해결책 2] 커서 상태 저장소(state) 강제 동기화
        // 히스토리와 커서 인덱스가 어긋나지 않도록 즉시 저장합니다.
        const restoreData = {
            containerId: activeKey,
            lineIndex: targetLineIndex,
            anchor: { chunkIndex: 0, offset: inputText.length },
            focus: { chunkIndex: 0, offset: inputText.length }
        };
        const finalRestoreData = normalizeCursorData(restoreData, activeKey);
        
        if (finalRestoreData) {
            state.saveCursorState(finalRestoreData); // 저장소 내부 커서 위치 갱신
        }

        // 3. UI 렌더링 및 DOM 커서 복구
        ui.render(nextState, activeKey);
        domSelection.restoreCursor(finalRestoreData);
    }

    /**
     * 현재 라인 상태와 DOM 정보를 비교하여 업데이트된 모델 생성
     */
    function calculateUpdate(currentLine, selection, activeKey) {
        const { dataIndex, activeNode, cursorOffset, lineIndex, container, range } = selection;
        let result = null;
        let flags = { isNewChunk: false, isChunkRendering: false };

        if (dataIndex !== null && activeNode && currentLine.chunks[dataIndex]?.type === 'text') {
            const safeText = getSafeTextFromRange(range);
            result = inputModelService.updateTextChunk(currentLine, dataIndex, safeText, cursorOffset, lineIndex, activeKey);
            flags.isChunkRendering = !!result;
        }

        if (!result) {
            const rebuild = ui.parseLineDOM(selection.parentP, currentLine.chunks, container, cursorOffset, lineIndex);
            if (rebuild.newChunks !== currentLine.chunks) {
                result = {
                    updatedLine: EditorLineModel(currentLine.align, rebuild.newChunks),
                    restoreData: { ...rebuild.restoreData, containerId: activeKey }
                };
                flags.isNewChunk = true;
            }
        }

        if (!result) return { flags: { hasChange: false } };
        return { ...result, flags: { ...flags, hasChange: true } };
    }
    
    /**
     * Range 객체로부터 안전하게 텍스트 노드 값을 추출
     */
    function getSafeTextFromRange(range) {
        if (!range) return '';
        const node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
            return node.nodeValue ?? '';
        }
        // 텍스트 노드가 아닐 경우(엘리먼트 노드 등) 전체 텍스트 추출 시도
        return node.textContent ?? '';
    }    

    /**
     * 상태 저장소에 최종 데이터 반영
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
     * 변경된 모델에 맞춰 UI 업데이트 실행
     */
    function executeRendering(updatedLine, lineIndex, flags, restoreData, targetKey) {
        if (flags.isNewChunk) {
            ui.renderLine(lineIndex, updatedLine, targetKey);
            if (restoreData) domSelection.restoreCursor(restoreData);
            return;
        }

        if (flags.isChunkRendering && restoreData) {
            const chunkIndex = restoreData.anchor.chunkIndex;
            const chunk = updatedLine.chunks[chunkIndex];

            if (!chunk || chunk.type !== 'text') {
                ui.renderLine(lineIndex, updatedLine, targetKey);
            } else {
                ui.renderChunk(lineIndex, chunkIndex, chunk, targetKey);
            }
            domSelection.restoreCursor(restoreData);
        }
    }

    return { processInput };
}
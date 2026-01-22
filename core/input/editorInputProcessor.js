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

        ui.ensureFirstLine(activeKey); 

        const currentState = state.getState(activeKey); 
        const currentLine = currentState[selection.lineIndex] || EditorLineModel();

        // 💡 1. 모델 업데이트 계산 (여기서 분리 로직을 처리합니다)
        const result = calculateUpdate(currentLine, selection, activeKey);

        if (!result || !result.flags?.hasChange || result.updatedLine === currentLine) return;

        // 💡 2. 만약 라인 분리가 필요하다면 (Table Split Case)
        if (result.isSplit) {
            handleSplitUpdate(activeKey, selection.lineIndex, result, currentState);
            return;
        }

        // 💡 3. 일반적인 업데이트 (Text Update or Rebuild Case)
        saveFinalState(activeKey, selection.lineIndex, result.updatedLine, result.restoreData);
        
        const finalRestoreData = normalizeCursorData(result.restoreData, activeKey);
        executeRendering(result.updatedLine, selection.lineIndex, result.flags, finalRestoreData, activeKey);
    }

    /**
     * 라인 분할(Split) 전용 처리 함수 - 엔터 로직과 동일한 증분 업데이트 방식
     */
    function handleSplitUpdate(activeKey, lineIndex, result, currentState) {
        const { separatedLines, restoreData } = result;

        // 1. 전체 상태 계산 및 저장
        const nextState = [...currentState];
        // 기존 1개 라인을 제거하고, 분할된 N개 라인을 그 자리에 삽입
        nextState.splice(lineIndex, 1, ...separatedLines);
        state.saveEditorState(activeKey, nextState);

        // 2. [핵심] 기존 DOM에서 재사용할 테이블들을 미리 확보
        const container = document.getElementById(activeKey);
        const originalLineEl = container?.querySelectorAll(':scope > .text-block')[lineIndex];
        // 분할 전 라인에 있던 모든 테이블 DOM을 모아둠
        const movingTablePool = originalLineEl 
            ? Array.from(originalLineEl.querySelectorAll('.chunk-table')) 
            : [];

        // 3. UI 증분 업데이트 실행
        // 첫 번째 분할 라인은 기존 위치(lineIndex)를 업데이트 (재사용)
        ui.renderLine(lineIndex, separatedLines[0], activeKey);

        // 두 번째 라인부터는 새 라인을 DOM에 삽입하고 렌더링
        for (let i = 1; i < separatedLines.length; i++) {
            const targetIdx = lineIndex + i;
            const lineData = separatedLines[i];
            
            // DOM 엘리먼트 생성 및 삽입
            ui.insertLine(targetIdx, lineData.align, activeKey);
            
            // 확보해둔 테이블 풀을 주입하여 렌더링 (이때 기존 테이블이 새 위치로 이동됨)
            // movingTablePool은 각 라인이 렌더링될 때 필요한 테이블을 앞에서부터 꺼내 씀
            ui.renderLine(targetIdx, lineData, activeKey, movingTablePool);
        }

        // 4. 커서 복구
        const finalRestoreData = normalizeCursorData(restoreData, activeKey);
        if (finalRestoreData) {
            domSelection.restoreCursor(finalRestoreData);
        }
    }

    /**
     * 모델 업데이트 로직
     */
    function calculateUpdate(currentLine, selection, activeKey) {
        const { dataIndex, activeNode, cursorOffset, lineIndex, container, range, parentDom } = selection;
        let result = null;
        let flags = { isNewChunk: false, isChunkRendering: false };

        // --- Case 1: 단순 텍스트 업데이트 (원본 로직 유지) ---
        if (dataIndex !== null && activeNode && currentLine.chunks[dataIndex]?.type === 'text') {
            const safeText = getSafeTextFromRange(range);
            result = inputModelService.updateTextChunk(currentLine, dataIndex, safeText, cursorOffset, lineIndex, activeKey);
            if (result) flags.isChunkRendering = true;
        }

        // --- Case 2: DOM Rebuild & Table Split ---
        if (!result) {
            const rebuild = ui.parseLineDOM(parentDom, currentLine.chunks, container, cursorOffset, lineIndex);

            // 💡 [핵심 추가] 테이블 분리가 필요한 상황인지 체크
            if (rebuild.shouldSplit) {
                const separatedLines = splitChunksByTable(rebuild.newChunks, currentLine.align);
                return {
                    isSplit: true,
                    separatedLines,
                    restoreData: { ...rebuild.restoreData, containerId: activeKey },
                    flags: { hasChange: true }
                };
            }

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
     * 청크 배열을 테이블 기준으로 여러 라인 모델로 분리
     */
    function splitChunksByTable(chunks, align) {
        const lines = [];
        let temp = [];
        chunks.forEach(chunk => {
            if (chunk.type === 'table') {
                if (temp.length > 0) lines.push(EditorLineModel(align, temp));
                lines.push(EditorLineModel(align, [chunk]));
                temp = [];
            } else {
                temp.push(chunk);
            }
        });
        if (temp.length > 0) lines.push(EditorLineModel(align, temp));
        return lines;
    }

    function getSafeTextFromRange(range) {
        if (!range) return '';
        const node = range.startContainer;
        return node.nodeType === Node.TEXT_NODE ? (node.nodeValue ?? '') : '';
    }

    function saveFinalState(key, lineIndex, updatedLine, restoreData) {
        const currentState = state.getState(key);
        const nextState = [...currentState];
        nextState[lineIndex] = updatedLine;
        state.saveEditorState(key, nextState);
        const normalized = normalizeCursorData(restoreData, key);
        if (normalized) state.saveCursorState(normalized);
    }

    function executeRendering(updatedLine, lineIndex, flags, restoreData, targetKey) {
        const container = document.getElementById(targetKey);
        const lineEl = container?.querySelectorAll(':scope > .text-block')[lineIndex];
        const tablePool = lineEl ? Array.from(lineEl.querySelectorAll('.chunk-table')) : null;

        if (flags.isNewChunk) {
            ui.renderLine(lineIndex, updatedLine, targetKey, tablePool);
            if (restoreData) domSelection.restoreCursor(restoreData);
        } else if (flags.isChunkRendering && restoreData) {
            const chunkIndex = restoreData.anchor.chunkIndex;
            const chunk = updatedLine.chunks[chunkIndex];
            if (!chunk || chunk.type !== 'text') {
                ui.renderLine(lineIndex, updatedLine, targetKey, tablePool);
            } else {
                ui.renderChunk(lineIndex, chunkIndex, chunk, targetKey);
            }
            domSelection.restoreCursor(restoreData);
        }
    }

    return { processInput };
}
import { EditorLineModel } from '../../model/editorLineModel.js';
import { inputModelService } from './inputModelService.js';
import { normalizeCursorData } from '../../utils/cursorUtils.js';

export function createEditorInputProcessor(state, ui, domSelection, defaultKey) {

    function processInput(skipRender = false) {
        const activeKey = domSelection.getActiveKey() || defaultKey;
        const selection = domSelection.getSelectionContext();
        
        if (!selection || selection.lineIndex < 0) return;

        ui.ensureFirstLine(activeKey); 

        const currentState = state.getState(activeKey); 
        const currentLine = currentState[selection.lineIndex] || EditorLineModel();

        // 1. 모델 업데이트 계산
        const result = calculateUpdate(currentLine, selection, activeKey);

        if (!result || !result.flags?.hasChange || result.updatedLine === currentLine) return;

        // 2. 라인 분리 처리
        if (result.isSplit) {
            handleSplitUpdate(activeKey, selection.lineIndex, result, currentState, skipRender);
            return;
        }

        // 3. 상태 저장 (텍스트 입력 중에도 항상 실행)
        saveFinalState(activeKey, selection.lineIndex, result.updatedLine, result.restoreData);
        
        // 4. 렌더링 실행 결정
        // skipRender가 true라면 (한글 입력 중 등) 여기서 중단
        if (skipRender) return;

        const finalRestoreData = normalizeCursorData(result.restoreData, activeKey);
        executeRendering(result.updatedLine, selection.lineIndex, result.flags, finalRestoreData, activeKey);
    }

    function handleSplitUpdate(activeKey, lineIndex, result, currentState, skipRender) {
        const { separatedLines, restoreData } = result;
        const nextState = [...currentState];
        nextState.splice(lineIndex, 1, ...separatedLines);
        state.saveEditorState(activeKey, nextState);

        if (skipRender) return;

        const container = document.getElementById(activeKey);
        const originalLineEl = container?.children[lineIndex];
        const movingTablePool = originalLineEl 
            ? Array.from(originalLineEl.querySelectorAll('.chunk-table')) 
            : [];

        ui.renderLine(lineIndex, separatedLines[0], activeKey);

        for (let i = 1; i < separatedLines.length; i++) {
            const targetIdx = lineIndex + i;
            const lineData = separatedLines[i];
            ui.insertLine(targetIdx, lineData.align, activeKey);
            ui.renderLine(targetIdx, lineData, activeKey, movingTablePool);
        }

        movingTablePool.length = 0; 
        const finalRestoreData = normalizeCursorData(restoreData, activeKey);
        if (finalRestoreData) domSelection.restoreCursor(finalRestoreData);
    }

    function calculateUpdate(currentLine, selection, activeKey) {
        const { dataIndex, activeNode, cursorOffset, lineIndex, container, range, parentDom } = selection;
        let result = null;
        let flags = { isNewChunk: false, isChunkRendering: false };

        if (dataIndex !== null && activeNode && currentLine.chunks[dataIndex]?.type === 'text') {
            const safeText = getSafeTextFromRange(range);
            result = inputModelService.updateTextChunk(currentLine, dataIndex, safeText, cursorOffset, lineIndex, activeKey);
            if (result) flags.isChunkRendering = true;
        }

        if (!result) {
            const rebuild = ui.parseLineDOM(parentDom, currentLine.chunks, container, cursorOffset, lineIndex);
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
        // 💡 [개선] container.children[lineIndex]가 더 빠르고 정확합니다.
        const lineEl = container?.children[lineIndex];
        
        // 💡💡 [핵심 방어 로직] 💡💡
        // 단순히 텍스트만 변경된 상황인데, 이미 화면(DOM)의 텍스트가 모델과 같다면 렌더링을 스킵합니다.
        // 이 처리가 없으면 브라우저의 커서와 에디터의 커서 복구 로직이 싸우면서 "요세하녕안"이 됩니다.
        if (flags.isChunkRendering && !flags.isNewChunk && restoreData) {
            const chunkIndex = restoreData.anchor.chunkIndex;
            const chunk = updatedLine.chunks[chunkIndex];
            const chunkEl = lineEl?.querySelector(`[data-index="${chunkIndex}"]`);
            
            // DOM 텍스트와 데이터가 이미 일치한다면 렌더링을 하지 않고 브라우저의 자연스러운 흐름에 맡깁니다.
            if (chunk && chunk.type === 'text' && chunkEl && chunkEl.textContent === chunk.text) {
                return;
            }
        }

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
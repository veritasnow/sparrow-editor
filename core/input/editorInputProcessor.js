import { EditorLineModel } from '../../model/editorLineModel.js';
import { inputModelService } from './inputModelService.js';
import { normalizeCursorData } from '../../utils/cursorUtils.js';

export function createEditorInputProcessor(state, ui, domSelection, defaultKey) {

    /**
     * [Main Entry] 입력 이벤트 발생 시 호출
     * @param {boolean} skipRender - true일 경우 일반 텍스트 렌더링을 스킵 (IME 대응)
     */
    function processInput(skipRender = false) {
        const activeKey = domSelection.getActiveKey() || defaultKey;
        const selection = domSelection.getSelectionContext();
        if (!selection || selection.lineIndex < 0) return;

        ui.ensureFirstLine(activeKey); 

        const currentState = state.getState(activeKey); 
        const currentLine = currentState[selection.lineIndex] || EditorLineModel();

        const result = calculateUpdate(currentLine, selection, activeKey);
        if (!result || !result.flags?.hasChange) return;

        // 🔥 [수정] 테이블 분리는 skipRender 여부와 상관없이 무조건 DOM을 쪼갭니다.
        // 그래야 글자 입력 시 즉시 라인이 나뉩니다.
        if (result.isSplit) {
            handleSplitUpdate(activeKey, selection.lineIndex, result, currentState); 
            return;
        }

        saveFinalState(activeKey, selection.lineIndex, result.updatedLine, result.restoreData);
        
        // 일반 텍스트 입력(분리X)인 경우에만 한글 조합 등을 고려해 렌더링 스킵
        if (skipRender) return;

        const finalRestoreData = normalizeCursorData(result.restoreData, activeKey);
        executeRendering(result.updatedLine, selection.lineIndex, result.flags, finalRestoreData, activeKey);
    }

    /**
     * 라인 분할(Split) 전용 처리 - DOM 구조를 물리적으로 쪼갬
     */
    function handleSplitUpdate(activeKey, lineIndex, result, currentState) {
        const { separatedLines, restoreData } = result;

        // 1. 모델 상태 업데이트
        const nextState = [...currentState];
        nextState.splice(lineIndex, 1, ...separatedLines);
        state.saveEditorState(activeKey, nextState);

        // 2. 물리적 DOM 분리 실행 (보내주신 HTML 구조를 만드는 핵심)
        const container = document.getElementById(activeKey);
        const originalLineEl = container?.children[lineIndex];
        
        // 테이블 소실 방지를 위한 Pool
        const movingTablePool = originalLineEl 
            ? Array.from(originalLineEl.querySelectorAll('.chunk-table')) 
            : [];

        // 첫 번째 라인 업데이트 (예: '냠' 또는 'ㅁ'이 들어있는 라인)
        ui.renderLine(lineIndex, separatedLines[0], activeKey);

        // 분리된 나머지 라인들 (예: 테이블 라인, 그 뒤의 빈 라인 등) 삽입 및 렌더링
        for (let i = 1; i < separatedLines.length; i++) {
            const targetIdx = lineIndex + i;
            const lineData = separatedLines[i];
            
            ui.insertLine(targetIdx, lineData.align, activeKey);
            ui.renderLine(targetIdx, lineData, activeKey, movingTablePool);
        }

        movingTablePool.length = 0; 

        // 3. 커서 복구
        const finalRestoreData = normalizeCursorData(restoreData, activeKey);
        if (finalRestoreData) {
            // RAF를 사용하여 브라우저가 새로 생성된 DOM 노드들을 완전히 인식한 후 커서를 잡게 함
            requestAnimationFrame(() => {
                domSelection.restoreCursor(finalRestoreData);
            });
        }
    }

    function calculateUpdate(currentLine, selection, activeKey) {
        const { dataIndex, activeNode, cursorOffset, lineIndex, container, range, parentDom } = selection;
        let result = null;
        let flags = { isNewChunk: false, isChunkRendering: false };

        // 현재 포커스된 노드가 텍스트 노드일 때
        if (activeNode && activeNode.nodeType === Node.TEXT_NODE) {
            // [최적화] 모델의 텍스트와 실제 DOM의 텍스트가 완벽히 같다면 아무것도 안 함 - 한번 더 검증할 것...!!
            if (currentLine.chunks[dataIndex]?.text === activeNode.textContent) {
                return { flags: { hasChange: false } }; 
            }
        }

        // Case 1: 단순 텍스트 업데이트
        if (dataIndex !== null && activeNode && currentLine.chunks[dataIndex]?.type === 'text') {
            const safeText = getSafeTextFromRange(range);
            result = inputModelService.updateTextChunk(currentLine, dataIndex, safeText, cursorOffset, lineIndex, activeKey);
            if (result) flags.isChunkRendering = true;
        }

        // Case 2: DOM Rebuild (구조 변경 감지)
        if (!result) {
            const rebuild = ui.parseLineDOM(parentDom, currentLine.chunks, container, cursorOffset, lineIndex);

            // 💡 테이블 분리가 감지된 경우 (shouldSplit)
            if (rebuild.shouldSplit) {
                const separatedLines = splitChunksByTable(rebuild.newChunks, currentLine.align);
                
                // 1. 테이블 청크의 위치를 가져옴
                const tableIndex = rebuild.newChunks.findIndex(chunk => chunk.type === 'table');
                const cursorChunkIndex = rebuild.restoreData.chunkIndex;

                // 2. 테이블 뒤에서 입력한 경우에만 lineIndex를 +1
                // separatedLines가 [테이블, 텍스트] 순서로 쪼개졌을 것이므로 텍스트는 다음 라인(Index+1)
                if (tableIndex !== -1 && cursorChunkIndex > tableIndex) {
                    rebuild.restoreData.lineIndex = rebuild.restoreData.lineIndex + 1;
                    // 테이블 뒤에 생긴 새 라인은 [텍스트]만 가지므로 chunkIndex는 0
                    rebuild.restoreData.chunkIndex = 0;
                } 

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

        console.log("calculateUpdate result:", result);

        if (!result) return { flags: { hasChange: false } };
        return { ...result, flags: { ...flags, hasChange: true } };
    }

    function splitChunksByTable(chunks, align) {
        const lines = [];
        let temp = [];

        const flushTemp = () => {
            if (temp.length > 0) {
                // ✨ [핵심] 인접한 텍스트 청크가 있다면 하나로 합침 (중복 방지)
                const mergedChunks = temp.reduce((acc, current) => {
                    const last = acc[acc.length - 1];
                    if (last && last.type === 'text' && current.type === 'text') {
                        // 스타일이 같다면 텍스트만 합침, 다르다면 현재 것을 우선시하거나 교체
                        // 여기서는 보통 뒤에 들어온 텍스트가 최신이므로 중복을 제거해야 함
                        // 만약 완전히 중복된 내용이 들어온다면 current만 유지
                        if (current.text.includes(last.text)) {
                            last.text = current.text; 
                        } else {
                            last.text += current.text;
                        }
                    } else {
                        acc.push(current);
                    }
                    return acc;
                }, []);
                
                lines.push(EditorLineModel(align, mergedChunks));
                temp = [];
            }
        };

        chunks.forEach(chunk => {
            if (chunk.type === 'table') {
                flushTemp();
                lines.push(EditorLineModel(align, [chunk]));
            } else {
                temp.push(chunk);
            }
        });
        
        flushTemp();
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
        const lineEl = container?.children[lineIndex];
        
        // 최적화: DOM 텍스트와 모델 텍스트가 이미 같다면 렌더링 스킵 (커서 튐 방지)
        if (flags.isChunkRendering && !flags.isNewChunk && restoreData) {
            const chunkIndex = restoreData.anchor.chunkIndex;
            const chunk = updatedLine.chunks[chunkIndex];
            const chunkEl = lineEl?.querySelector(`[data-index="${chunkIndex}"]`);
            if (chunk?.type === 'text' && chunkEl && chunkEl.textContent === chunk.text) {
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

    return { 
        processInput,
        // ✨ [수정] 외부(Enter 키 처리)에서 강제 동기화를 위해 노출
        syncInput: () => processInput(true) 
    };
}
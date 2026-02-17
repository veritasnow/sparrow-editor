import { EditorLineModel } from '../../model/editorLineModel.js';
import { inputModelService } from './inputModelService.js';
import { normalizeCursorData } from '../../utils/cursorUtils.js';

export function createEditorInputProcessor(stateAPI, uiAPI, selectionAPI, defaultKey) {

    /**
     * [Main Entry] 입력 이벤트 발생 시 호출
     */
    function processInput(skipRender = false) {
        const activeKey = selectionAPI.getActiveKey() || defaultKey;
        console.log("selectionAPI.getActiveKey()selectionAPI.getActiveKey() : ", selectionAPI.getActiveKey());
        const selection = selectionAPI.getSelectionContext();
        if (!selection || selection.lineIndex < 0) return;
        // 🔍 [로그 1] 현재 선택 영역이 어디를 가리키는지 확인
        console.group("🚩 Input Process Start");
        console.log("ActiveKey(Main):", activeKey);
        console.log("Selection Context:", {
            containerId: selection?.containerId, // 'list-xxx' 인지 확인
            lineIndex: selection?.lineIndex,     // 리스트 내부라면 0, 1, 2... 인지 확인
            dataIndex: selection?.dataIndex      // 몇 번째 텍스트 덩어리인지
        });
        uiAPI.ensureFirstLine(activeKey); 

        const currentState = stateAPI.get(activeKey); 
        const currentLine  = currentState[selection.lineIndex] || EditorLineModel();
        console.log("Current State From StateAPI:", currentState);
        console.log("Target Line Data:", currentState[selection.lineIndex]);
        const result = calculateUpdate(currentLine, selection, activeKey);
        if (!result || !result.flags.hasChange) {
            console.log("No Change Detected");
            console.groupEnd();
            return;
        }

        // 라인 분할(Split) 발생 시 처리
        if (result.isSplit) {
            handleSplitUpdate(activeKey, selection.lineIndex, result, currentState); 
            return;
        }

        // 결과 데이터에 컨테이너 정보 주입
        saveFinalState(activeKey, selection.lineIndex, result.updatedLine, result.restoreData);
        
        if (skipRender) return;

        // 7. 정규화된 커서 데이터 생성 및 렌더링 실행
        const finalRestoreData = normalizeCursorData(result.restoreData, activeKey);        
        executeRendering(result.updatedLine, selection.lineIndex, result.flags, finalRestoreData, activeKey);
    }

    /**
     * 라인 분할(Split) 전용 처리
     */
    function handleSplitUpdate(activeKey, lineIndex, result, currentState) {
        const { separatedLines, restoreData } = result;

        const nextState = [...currentState];
        nextState.splice(lineIndex, 1, ...separatedLines);
        stateAPI.save(activeKey, nextState);

        const container = document.getElementById(activeKey);
        // :scope를 사용하여 현재 에디터 레벨의 직계 자식만 타겟팅 (중첩 인덱스 방지)
        const originalLineEl = container?.querySelector(`:scope > [data-line-index="${lineIndex}"]`);
        
        const movingTablePool = originalLineEl 
            ? Array.from(originalLineEl.querySelectorAll('.chunk-table')) 
            : [];

        
        const isTableShifted = separatedLines[1]?.chunks[0]?.type === 'table';         
        if (isTableShifted) {
            // [CASE A] 테이블 앞에서 입력 (텍스트 + 테이블)
            
            // 1. 먼저 테이블(separatedLines[1])을 담을 새 라인을 기존 라인 "뒤"에 만듭니다.
            // (이 시점에서 syncLineIndexes가 호출되어 인덱스가 밀립니다)
            uiAPI.insertLineAfter(originalLineEl, lineIndex + 1, separatedLines[1].align, activeKey);

            // 2. 0번 데이터(텍스트)를 기존 라인(originalLineEl)에 렌더링합니다.
            // 이제 originalLineEl은 텍스트 라인이 됩니다.
            uiAPI.renderLine(lineIndex, separatedLines[0], { 
                key                 : activeKey, 
                shouldRenderTableSub: false 
            });

            // 3. 1번 데이터(테이블)를 방금 만든 새 라인(tableLineEl)에 렌더링합니다.
            uiAPI.renderLine(lineIndex + 1, separatedLines[1], { 
                key                 : activeKey, 
                pool                : movingTablePool, 
                shouldRenderTableSub: false 
            });
        } else {
            // [CASE] 테이블 뒤에서 입력 (테이블 + 텍스트)
            // 1. 기존 노드(테이블)는 0번 자리에 그대로 렌더링
            uiAPI.renderLine(lineIndex, separatedLines[0], { 
                key: activeKey, 
                pool: movingTablePool, 
                shouldRenderTableSub: false 
            });

            // 2. 새 텍스트(1번 데이터)를 기존 노드 "뒤"에 삽입
            uiAPI.insertLineAfter(originalLineEl, lineIndex + 1, separatedLines[1].align, activeKey);
            uiAPI.renderLine(lineIndex + 1, separatedLines[1], { 
                key: activeKey, 
                shouldRenderTableSub: false 
            });
        }
        movingTablePool.length = 0; 

        const finalRestoreData = normalizeCursorData(restoreData, activeKey);
        console.log("파이널 포커스...!!! : ", finalRestoreData);
        if (finalRestoreData) {
            // 새 DOM 노드가 안정화된 후 커서 복원
            requestAnimationFrame(() => {
                selectionAPI.restoreCursor(finalRestoreData);
            });
        }
    }

    /**
     * 업데이트 로직 계산
     */
    function calculateUpdate(currentLine, selection, activeKey) {
        const { dataIndex, activeNode, cursorOffset, lineIndex, container, range, parentDom } = selection;
        let result = null;
        let flags = { isNewChunk: false, isChunkRendering: false };

        if (activeNode && activeNode.nodeType === Node.TEXT_NODE) {
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
            const rebuild = uiAPI.parseLineDOM(parentDom, currentLine.chunks, container, cursorOffset, lineIndex);

            if (rebuild.shouldSplit) {
                const separatedLines = splitChunksByTable(rebuild.newChunks, currentLine.align);
                const tableIndex = rebuild.newChunks.findIndex(chunk => chunk.type === 'table');
                const cursorChunkIndex = rebuild.restoreData.chunkIndex;

                if (tableIndex !== -1 && cursorChunkIndex > tableIndex) {
                    rebuild.restoreData.lineIndex = rebuild.restoreData.lineIndex + 1;
                    rebuild.restoreData.chunkIndex = 0;
                } 

                return {
                    isSplit: true,
                    separatedLines,
                    restoreData: { ...rebuild.restoreData, containerId: selection.containerId || activeKey },
                    flags: { hasChange: true }
                };
            }

            if (rebuild.newChunks !== currentLine.chunks) {
                result = {
                    updatedLine: EditorLineModel(currentLine.align, rebuild.newChunks),
                    restoreData: { ...rebuild.restoreData, containerId: selection.containerId || activeKey }
                };
                flags.isNewChunk = true;
            }
        }

        if (!result) return { flags: { hasChange: false } };
        return { ...result, flags: { ...flags, hasChange: true } };
    }

    /**
     * 테이블 청크 기준 라인 분리
     */
    function splitChunksByTable(chunks, align) {
        const lines = [];
        let temp = [];

        const flushTemp = () => {
            if (temp.length > 0) {
                const mergedChunks = temp.reduce((acc, current) => {
                    const last = acc[acc.length - 1];
                    if (last && last.type === 'text' && current.type === 'text') {
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
        const currentState = stateAPI.get(key);
        const nextState = [...currentState];
        nextState[lineIndex] = updatedLine;
        stateAPI.save(key, nextState);
        const normalized = normalizeCursorData(restoreData, key);
        if (normalized) stateAPI.saveCursor(normalized);
    }

    /**
     * 최종 렌더링 실행
     */
    function executeRendering(updatedLine, lineIndex, flags, restoreData, targetKey) {
        // 복원 데이터의 컨테이너(에디터 혹은 TD)를 타겟으로 설정
        const targetContainerId = restoreData?.containerId || targetKey;
        const container = document.getElementById(targetContainerId);
        
        // 해당 컨테이너의 직계 자식 라인만 타겟팅
        const lineEl = container?.querySelector(`:scope > [data-line-index="${lineIndex}"]`);
        
        if (flags.isChunkRendering && !flags.isNewChunk && restoreData) {
            const chunkIndex = restoreData.anchor.chunkIndex;
            const chunk = updatedLine.chunks[chunkIndex];
            const chunkEl = lineEl?.querySelector(`:scope > [data-index="${chunkIndex}"]`);
            if (chunk?.type === 'text' && chunkEl && chunkEl.textContent === chunk.text) {
                return;
            }
        }

        const tablePool = lineEl ? Array.from(lineEl.querySelectorAll('.chunk-table')) : null;

        if (flags.isNewChunk) {
            uiAPI.renderLine(lineIndex, updatedLine, { 
                key: targetContainerId, 
                pool: tablePool, 
                shouldRenderTableSub: false 
            });
            if (restoreData) selectionAPI.restoreCursor(restoreData);
        } else if (flags.isChunkRendering && restoreData) {
            const chunkIndex = restoreData.anchor.chunkIndex;
            const chunk = updatedLine.chunks[chunkIndex];
            if (!chunk || chunk.type !== 'text') {
            uiAPI.renderLine(lineIndex, updatedLine, { 
                key: targetContainerId, 
                pool: tablePool, 
                shouldRenderTableSub: false 
            });
            } else {
                uiAPI.renderChunk(lineIndex, chunkIndex, chunk, targetContainerId);
            }
            selectionAPI.restoreCursor(restoreData);
        }
    }

    return { 
        processInput,
        syncInput: () => processInput(true) 
    };
}
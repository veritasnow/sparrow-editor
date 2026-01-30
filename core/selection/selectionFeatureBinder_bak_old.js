import { createAnalyzeService } from './selectionAnalyzeService.js';
import { createSelectionUIService } from './uiService.js';

export function bindSelectionFeature(stateAPI, uiAPI, editorEl, toolbarElements) {
    const selectionService = createAnalyzeService(stateAPI, uiAPI);
    const uiService = createSelectionUIService(toolbarElements);
    
    let dragAnchor = null; 
    let isDragging = false;
    let startTD = null;
    let rafId = null;
    let startY = 0;

    const scheduleUpdate = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            const result = selectionService.analyzeSelection();
            uiService.updateUI(result);
        });
    };

    const clearCellSelection = () => {
        editorEl.querySelectorAll('.se-table-cell').forEach(td => {
            td.classList.remove('is-selected', 'is-not-selected');
        });
    };

    /**
     * 🔥 핵심: setBaseAndExtent를 활용한 현대적 선택 영역 적용
     */
    function applyVisualAndRangeSelection(selectedCells, isForwardDrag) {
        if (selectedCells.length === 0) return;
        const table = selectedCells[0].closest('.se-table');
        if (!table) return;

        // 1. 시각적 클래스 부여 (CSS 기반 하이라이트)
        const allCellsInTable = table.querySelectorAll('.se-table-cell');
        allCellsInTable.forEach(td => {
            if (selectedCells.includes(td) && td.selectionStatus === 'skip-visual') {
                td.classList.remove('is-selected', 'is-not-selected');
                return;
            }
            if (selectedCells.includes(td)) {
                td.classList.add('is-selected');
                td.classList.remove('is-not-selected');
            } else {
                td.classList.remove('is-selected');
                td.classList.add('is-not-selected');
            }
        });

        // 2. 브라우저 네이티브 Selection 강제 지정
        const sel = window.getSelection();
        if (!dragAnchor) return;

        try {
            if (isForwardDrag) {
                // [정방향] 시작점(Anchor) -> 마지막 셀의 끝(Extent)
                const lastCell = selectedCells[selectedCells.length - 1];
                sel.setBaseAndExtent(
                    dragAnchor.node, dragAnchor.offset, 
                    lastCell, lastCell.childNodes.length
                );
            } else {
                // [역방향] 시작점(Anchor) -> 첫 번째 셀의 시작(Extent)
                // setBaseAndExtent는 시작점보다 앞쪽을 찍어도 블록이 깨지지 않음
                const firstCell = selectedCells[0];
                sel.setBaseAndExtent(
                    dragAnchor.node, dragAnchor.offset, 
                    firstCell, 0
                );
            }
        } catch (e) {
            console.warn("Selection 셋팅 실패:", e);
        }
    }

    // [이벤트 리스너 영역]

    // 에디터 외부 클릭 시 초기화
    document.addEventListener('mousedown', (e) => {
        const isInsideEditor = editorEl.contains(e.target);
        const isInsideToolbar = e.target.closest('.sparrow-toolbar');
        if (!isInsideEditor && !isInsideToolbar) {
            clearCellSelection();
        }
    });

    editorEl.addEventListener('mousedown', (e) => {
        const td = e.target.closest('.se-table-cell');
        
        if (!td || !e.shiftKey) {
            clearCellSelection();
        }

        if (td) {
            startTD = td;

            if (!isDragging) {
                startY = e.clientY; 
                
                // 닻(dragAnchor) 고정 - 하이브리드(표준+비표준) 추출
                let range = null;
                if (document.caretPositionFromPoint) {
                    const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
                    if (pos) {
                        range = document.createRange();
                        range.setStart(pos.offsetNode, pos.offset);
                    }
                } else if (document.caretRangeFromPoint) {
                    range = document.caretRangeFromPoint(e.clientX, e.clientY);
                }

                if (range) {
                    dragAnchor = { node: range.startContainer, offset: range.startOffset };
                } else {
                    const s = window.getSelection();
                    if (s.rangeCount > 0) {
                        const r = s.getRangeAt(0);
                        dragAnchor = { node: r.startContainer, offset: r.startOffset };
                    }
                }
            }
            isDragging = true;
        }
    });

    editorEl.addEventListener('mousemove', (e) => {
        if (!isDragging || !startTD) return;
        const currentTD = e.target.closest('.se-table-cell');
        const startTable = startTD.closest('.se-table');
        if (!startTable || !startTable.contains(e.target)) return;

        if (currentTD && currentTD !== startTD) {
            const cells = Array.from(startTable.querySelectorAll('.se-table-cell'));
            const startIndex = cells.indexOf(startTD);
            const endIndex = cells.indexOf(currentTD);
            const rangeIndices = [startIndex, endIndex].sort((a, b) => a - b);
            
            const selectedCells = cells.slice(rangeIndices[0], rangeIndices[1] + 1);
            const isForwardDrag = e.clientY > startY; 

            if (selectedCells.length > 0) {
                const firstCell = selectedCells[0];
                const firstMidName = firstCell.id.split('-')[1];
                const hasSameMidName = selectedCells.slice(1).some(td => td.id.split('-')[1] === firstMidName);

                selectedCells.forEach((td, idx) => {
                    // 정방향(아래로)일 때만 부모 텍스트 살리기 적용
                    if (isForwardDrag && idx === 0 && !hasSameMidName) {
                        td.selectionStatus = 'skip-visual'; 
                    } else {
                        td.selectionStatus = 'use-visual';
                    }
                });
            }
            
            applyVisualAndRangeSelection(selectedCells, isForwardDrag);
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) scheduleUpdate();
        uiAPI.refreshActiveKeys();
        isDragging = false;
        startTD = null;
        dragAnchor = null; 
    });

    // 브라우저 기본 드래그 방지
    editorEl.addEventListener('dragstart', (e) => e.preventDefault());
    editorEl.addEventListener('drop', (e) => e.preventDefault());

    // Selection 변경 시 셀 상태 동기화 (가드 로직 포함)
    document.addEventListener('selectionchange', () => {
        if (uiAPI.getIsRestoring()) {
            uiAPI.setIsRestoring(false); 
            return; 
        }

        if (isDragging) return;

        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        const range = sel.getRangeAt(0);

        if (editorEl.contains(range.startContainer)) {
            const containerCell = range.commonAncestorContainer.nodeType === 3 
                ? range.commonAncestorContainer.parentElement.closest('.se-table-cell')
                : range.commonAncestorContainer.closest?.('.se-table-cell');

            if (!containerCell) {
                // 멀티 셀 선택 상황
                const allTDs = editorEl.querySelectorAll('.se-table-cell');
                let hasCellInRange = false;

                for(let td of allTDs) {
                    if (td.classList.contains('is-not-selected')) continue;
                    if (sel.containsNode(td, true)) {
                        hasCellInRange = true;
                        break;
                    }
                }

                if (hasCellInRange) {
                    allTDs.forEach(td => {
                        const isInRange = sel.containsNode(td, true);
                        const isNotSelected = td.classList.contains('is-not-selected');

                        if (!isNotSelected) {
                            if (isInRange) td.classList.add('is-selected');
                            else td.classList.remove('is-selected');
                        }
                    });
                }
            } else {
                // 단일 셀 내부 선택 상황
                editorEl.querySelectorAll('.se-table-cell.is-selected').forEach(td => {
                    if (td !== containerCell) td.classList.remove('is-selected');
                });
            }
            
            scheduleUpdate();
        } else {
            if (document.querySelectorAll('.se-table-cell.is-selected').length === 0) {
                uiService.clearAll();
            }
        }
    });

    return {
        analyzeNow: () => {
            const result = selectionService.analyzeSelection();
            uiService.updateUI(result);
            return result;
        },
        clearTableSelection: clearCellSelection
    };
}
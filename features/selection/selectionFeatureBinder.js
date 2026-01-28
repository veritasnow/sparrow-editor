import { createSelectionAnalyzeService } from './selectionAnalyzeService.js';
import { createSelectionUIService } from './selectionUiService.js';

export function bindSelectionFeature(stateAPI, uiAPI, editorEl, toolbarElements) {
    const selectionService = createSelectionAnalyzeService(stateAPI, uiAPI);
    const uiService = createSelectionUIService(toolbarElements);

    let isDragging = false;
    let startTD = null;
    let rafId = null;

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

    function applyVisualAndRangeSelection(selectedCells) {
        if (selectedCells.length === 0) return;
        const table = selectedCells[0].closest('.se-table');
        if (!table) return;

        const allCellsInTable = table.querySelectorAll('.se-table-cell');
        allCellsInTable.forEach(td => {
            if (selectedCells.includes(td)) {
                td.classList.add('is-selected');
                td.classList.remove('is-not-selected');
            } else {
                td.classList.remove('is-selected');
                td.classList.add('is-not-selected');
            }
        });

        const sel = window.getSelection();
        const range = document.createRange();
        range.setStartBefore(selectedCells[0]);
        range.setEndAfter(selectedCells[selectedCells.length - 1]);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    // [이벤트 리스너 영역]

    document.addEventListener('mousedown', (e) => {
        const isInsideEditor = editorEl.contains(e.target);
        const isInsideToolbar = e.target.closest('.sparrow-toolbar');
        if (!isInsideEditor && !isInsideToolbar) {
            clearCellSelection();
        }
    });

    editorEl.addEventListener('mousedown', (e) => {
        const td = e.target.closest('.se-table-cell');
        // 클릭 시점에 모든 가드 클래스를 초기화하여 드래그 진입을 허용함
        if (!td || !e.shiftKey) {
            clearCellSelection();
        }
        if (td) {
            isDragging = true;
            startTD = td;
        }
    });

    editorEl.addEventListener('mousemove', (e) => {
        if (!isDragging || !startTD) return;
        const currentTD = e.target.closest('.se-table-cell');
        const startTable = startTD.closest('.se-table');
        if (!startTable) return;

        if (startTable.contains(e.target)) {
            if (currentTD && currentTD !== startTD) {
                const cells = Array.from(startTable.querySelectorAll('.se-table-cell'));
                const startIndex = cells.indexOf(startTD);
                const endIndex = cells.indexOf(currentTD);
                const rangeIndices = [startIndex, endIndex].sort((a, b) => a - b);
                const selectedCells = cells.slice(rangeIndices[0], rangeIndices[1] + 1);
                applyVisualAndRangeSelection(selectedCells);
            } else if (!currentTD) {
                const allCells = Array.from(startTable.querySelectorAll('.se-table-cell'));
                applyVisualAndRangeSelection(allCells);
            }
        } else {
            const allCells = Array.from(startTable.querySelectorAll('.se-table-cell'));
            applyVisualAndRangeSelection(allCells);
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) scheduleUpdate();
        isDragging = false;
        startTD = null;
    });

    editorEl.addEventListener('dragstart', (e) => e.preventDefault());
    editorEl.addEventListener('drop', (e) => e.preventDefault());

    document.addEventListener('selectionchange', () => {
        // 복구 중이거나 수동 드래그 중에는 기본 브라우저 로직(횡단 선택)을 타지 않음
        if (uiAPI.getIsRestoring() || isDragging) return;

        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        const range = sel.getRangeAt(0);

        if (editorEl.contains(range.startContainer)) {
            const containerCell = range.commonAncestorContainer.nodeType === 3 
                ? range.commonAncestorContainer.parentElement.closest('.se-table-cell')
                : range.commonAncestorContainer.closest?.('.se-table-cell');

            if (!containerCell) {
                // [멀티 블록/외부 진입 선택 상황]
                const allTDs = editorEl.querySelectorAll('.se-table-cell');
                let hasCellInRange = false;

                // 1단계: 영역 내에 유효한 셀이 있는지 검사 (가드 확인)
                for(let td of allTDs) {
                    if (td.classList.contains('is-not-selected')) continue;
                    if (sel.containsNode(td, true)) {
                        hasCellInRange = true;
                        break;
                    }
                }

                // 2단계: 유효한 선택이 있다면 클래스 업데이트
                if (hasCellInRange) {
                    allTDs.forEach(td => {
                        const isInRange = sel.containsNode(td, true);
                        const isNotSelected = td.classList.contains('is-not-selected');

                        if (!isNotSelected) {
                            if (isInRange) {
                                td.classList.add('is-selected');
                            } else {
                                td.classList.remove('is-selected');
                            }
                        }
                        // 이미 is-not-selected인 셀은 상태 변화를 주지 않아 복구 레이아웃 유지
                    });
                }
            } else {
                // [단일 셀 내부 선택 상황]
                editorEl.querySelectorAll('.se-table-cell.is-selected').forEach(td => {
                    if (td !== containerCell) td.classList.remove('is-selected');
                });
                // 커서가 있는 셀은 선택 상태 유지 (필요 시)
                // containerCell.classList.add('is-selected');
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
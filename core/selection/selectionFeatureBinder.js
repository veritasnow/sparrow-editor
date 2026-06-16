import { analyzeSelection } from './services/analyzeSelection.js';
import { createSelectionUI } from './services/createSelectionUI.js';
import { applyVisualAndRangeSelection } from './services/applyVisualAndRangeSelection.js';
import { calculateDragSelection } from './services/calculateDragSelection.js';
import { normalizeCursorData } from '../../utils/cursorUtils.js';

export function bindSelectionFeature(stateAPI, selectionAPI, editorEl, toolbarElements) {
    const selectionUi     = createSelectionUI(toolbarElements);

    let isDragging        = false;
    let startTD           = null;
    let rafId             = null;

    const scheduleUpdate = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            const result = analyzeSelection(stateAPI, selectionAPI);
            selectionUi.updateUI(result);
        });
    };

    const clearCellSelection = () => {
        editorEl.querySelectorAll('.se-table-cell').forEach(td => {
            td.classList.remove('is-selected', 'is-not-selected', 'is-dragging');
        });
    };

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
            isDragging = true;
        }
    });  

    editorEl.addEventListener('mousemove', (e) => {
        if (!isDragging || !startTD) return;

        // 1. 드래그 계산
        const { selectedCells, activeId } = calculateDragSelection(editorEl.id, startTD, e);

        // 2. selection normalize
        const domRanges  = selectionAPI.getDomSelection(activeId);
        const normalized = normalizeCursorData(domRanges, activeId);

        if (activeId !== selectionAPI.getMainKey()) {
            document
                .getElementById(activeId)
                ?.classList.add('is-dragging');
        }

        // 🔥 startTD 추가 전달
        applyVisualAndRangeSelection(
            selectedCells,
            normalized,
            stateAPI,
            editorEl.id,
            startTD
        );
    });

    window.addEventListener('mouseup', (e) => {

        if (isDragging) scheduleUpdate();
        selectionAPI.refreshActiveKeys();
        isDragging        = false;
        startTD           = null;
    });

    // 브라우저 기본 드래그 방지
    editorEl.addEventListener('dragstart', (e) => e.preventDefault());
    editorEl.addEventListener('drop', (e) => e.preventDefault());

    // Selection 변경 시 셀 상태 동기화 (가드 로직 포함)
    document.addEventListener('selectionchange', () => {
        if (selectionAPI.getIsRestoring()) {
            selectionAPI.setIsRestoring(false); 
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
                selectionUi.clearAll();
            }
        }
    });

    return {
        analyzeNow: () => {
            const result = analyzeSelection(stateAPI, selectionAPI);
            selectionUi.updateUI(result);
            return result;
        },
        clearTableSelection: clearCellSelection,
        isDragging: () => isDragging
    };
}
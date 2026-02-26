import { createAnalyzeService } from './service/analyzeService.js';
import { createSelectionUIService } from './service/selectionUiService.js';
import { createRangeService } from './service/rangeService.js';
import { createDragService } from './service/dragService.js';
import { normalizeCursorData } from '../../utils/cursorUtils.js';

export function bindSelectionFeature(stateAPI, selectionAPI, editorEl, toolbarElements) {
    const selectionService = createAnalyzeService(stateAPI, selectionAPI);
    const uiService        = createSelectionUIService(toolbarElements);
    const rangeService     = createRangeService();
    const dragService      = createDragService(editorEl.id);

    let isDragging        = false;
    let startTD           = null;
    let rafId             = null;

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
        // 1. 드래그 로직 계산 위임
        const { selectedCells, activeId } = dragService.mouseDragCalculate(e, startTD);

        // 2. 실시간 브라우저 Selection 데이터 획득 (UI API 사용)
        const domRanges  = selectionAPI.getDomSelection(activeId);
        const normalized = normalizeCursorData(domRanges, activeId);

        // 3. 시각화 호출 (Range 서비스 사용)
        rangeService.applyVisualAndRangeSelection(selectedCells, normalized, stateAPI, editorEl.id);
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
        clearTableSelection: clearCellSelection,
        isDragging: () => isDragging
    };
}
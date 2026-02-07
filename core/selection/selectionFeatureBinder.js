import { createAnalyzeService } from './service/binderSerivce/analyzeService.js';
import { createSelectionUIService } from './service/binderSerivce/selectionUiService.js';
import { createRangeService } from './service/binderSerivce/rangeService.js';
import { createDragService } from './service/binderSerivce/dragService.js';
import { normalizeCursorData } from '../../utils/cursorUtils.js';

export function bindSelectionFeature(stateAPI, selectionAPI, editorEl, virtualSelection, toolbarElements) {
    const selectionService = createAnalyzeService(stateAPI, selectionAPI);
    const uiService        = createSelectionUIService(toolbarElements);
    const rangeService     = createRangeService();
    const dragService      = createDragService(editorEl.id);

    let isDragging        = false;
    let startTD           = null;
    let rafId             = null;
    let isVirtualDragging = false;

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

    // 가상영역 저장용 마우스 다운
    editorEl.addEventListener('mousedown', (e) => {
        if (e.target.closest('.se-table-cell') && !e.shiftKey) return;

        isVirtualDragging = false; 
        const actualTarget = document.elementFromPoint(e.clientX, e.clientY);
        const lineEl = actualTarget?.closest('.text-block');
        
        if (!lineEl) return;

        const realLineIndex = parseInt(lineEl.dataset.lineIndex); // 0이 확실함
        const chunkEl = actualTarget.closest('.chunk-text');
        const realChunkIndex = chunkEl ? parseInt(chunkEl.dataset.chunkIndex) : 0;

        // 브라우저 Selection을 믿지 말고 직접 계산한 인덱스를 강제 주입
        virtualSelection.isActive = true;
        virtualSelection.anchor = {
            lineIndex : realLineIndex, // 👈 5번으로 튀는 걸 방지
            chunkIndex: realChunkIndex,
            offset    : 0, // mousedown 시점엔 보통 0 (혹은 정교한 계산 필요)
            type      : 'text'
        };
        virtualSelection.focus = { ...virtualSelection.anchor };
        isVirtualDragging      = true;
    });    

    editorEl.addEventListener('mousemove', (e) => {
        if (!isDragging || !startTD) return;
        // 1. 드래그 로직 계산 위임
        const { selectedCells, activeId } = dragService.mouseDragCalculate(e, startTD);

        // 2. 실시간 브라우저 Selection 데이터 획득 (UI API 사용)
        const domRanges  = selectionAPI.getDomSelection(activeId);
        const normalized = normalizeCursorData(domRanges, activeId);

        // 3. 시각화 호출 (Range 서비스 사용)
        rangeService.applyVisualAndRangeSelection(selectedCells, normalized);
    });

    window.addEventListener('mouseup', (e) => {
        if (isVirtualDragging) {
            const actualTarget = document.elementFromPoint(e.clientX, e.clientY);
            const lineEl       = actualTarget?.closest('.text-block');

            if (lineEl) {
                virtualSelection.focus.lineIndex = parseInt(lineEl.dataset.lineIndex);
            } else {
                // [보정] 만약 마우스가 에디터 아래로 나갔다면?
                const rect = editorEl.getBoundingClientRect();
                if (e.clientY > rect.bottom) {
                    // 현재 데이터상 가장 큰 인덱스나 마지막 라인 인덱스 주입 로직 필요
                    console.log("에디터 하단 이탈 - 마지막 라인 강제 지정");
                }
            }
        }

        console.log("virtualSelectionvirtualSelectionvirtualSelection : ", virtualSelection);

        if (isDragging) scheduleUpdate();
        selectionAPI.refreshActiveKeys();
        isDragging        = false;
        isVirtualDragging = false;
        startTD           = null;
    });

    // 가상 선택 영역
    editorEl.addEventListener('mousemove', (e) => {
        if (!isVirtualDragging) return;

        const targetEl = document.elementFromPoint(e.clientX, e.clientY);
        const lineEl   = targetEl?.closest('.text-block');
        
        // 💡 보정: 만약 lineEl을 못 찾았는데 마우스 Y좌표가 에디터 상단 근처라면?
        // 0번 라인으로 강제 인식하게 하는 로직이 필요할 수 있습니다.
        if (!lineEl) {
            const rect = editorEl.getBoundingClientRect();
            if (e.clientY <= rect.top) {
                virtualSelection.focus.lineIndex = 0; // 최상단으로 드래그 중
            }
            return;
        }

        const currentIdx = parseInt(lineEl.dataset.lineIndex);
        const sel        = window.getSelection();
        
        virtualSelection.focus.lineIndex = currentIdx;
        if (sel && sel.rangeCount > 0) {
            // focusNode가 현재 lineEl 안에 있는지 검증 후 오프셋 저장
            if (lineEl.contains(sel.focusNode)) {
                virtualSelection.focus.offset = sel.focusOffset;
            }
        }

        // 3. 방향 판정 (Anchor vs Focus 절대 비교)
        const a                = virtualSelection.anchor;
        const f                = virtualSelection.focus;
        const isBefore         = f.lineIndex < a.lineIndex;
        const isSameLineBefore = (f.lineIndex === a.lineIndex && f.offset < a.offset);
        
        virtualSelection.isBackwards = isBefore || isSameLineBefore;
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
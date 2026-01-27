import { createSelectionAnalyzeService } from './selectionAnalyzeService.js';
import { createSelectionUIService } from './selectionUiService.js';

export function bindSelectionFeature(stateAPI, uiAPI, editorEl, toolbarElements) {
    const selectionService = createSelectionAnalyzeService(stateAPI, uiAPI);
    const uiService = createSelectionUIService(toolbarElements);

    let isDragging = false;
    let startTD = null;
    let rafId = null;

    // [성능] RAF를 통한 UI 업데이트 스케줄링
    const scheduleUpdate = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            const result = selectionService.analyzeSelection();
            uiService.updateUI(result);
        });
    };

    // 🔥 [개선] 선택 해제 시 두 클래스를 모두 제거하여 논리 필터 초기화
    const clearCellSelection = () => {
        editorEl.querySelectorAll('.se-table-cell').forEach(td => {
            td.classList.remove('is-selected', 'is-not-selected');
        });
    };

    // 🔥 [개선] 테이블 내 드래그 시 선택되지 않은 셀은 is-not-selected 부여
    function applyVisualAndRangeSelection(selectedCells) {
        if (selectedCells.length === 0) return;

        const table = selectedCells[0].closest('.se-table');
        if (table) {
            const allTableCells = table.querySelectorAll('.se-table-cell');
            allTableCells.forEach(td => {
                if (selectedCells.includes(td)) {
                    td.classList.add('is-selected');
                    td.classList.remove('is-not-selected');
                } else {
                    td.classList.remove('is-selected');
                    td.classList.add('is-not-selected'); // 브라우저 하이라이트 무시용
                }
            });
        }

        const sel = window.getSelection();
        const range = document.createRange();
        // 선택된 셀들의 시작부터 끝까지 Range 설정
        range.setStartBefore(selectedCells[0]);
        range.setEndAfter(selectedCells[selectedCells.length - 1]);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    // 1. 전역 마우스 다운: 에디터 외부 클릭 시 초기화
    document.addEventListener('mousedown', (e) => {
        const isInsideEditor = editorEl.contains(e.target);
        const isInsideToolbar = e.target.closest('.sparrow-toolbar');
        if (!isInsideEditor && !isInsideToolbar) {
            clearCellSelection();
        }
    });

    // 2. 에디터 내부 마우스 다운: 셀 선택 시작
    editorEl.addEventListener('mousedown', (e) => {
        const td = e.target.closest('.se-table-cell');
        // Shift 키 없이 셀 클릭 시 혹은 빈 공간 클릭 시 기존 선택 초기화
        if (!td || !e.shiftKey) {
            clearCellSelection();
        }
        if (td) {
            isDragging = true;
            startTD = td;
        }
    });

    // 3. 드래그 중 (mousemove)
    editorEl.addEventListener('mousemove', (e) => {
        if (!isDragging || !startTD) return;

        const currentTD = e.target.closest('.se-table-cell');
        const startTable = startTD.closest('.se-table');
        if (!startTable) return;

        // 드래그 중인 테이블 내부/외부에 따른 처리
        const cells = Array.from(startTable.querySelectorAll('.se-table-cell'));
        const startIndex = cells.indexOf(startTD);
        
        // 테이블 밖으로 나가면 전체 선택, 안이면 범위 선택
        let selectedCells = [];
        if (startTable.contains(e.target) && currentTD) {
            const endIndex = cells.indexOf(currentTD);
            const [min, max] = [startIndex, endIndex].sort((a, b) => a - b);
            selectedCells = cells.slice(min, max + 1);
        } else {
            selectedCells = cells; // 테이블 경계를 벗어나면 해당 테이블 전체 선택
        }
        
        applyVisualAndRangeSelection(selectedCells);
    });

    // 4. 드래그 종료
    window.addEventListener('mouseup', () => {
        if (isDragging) {
            scheduleUpdate();
        }
        isDragging = false;
        startTD = null;
    });

    // 기본 드래그 앤 드롭 방지
    editorEl.addEventListener('dragstart', (e) => e.preventDefault());
    editorEl.addEventListener('drop', (e) => e.preventDefault());

    // 5. 선택 변경 감지 (일반 텍스트 드래그 및 셀 포괄 드래그 대응)
    document.addEventListener('selectionchange', () => {
        if (isDragging) return;

        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        if (!editorEl.contains(range.startContainer)) return;

        // 테이블 셀을 포함하는 드래그인지 정밀 분석
        const containerCell = range.commonAncestorContainer.nodeType === 3 
            ? range.commonAncestorContainer.parentElement.closest('.se-table-cell')
            : range.commonAncestorContainer.closest?.('.se-table-cell');

        // 셀 외부(부모 레벨)에서 드래그가 발생한 경우
        if (!containerCell) {
            const allTDs = editorEl.querySelectorAll('.se-table-cell');
            let hasCellInRange = false;

            for (let td of allTDs) {
                if (sel.containsNode(td, true)) {
                    hasCellInRange = true;
                    break;
                }
            }

            if (hasCellInRange) {
                allTDs.forEach(td => {
                    if (sel.containsNode(td, true)) {
                        td.classList.add('is-selected');
                        td.classList.remove('is-not-selected');
                    } else {
                        // 🔥 선택 영역에 걸치지 않은 셀은 명시적으로 제외 클래스 부여
                        td.classList.remove('is-selected');
                        td.classList.add('is-not-selected');
                    }
                });
            }
        }

        scheduleUpdate();
        
        // 선택이 완전히 해제된 경우 UI 클리어
        if (document.querySelectorAll('.se-table-cell.is-selected').length === 0 && 
            !editorEl.contains(sel.anchorNode)) {
            uiService.clearAll();
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
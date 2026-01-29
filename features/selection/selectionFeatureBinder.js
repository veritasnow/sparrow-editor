import { createSelectionAnalyzeService } from './selectionAnalyzeService.js';
import { createSelectionUIService } from './selectionUiService.js';
import { normalizeCursorData } from '../../utils/cursorUtils.js';

export function bindSelectionFeature(stateAPI, uiAPI, editorEl, toolbarElements) {
    const selectionService = createSelectionAnalyzeService(stateAPI, uiAPI);
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

    function applyVisualAndRangeSelection(selectedCells, isForwardDrag, normalized) {
        // 1. 먼저 같은 형제가 있는지 확인한다.
        //    형제가 있으면 유즈 비쥬얼, 없으면 스킵비쥬얼을 한다.

        console.log("selectedCells.length : ", selectedCells.length);
        console.log("selectedCells : ", selectedCells);

        if (selectedCells.length > 0) {
            const firstCell = selectedCells[0];
            const firstMidName = firstCell.id.split('-')[1];
            const hasSameMidName = selectedCells.slice(1).some(td => td.id.split('-')[1] === firstMidName);

            console.log("hasSameMidName : ", hasSameMidName);

            selectedCells.forEach((td, idx) => {
                // 정방향(아래로)일 때만 부모 텍스트 살리기 적용
                if (idx === 0 && !hasSameMidName) {
                    td.selectionStatus = 'skip-visual'; 
                } else {
                    td.selectionStatus = 'use-visual';
                }
            });
        } 

        const isSkipVisual = selectedCells[0].selectionStatus === "skip-visual";
       console.log("isSkipVisual : ", isSkipVisual);
 
        if(isSkipVisual) {
            // [핵심 로직] 단일 셀 내부 정밀 제어
            const targetTD = selectedCells[0];
            
            // 일단 해당 셀 자체는 블록이 아니므로 클래스 제거
            targetTD.classList.remove('is-selected', 'is-not-selected');

            if (normalized && normalized.ranges) {
                normalized.ranges.forEach(range => {
                    // 해당 라인이 테이블을 포함하고 있다면
                    if (range.isTableLine) {
                        // 해당 container(td) 안에서 해당 lineIndex를 가진 요소를 찾음
                        const lineEl = targetTD.querySelector(`[data-line-index="${range.lineIndex}"]`);
                        
                        if (lineEl) {
                            // 라인 자체가 테이블이거나, 내부에 테이블이 있는 경우 처리
                            const childTable = lineEl.matches('.se-table') ? lineEl : lineEl.querySelector('.se-table');
                            
                            if (childTable) {
                                // 테이블 내부의 모든 셀에 is-selected 적용
                                const subCells = childTable.querySelectorAll('.se-table-cell');
                                subCells.forEach(subCell => {
                                    subCell.classList.add('is-selected');
                                    subCell.classList.remove('is-not-selected');
                                });
                            }
                        }
                    }
                });
            }            
        } else {
            // 1. 현재 드래그 중인 레벨의 메인 테이블 찾기
            const table = selectedCells[0].closest('.se-table');
            if (!table) return;

            // 2. 해당 테이블의 모든 셀(직계)에 대해 상태 업데이트
            const allCellsInTable = table.querySelectorAll('.se-table-cell');
            
            allCellsInTable.forEach(td => {
                // [예외 가드] 해당 셀이 현재 테이블의 직계가 아니면 무시 (중첩 테이블 중복 처리 방지)
                if (td.closest('.se-table') !== table) return;

                // 선택 상태 결정
                const isTarget = selectedCells.includes(td);
                const shouldSkip = isTarget && td.selectionStatus === 'skip-visual';

                if (shouldSkip) {
                    // 텍스트 드래그 중인 셀은 블록 하이라이트 제거
                    td.classList.remove('is-selected', 'is-not-selected');
                } else if (isTarget) {
                    // [A] 부모 셀 선택
                    td.classList.add('is-selected');
                    td.classList.remove('is-not-selected');

                    // 🔥 [핵심] 부모가 선택되면 그 안의 모든 자식 테이블 셀들도 강제로 선택 처리
                    const nestedCells = td.querySelectorAll('.se-table-cell');
                    nestedCells.forEach(child => {
                        child.classList.add('is-selected');
                        child.classList.remove('is-not-selected');
                    });
                } else {
                    // [B] 선택되지 않은 셀은 비활성화
                    td.classList.remove('is-selected');
                    td.classList.add('is-not-selected');

                    // 부모가 해제되면 자식들도 해제
                    const nestedCells = td.querySelectorAll('.se-table-cell');
                    nestedCells.forEach(child => {
                        child.classList.remove('is-selected');
                        child.classList.add('is-not-selected');
                    });
                }
            });
        }
        // 2. skipVisual이라면 형제 td가 선택되지 않은 상태이다.



        console.log("selectedCells : ", selectedCells);
        console.log("normalized : ", normalized);




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

    // 1. Selection 정보를 통해 "진짜" 메인 컨테이너 ID 찾기
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    // commonAncestorContainer를 통해 현재 선택 영역을 아우르는 가장 가까운 부모를 찾음
    let commonParent = range.commonAncestorContainer;
    if (commonParent.nodeType === Node.TEXT_NODE) commonParent = commonParent.parentElement;

    // 가장 바깥쪽 editable 영역이나 TD를 찾음
    const mainContainer = commonParent.closest('.se-table-cell, .sparrow-contents');
    const activeId = mainContainer ? mainContainer.id : (startTD.id || 'myEditor-content');

    // 2. 드래그 범위 및 방향 계산
    const isForwardDrag = e.clientY > startY;
    
    // 💡 여기서 selectedCells는 '테이블 내부 드래그'일 때만 의미가 있으므로 가드를 칩니다.
    let selectedCells = [];
    const currentTD = e.target.closest('.se-table-cell');
    const startTable = startTD.closest('.se-table');

    if (currentTD && startTable && startTable.contains(currentTD)) {
        // 테이블 내부 셀 간 드래그인 경우
        const cells = Array.from(startTable.querySelectorAll('.se-table-cell'));
        const rangeIndices = [cells.indexOf(startTD), cells.indexOf(currentTD)].sort((a, b) => a - b);
        selectedCells = cells.slice(rangeIndices[0], rangeIndices[1] + 1);
    } else {
        // 💡 테이블을 벗어나 상위 영역으로 나간 경우
        const parentTD = e.target.closest('.se-table-cell'); // 마우스 아래에 있는 부모 TD를 찾음
        
        if (parentTD && parentTD !== startTD) {
            // 만약 마우스가 자식 테이블을 벗어나 '부모 TD' 영역에 도달했다면
            // 이제 드래그의 기준은 '부모 TD'를 포함한 상위 테이블이 되어야 함
            const parentTable = parentTD.closest('.se-table');
            
            if (parentTable) {
                const cells = Array.from(parentTable.querySelectorAll(':scope > tbody > tr > .se-table-cell, :scope > tr > .se-table-cell'));
                
                // startTD가 속한 '상위 TD'를 찾아서 범위를 잡음
                const effectiveStartTD = startTD.parentElement.closest('.se-table-cell') || startTD;
                const rangeIndices = [cells.indexOf(effectiveStartTD), cells.indexOf(parentTD)].sort((a, b) => a - b);
                
                selectedCells = cells.slice(rangeIndices[0], rangeIndices[1] + 1);
            } else {
                selectedCells = [startTD];
            }
        } else {
            // [케이스 2] TD가 없는 완전 밖(div)으로 나갔을 때
            const startTable = startTD.closest('.se-table');
            if (startTable) {
                // 시작한 테이블의 모든 직계 셀을 다 담아서 "전체 선택" 상태로 만듦
                selectedCells = Array.from(startTable.querySelectorAll(':scope > tbody > tr > .se-table-cell, :scope > tr > .se-table-cell'));
            } else {
                selectedCells = [startTD];
            }
        }
    }

    // 3. 실시간 브라우저 Selection 데이터 획득
    // 이제 activeId는 td일 수도 있고, 최상위 div(myEditor-content)일 수도 있음
    const domRanges = uiAPI.getDomSelection(activeId);
    const normalized = normalizeCursorData(domRanges, activeId);

    // 4. 시각화 호출
    applyVisualAndRangeSelection(selectedCells, isForwardDrag, normalized);
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
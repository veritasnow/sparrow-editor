import { createSelectionAnalyzeService } from './selectionAnalyzeService.js';
import { createSelectionUIService } from './selectionUiService.js';

export function bindSelectionFeature(stateAPI, uiAPI, editorEl, toolbarElements) {
    const selectionService = createSelectionAnalyzeService(stateAPI, uiAPI);
    const uiService = createSelectionUIService(toolbarElements);
    
    let dragAnchor = null; // 드래그 시작 위치를 저장할 변수
    let isDragging = false;
    let startTD = null;
    let rafId = null;
    let startY = 0;

    // 1. 키보드 방향키 이동 시에만 분석 실행
    /*
    editorEl.addEventListener('keyup', (e) => {
        const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (navKeys.includes(e.key)) {
            uiAPI.refreshActiveKeys(); // 위치 갱신
            scheduleUpdate(); // 툴바 스타일 분석 및 UI 업데이트
        }
    });
    */

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
            // [조건 추가] selectedCells에 들어있더라도 skip-visual 상태라면 클래스를 건드리지 않음
            if (selectedCells.includes(td) && td.selectionStatus === 'skip-visual') {
                td.classList.remove('is-selected', 'is-not-selected');
                return; // 다음 셀로 넘어감
            }

            if (selectedCells.includes(td)) {
                td.classList.add('is-selected');
                td.classList.remove('is-not-selected');
            } else {
                td.classList.remove('is-selected');
                td.classList.add('is-not-selected');
            }
        });

        console.log("dragAnchor : ", dragAnchor);

        const sel = window.getSelection();
        const range = document.createRange();
        // 핵심: 만약 부모 TD를 스킵해야 하는 상황(skip-visual)이고, 
        // 저장된 시작점(dragAnchor)이 있다면 그 위치를 그대로 시작점으로 사용합니다.
        if (selectedCells[0].selectionStatus === 'skip-visual' && dragAnchor) {
            console.log("설마여기???????????");
            try {
                // 브라우저가 기억하던 "텍스트 노드 내부의 정확한 위치"를 시작점으로 셋팅
                range.setStart(dragAnchor.node, dragAnchor.offset);
            } catch (e) {
                // 혹시 노드가 사라졌거나 에러나면 안전하게 이전 방식으로 후퇴
                range.setStartBefore(selectedCells[0]);
            }
        } else {
            // 일반적인 셀-to-셀 드래그일 때는 셀 기준으로 잡음
            range.setStartBefore(selectedCells[0]);
        }

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
        
        if (!td || !e.shiftKey) {
            clearCellSelection();
        }

        if (td) {
            startTD = td;

            // 드래그 시작 시점에 딱 한 번만 실행
            if (!isDragging) {
                startY = e.clientY; // 방향 판별용 기준 Y좌표

                // 닻(dragAnchor) 고정: 하이브리드 로직 시작
                if (dragAnchor === null) {
                    let range = null;

                    // 1. 표준 방식 시도 (Firefox 등 최신 표준)
                    if (document.caretPositionFromPoint) {
                        const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
                        if (pos) {
                            range = document.createRange();
                            range.setStart(pos.offsetNode, pos.offset);
                        }
                    } 
                    // 2. 비표준이지만 사실상 표준 (Chrome, Edge, Safari)
                    else if (document.caretRangeFromPoint) {
                        range = document.caretRangeFromPoint(e.clientX, e.clientY);
                    }
                    // 3. Firefox 레거시 (일부 구형 대응용)
                    else if (e.rangeParent) {
                        range = document.createRange();
                        range.setStart(e.rangeParent, e.rangeOffset);
                    }

                    if (range) {
                        dragAnchor = {
                            node: range.startContainer,
                            offset: range.startOffset
                        };
                        console.log("🎯 하이브리드 좌표 고정:", dragAnchor.offset, dragAnchor.node);
                    } else {
                        // 4. 폴백: 모든 좌표 계산 실패 시 Selection에서 가져오기
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0) {
                            const r = sel.getRangeAt(0);
                            dragAnchor = { node: r.startContainer, offset: r.startOffset };
                        }
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
        if (!startTable) return;

        if (startTable.contains(e.target)) {
            if (currentTD && currentTD !== startTD) {
                const cells = Array.from(startTable.querySelectorAll('.se-table-cell'));
                const startIndex = cells.indexOf(startTD);
                const endIndex = cells.indexOf(currentTD);
                const rangeIndices = [startIndex, endIndex].sort((a, b) => a - b);
                
                // 1. 일단 범위 내 셀들을 가져옴
                const selectedCells = cells.slice(rangeIndices[0], rangeIndices[1] + 1);

                // 🔥 드래그 방향 판별: 시작 인덱스가 종료 인덱스보다 작아야 위에서 아래로 가는 것
                const isForwardDrag = e.clientY > startY;            
                console.log("startIndex : ", startIndex);
                console.log("endIndex : ", endIndex);


                // 2. 부모 판별 및 상태(status) 부여
                if (selectedCells.length > 0) {
                    const firstCell = selectedCells[0];
                    const firstMidName = firstCell.id.split('-')[1]; // 0번의 미들네임

                    // 나머지 셀들 중 0번과 미들네임이 같은 게 하나라도 있는지 확인
                    const hasSameMidName = selectedCells.slice(1).some(td => td.id.split('-')[1] === firstMidName);

                    // 모든 셀 상태 초기화 및 부여
                    selectedCells.forEach((td, idx) => {
                        if (isForwardDrag && idx === 0 && !hasSameMidName) {
                            // 0번인데 동족이 없다? -> "너는 부모다"
                            td.selectionStatus = 'skip-visual'; 
                        } else {
                            // 그 외 나머지는 정상 선택
                            td.selectionStatus = 'use-visual';
                        }
                    });
                }
                
                console.log("selectedCells with status: ", selectedCells);
                applyVisualAndRangeSelection(selectedCells);

            } else if (!currentTD) {
                // (생략 가능하지만 기존 로직 유지)
                const allCells = Array.from(startTable.querySelectorAll('.se-table-cell'));
                allCells.forEach(td => td.selectionStatus = 'use-visual');
                applyVisualAndRangeSelection(allCells);
            }
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) scheduleUpdate();
        uiAPI.refreshActiveKeys();
        isDragging = false;
        startTD = null;
        dragAnchor = null; // 다음 드래그를 위해 비워줌
    });

    editorEl.addEventListener('dragstart', (e) => e.preventDefault());
    editorEl.addEventListener('drop', (e) => e.preventDefault());

    document.addEventListener('selectionchange', () => {
        // 복구 중이거나 수동 드래그 중에는 기본 브라우저 로직(횡단 선택)을 타지 않음
        console.log("uiAPI.getIsRestoring() : ", uiAPI.getIsRestoring());
        // 1. 복구 중인지 확인
        if (uiAPI.getIsRestoring()) {
            console.log("복구 완료 감지 - 가드 해제");
            
            // 2. 여기서 플래그를 꺼버림으로써 특정 타이머에 의존하지 않음
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
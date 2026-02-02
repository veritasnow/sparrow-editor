import { createAnalyzeService } from './service/binderSerivce/analyzeService.js';
import { createSelectionUIService } from './service/binderSerivce/selectionUiService.js';
import { createRangeService } from './service/binderSerivce/rangeService.js';
import { createDragService } from './service/binderSerivce/dragService.js';
import { normalizeCursorData } from '../../utils/cursorUtils.js';

export function bindSelectionFeature(stateAPI, selectionAPI, editorEl, toolbarElements) {
    const selectionService = createAnalyzeService(stateAPI, selectionAPI);
    const uiService        = createSelectionUIService(toolbarElements);
    const rangeService     = createRangeService();
    const dragService      = createDragService(editorEl.id);

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
        rangeService.applyVisualAndRangeSelection(selectedCells, normalized);
    });

    /*
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
        const activeId = mainContainer ? mainContainer.id : (startTD.id || editorEl.id);
        
        // 💡 여기서 selectedCells는 '테이블 내부 드래그'일 때만 의미가 있으므로 가드를 칩니다.
        let selectedCells = [];
        const currentTD = e.target.closest('.se-table-cell');
        const startTable = startTD.closest('.se-table');

        if (currentTD && startTable && startTable.contains(currentTD)) {
            console.log("0번일까???????????????????????????????");            
            // 테이블 내부 셀 간 드래그인 경우
            const cells = Array.from(startTable.querySelectorAll('.se-table-cell'));
            const rangeIndices = [cells.indexOf(startTD), cells.indexOf(currentTD)].sort((a, b) => a - b);
            selectedCells = cells.slice(rangeIndices[0], rangeIndices[1] + 1);
        } else {
            // 💡 테이블을 벗어나 상위 영역으로 나간 경우
            const parentTD = e.target.closest('.se-table-cell'); // 마우스 아래에 있는 부모 TD를 찾음
            
            if (parentTD && parentTD !== startTD) {
                console.log("1번일까???????????????????????????????");
                console.log("parentTD : ", parentTD);

                // 만약 마우스가 자식 테이블을 벗어나 '부모 TD' 영역에 도달했다면
                // 이제 드래그의 기준은 '부모 TD'를 포함한 상위 테이블이 되어야 함
                const parentTable = parentTD.closest('.se-table');
                console.log("parentTable : ", parentTable);
                

                if (parentTable) {
                    console.log("1번의 부모테이블일까?");
                    
                    // 1. 할아버지 테이블(parentTable)의 직계 자식 셀들만 가져오기
                    const cells = Array.from(parentTable.querySelectorAll(':scope > tbody > tr > .se-table-cell, :scope > tr > .se-table-cell, :scope > tr > td.se-table-cell'));
                    
                    // 2. 손자(startTD)로부터 할아버지 테이블의 '직계 아들(TD)'을 찾을 때까지 추적
                    let currentAncestor = startTD;
                    let effectiveStartTD = null;

                    while (currentAncestor && currentAncestor !== parentTable) {
                        // 현재 검사 중인 요소가 할아버지 테이블의 직계 TD 리스트에 있는지 확인
                        if (cells.includes(currentAncestor)) {
                            effectiveStartTD = currentAncestor;
                            break;
                        }
                        // 없으면 한 단계 더 부모로 이동
                        currentAncestor = currentAncestor.parentElement;
                    }

                    // 3. 인덱스 계산
                    const startIdx = cells.indexOf(effectiveStartTD);
                    const endIdx = cells.indexOf(parentTD);

                    console.log("최종 매칭 결과 - effectiveStartTD:", effectiveStartTD);
                    console.log("최종 인덱스 - startIdx:", startIdx, "endIdx:", endIdx);

                    if (startIdx !== -1 && endIdx !== -1) {
                        const rangeIndices = [startIdx, endIdx].sort((a, b) => a - b);
                        selectedCells = cells.slice(rangeIndices[0], rangeIndices[1] + 1);
                    } else {
                        // 만약 못 찾으면 안전하게 시작 셀이라도 반환
                        console.warn("직계 TD를 찾지 못했습니다.");
                        selectedCells = [startTD];
                    }
                } else {
                    console.log("1번의 부모테이블이 아닐까?");
                    selectedCells = [startTD];
                }
            } else {
                // [케이스 2] TD가 없는 완전 밖(div)으로 나갔을 때
                const startTable = startTD.closest('.se-table');
                if (startTable) {
                    console.log("2번일까???????????????????????????????");

                    // 시작한 테이블의 모든 직계 셀을 다 담아서 "전체 선택" 상태로 만듦
                    selectedCells = Array.from(startTable.querySelectorAll(':scope > tbody > tr > .se-table-cell, :scope > tr > .se-table-cell'));
                } else {
                    console.log("2-2번일까???????????????????????????????");

                    selectedCells = [startTD];
                }
            }
        }

        // 3. 실시간 브라우저 Selection 데이터 획득
        // 이제 activeId는 td일 수도 있고, 최상위 div(myEditor-content)일 수도 있음
        const domRanges = uiAPI.getDomSelection(activeId);
        const normalized = normalizeCursorData(domRanges, activeId);

        // 4. 시각화 호출
        rangeService.applyVisualAndRangeSelection(selectedCells, normalized);
    });
    */

    window.addEventListener('mouseup', () => {
        if (isDragging) scheduleUpdate();
        selectionAPI.refreshActiveKeys();
        isDragging = false;
        startTD = null;
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
        clearTableSelection: clearCellSelection
    };
}
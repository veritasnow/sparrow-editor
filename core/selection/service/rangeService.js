/**
 * 활성 컨테이너(ID) 추출 및 분석 서비스
 */
export function createRangeService() {
    function applyVisualAndRangeSelection(selectedCells, normalized, stateAPI, rootId) {
        if (!selectedCells || selectedCells.length === 0) return;

        let newSelectedCells = [];
        const rootContainer = document.getElementById(normalized.containerId);
        if (!rootContainer) return;

        // [1] 데이터 수집 (여러 라인 선택 시)
        if (normalized.ranges && normalized.ranges.length > 1) {
            const startLine   = normalized.ranges[0].lineIndex;
            const endLine     = normalized.ranges[normalized.ranges.length - 1].lineIndex;
            const targetLines = stateAPI.getLineRange(startLine, endLine, normalized.containerId);
            
            // 2. 재귀 호출 (stateAPI를 함께 넘겨서 내부 셀들도 조회하며 수집)
            const finalSelectedIds = new Set();
            collectAllCellIdsFromState(targetLines, finalSelectedIds, stateAPI);
            newSelectedCells = mapIdsToCells(finalSelectedIds, selectedCells, rootContainer);
 
        } else {
            //newSelectedCells = [...selectedCells];
            const startLine = normalized.ranges[0].lineIndex;
            const lineData  = stateAPI.getLineRange(startLine, startLine, normalized.containerId);
            if(lineData[0].chunks[0].type === 'table') {
                // 1. 새로운 집합 생성 (원본 유지)
                const allCollectedIds = new Set();
                // 2. 한 번의 루프로 본인 ID + 자식 ID 수집
                selectedCells.forEach(cell => {
                    // 본인 ID 추가
                    allCollectedIds.add(cell.id);
                    // 자식들 탐색 (조회만 수행)
                    const innerLines = stateAPI.get(cell.id);
                    if (innerLines && innerLines.length > 0) {
                        collectAllCellIdsFromState(innerLines, allCollectedIds, stateAPI);
                    }
                });
                // 3. 수집된 ID들을 바탕으로 새로운 배열 생성
                newSelectedCells = mapIdsToCells(allCollectedIds, selectedCells, rootContainer);
            } else {
                newSelectedCells = [...selectedCells];
            }
        }
        console.log("newSelectedCellsnewSelectedCells : ", newSelectedCells);

        // 셀판정
        const isMultiSelection = checkIsMultiSelection(newSelectedCells);

        newSelectedCells.forEach((td, idx) => {
            // 여러 개가 잡혔다면 무조건 'use-visual', 딱 하나면 'skip-visual'
            td.selectionStatus = (idx === 0 && !isMultiSelection) ? 'skip-visual' : 'use-visual';
        });

        const isSkipVisual = newSelectedCells[0].selectionStatus === "skip-visual";

        // [3] 전체 초기화 (Global Cleanup)
        const mainRootContainer = document.getElementById(rootId);
        mainRootContainer?.querySelectorAll('.se-table-cell').forEach(td => {
            td.classList.remove('is-selected', 'is-not-selected');
        });

        if (isSkipVisual) {
            // 단일 셀 모드
            applySingleSelectionVisuals(normalized.ranges, rootContainer);
        } else {
            // 선택된 모든 테이블 루프
            // newSelectedCells가 속한 모든 테이블을 찾음
            applyMultiSelectionVisuals(newSelectedCells);
        }
    }    

    // ID 셋을 받아 실제 TD 엘리먼트 배열로 변환
    function mapIdsToCells(idSet, selectedCells, rootContainer) {
        return Array.from(idSet).map(id => {
            const existing = selectedCells.find(cell => cell.id === id);
            const targetTd = existing || rootContainer.querySelector(`#${id}`);
            return targetTd;
        }).filter(Boolean);
    }    

    // 멀티 선택 여부 판정
    function checkIsMultiSelection(cells) {
        // 복수 테이블/셀 판정 로직
        // 판정 기준 변경: 
        // 1. midName 종류가 2개 이상이다 (여러 테이블이 잡혔다)
        // 2. 혹은 같은 midName 내에 여러 셀이 있다
        if (cells.length <= 1) return false;
        
        const firstCellId = cells[0].id;
        const firstTableId = firstCellId.split('-')[1];
        
        // 1. 테이블 ID(midName)가 다른 게 하나라도 섞여 있거나
        // 2. 같은 테이블 내에서 다른 셀이 더 선택되어 있거나
        // 모든 셀의 midName을 수집하여 유일한 테이블 ID들 추출
        const midNames = new Set(cells.map(td => td.id.split('-')[1]));
        const hasDifferentTable = midNames.size > 1;
        const hasMoreCellsInSameTable = cells.some((td, idx) => 
            idx !== 0 && td.id.split('-')[1] === firstTableId
        );

        return hasDifferentTable || hasMoreCellsInSameTable;
    }

    // 단일 셀 선택 시 시각적 처리 (기존 로직 그대로)
    function applySingleSelectionVisuals(ranges, rootContainer) {
        ranges.forEach(range => {
            if (range.isTableLine) {
                const lineEl = rootContainer.querySelector(`[data-line-index="${range.lineIndex}"]`);
                if (lineEl) {
                    const childTable = lineEl.matches('.se-table') ? lineEl : lineEl.querySelector('.se-table');
                    if (childTable) {
                        childTable.querySelectorAll('.se-table-cell').forEach(subCell => {
                            subCell.classList.add('is-selected');
                            subCell.classList.remove('is-not-selected');
                        });
                    }
                }
            }
        });
    }

    // 복수 셀 선택 시 시각적 처리 (기존 로직 그대로)
    function applyMultiSelectionVisuals(newSelectedCells) {
        const targetTables = new Set();
        newSelectedCells.forEach(td => {
            const table = td.closest('.se-table');
            if (table) targetTables.add(table);
        });

        targetTables.forEach(table => {
            const allCellsInTable = table.querySelectorAll('.se-table-cell');
            allCellsInTable.forEach(td => {
                if (td.closest('.se-table') !== table) return; // 중첩 테이블 방어

                const isTarget = newSelectedCells.some(selected => selected.id === td.id);
                if (isTarget) {
                    td.classList.add('is-selected');
                    td.classList.remove('is-not-selected');
                } else {
                    td.classList.remove('is-selected');
                    td.classList.add('is-not-selected');
                }
            });
        });
    }    
    function collectAllCellIdsFromState(lines, idSet, stateAPI) {
        if (!lines || !Array.isArray(lines)) return;

        lines.forEach(line => {
            // 라인 내에 chunks가 없으면 스킵
            if (!line.chunks || !Array.isArray(line.chunks)) return;

            line.chunks.forEach(chunk => {
                // chunk가 테이블인 경우에만 셀 ID 수집 및 내부 탐색
                if (chunk.type === 'table' && chunk.data) {
                    chunk.data.forEach(row => {
                        row.forEach(cell => {
                            // 1. 이미 수집한 ID면 무한 루프 방지를 위해 패스
                            if (idSet.has(cell.id)) return;

                            // 2. 셀 ID 저장
                            idSet.add(cell.id);

                            // 3. ★ 핵심 수정: stateAPI.get(cell.id)의 결과가 바로 'lines' 배열임
                            const innerLines = stateAPI.get(cell.id); 
                            
                            // 4. 가져온 게 배열이고 내용이 있다면, 그 배열을 그대로 들고 다시 재귀
                            if (innerLines && Array.isArray(innerLines) && innerLines.length > 0) {
                                collectAllCellIdsFromState(innerLines, idSet, stateAPI);
                            }
                        });
                    });
                }
            });
        });
    }
    return { applyVisualAndRangeSelection };
}

/*
리팩토링 전 코드...!!!! 선택범위 영역 정확도 많이 상승함...
export function createRangeService() {
    function applyVisualAndRangeSelection(selectedCells, normalized, stateAPI, rootId) {
        if (!selectedCells || selectedCells.length === 0) return;

        const finalSelectedIds = new Set();
        let newSelectedCells = [];
        const rootContainer = document.getElementById(normalized.containerId);
        if (!rootContainer) return;

        // [1] 데이터 수집 (여러 라인 선택 시)
        if (normalized.ranges && normalized.ranges.length > 1) {
            const startLine = normalized.ranges[0].lineIndex;
            const endLine = normalized.ranges[normalized.ranges.length - 1].lineIndex;
            const targetLines = stateAPI.getLineRange(startLine, endLine, normalized.containerId);
            console.log("targetLinestargetLinestargetLines : ", targetLines);
            
            //collectAllCellIdsFromState(targetLines, finalSelectedIds);
            // 2. 재귀 호출 (stateAPI를 함께 넘겨서 내부 셀들도 조회하며 수집)
            collectAllCellIdsFromState(targetLines, finalSelectedIds, stateAPI);
            
            newSelectedCells = Array.from(finalSelectedIds).map(id => {
                const existing = selectedCells.find(cell => cell.id === id);
                const targetTd = existing || rootContainer.querySelector(`#${id}`);
                if (targetTd) {
                    targetTd.classList.add('is-selected');
                    targetTd.classList.remove('is-not-selected');
                }
                return targetTd;
            }).filter(Boolean);      
        } else {
            // 여기 이대로 하면 안됨 무조건 해당 행이 테이블인지 아닌지 비교후 처리해야함 -> 테이블이면 재귀고 아니면 재귀 x

            //newSelectedCells = [...selectedCells];
            // 1. 새로운 집합 생성 (원본 유지)
            const allCollectedIds = new Set();
            
            // 2. 한 번의 루프로 본인 ID + 자식 ID 수집
            selectedCells.forEach(cell => {
                // 본인 ID 추가
                allCollectedIds.add(cell.id);
                
                // 자식들 탐색 (조회만 수행)
                const innerLines = stateAPI.get(cell.id);
                if (innerLines && innerLines.length > 0) {
                    collectAllCellIdsFromState(innerLines, allCollectedIds, stateAPI);
                }
            });

            // 3. 수집된 ID들을 바탕으로 새로운 배열 생성
            newSelectedCells = Array.from(allCollectedIds).map(id => {
                const existing = selectedCells.find(c => c.id === id);
                const targetTd = existing || rootContainer.querySelector(`#${id}`);
                
                if (targetTd) {
                    targetTd.classList.add('is-selected');
                    targetTd.classList.remove('is-not-selected');
                }
                return targetTd;
            }).filter(Boolean);

            console.log("원본은 그대로, 결과만 새로 생성됨:", newSelectedCells);
        }

        console.log("newSelectedCellsnewSelectedCells : ", newSelectedCells);

        // [2] 핵심 수정: 복수 테이블/셀 판정 로직
        const firstCell = newSelectedCells[0];
        // 모든 셀의 midName을 수집하여 유일한 테이블 ID들 추출
        const midNames = new Set(newSelectedCells.map(td => td.id.split('-')[1]));
        
        // 판정 기준 변경: 
        // 1. midName 종류가 2개 이상이다 (여러 테이블이 잡혔다)
        // 2. 혹은 같은 midName 내에 여러 셀이 있다
        const isMultiSelection = midNames.size > 1 || 
            newSelectedCells.some((td, idx) => idx !== 0 && td.id.split('-')[1] === firstCell.id.split('-')[1]);

        newSelectedCells.forEach((td, idx) => {
            // 여러 개가 잡혔다면 무조건 'use-visual', 딱 하나면 'skip-visual'
            td.selectionStatus = (idx === 0 && !isMultiSelection) ? 'skip-visual' : 'use-visual';
        });

        const isSkipVisual = firstCell.selectionStatus === "skip-visual";

        // [3] 공통 초기화
        const mainRootContainer = document.getElementById(rootId);
        const allCellsInRoot = mainRootContainer.querySelectorAll('.se-table-cell');
        allCellsInRoot.forEach(td => td.classList.remove('is-selected', 'is-not-selected'));

        if (isSkipVisual) {
            // 단일 셀 모드: 기존 로직 유지
            firstCell.classList.remove('is-selected', 'is-not-selected');
            normalized.ranges.forEach(range => {
                if (range.isTableLine) {
                    const lineEl = rootContainer.querySelector(`[data-line-index="${range.lineIndex}"]`);
                    if (lineEl) {
                        const childTable = lineEl.matches('.se-table') ? lineEl : lineEl.querySelector('.se-table');
                        if (childTable) {
                            childTable.querySelectorAll('.se-table-cell').forEach(subCell => {
                                subCell.classList.add('is-selected');
                                subCell.classList.remove('is-not-selected');
                            });
                        }
                    }
                }
            });
        } else {
            // [4] 핵심 수정: 선택된 모든 테이블 루프
            // newSelectedCells가 속한 모든 테이블을 찾음
            const targetTables = new Set();
            newSelectedCells.forEach(td => {
                const table = td.closest('.se-table');
                if (table) targetTables.add(table);
            });

            // 찾은 모든 테이블을 순회하며 클래스 입히기
            targetTables.forEach(table => {
                const allCellsInTable = table.querySelectorAll('.se-table-cell');
                allCellsInTable.forEach(td => {
                    // 중첩 테이블 방어
                    if (td.closest('.se-table') !== table) return;

                    const isTarget = newSelectedCells.some(selected => selected.id === td.id);

                    if (isTarget) {
                        td.classList.add('is-selected');
                        td.classList.remove('is-not-selected');
                    } else {
                        td.classList.remove('is-selected');
                        td.classList.add('is-not-selected');
                    }
                });
            });
        }
    }    

    function collectAllCellIdsFromState(lines, idSet, stateAPI) {
        if (!lines || !Array.isArray(lines)) return;

        lines.forEach(line => {
            // 라인 내에 chunks가 없으면 스킵
            if (!line.chunks || !Array.isArray(line.chunks)) return;

            line.chunks.forEach(chunk => {
                // chunk가 테이블인 경우에만 셀 ID 수집 및 내부 탐색
                if (chunk.type === 'table' && chunk.data) {
                    chunk.data.forEach(row => {
                        row.forEach(cell => {
                            // 1. 이미 수집한 ID면 무한 루프 방지를 위해 패스
                            if (idSet.has(cell.id)) return;

                            // 2. 셀 ID 저장
                            idSet.add(cell.id);

                            // 3. ★ 핵심 수정: stateAPI.get(cell.id)의 결과가 바로 'lines' 배열임
                            const innerLines = stateAPI.get(cell.id); 
                            
                            // 4. 가져온 게 배열이고 내용이 있다면, 그 배열을 그대로 들고 다시 재귀
                            if (innerLines && Array.isArray(innerLines) && innerLines.length > 0) {
                                collectAllCellIdsFromState(innerLines, idSet, stateAPI);
                            }
                        });
                    });
                }
            });
        });
    }
    return { applyVisualAndRangeSelection };
}
*/


/*
버그가 있긴한데 임시 백업
export function createRangeService() {
    
    function applyVisualAndRangeSelection(selectedCells, normalized) {
        // 1. 먼저 같은 형제가 있는지 확인한다.
        //    형제가 있으면 유즈 비쥬얼, 없으면 스킵비쥬얼을 한다.
        if (!selectedCells || selectedCells.length === 0) {
            return; 
        }

        if (selectedCells.length > 0) {
            const firstCell = selectedCells[0];
            const firstMidName = firstCell.id.split('-')[1];
            const hasSameMidName = selectedCells.slice(1).some(td => td.id.split('-')[1] === firstMidName);

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
        console.log("Is Skip Visual:", isSkipVisual);
        console.log("Selected Cells Count:", selectedCells.length);
        console.table(normalized.ranges);
        if(isSkipVisual) {
            const targetTD = selectedCells[0];
            targetTD.classList.remove('is-selected', 'is-not-selected');

            if (normalized && normalized.ranges) {
                normalized.ranges.forEach(range => {
                    if (range.isTableLine) {
                        // 🔥 [수정] :scope > 를 사용하여 targetTD의 직계 자식 라인만 탐색
                        // 이렇게 해야 중첩된 테이블 내부의 라인을 건드리지 않습니다.
                        const lineEl = targetTD.querySelector(`:scope > [data-line-index="${range.lineIndex}"]`);
                        
                        if (lineEl) {
                            // 라인 자체가 테이블이거나, 내부에 테이블이 있는 경우
                            // .se-table 역시 직계 자식인 경우만 찾도록 제한하는 것이 안전합니다.
                            const childTable = lineEl.matches('.se-table') ? lineEl : lineEl.querySelector(':scope > .se-table');
                            
                            if (childTable) {
                                // 테이블 내부의 모든 셀에 is-selected 적용
                                // (이 부분은 하위의 모든 셀을 잡는 것이 의도라면 유지, 
                                // 직계 셀만 잡는 것이 의도라면 :scope 활용)
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
            console.log("Current Processing Table ID:", table?.id);
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
    }

    return { applyVisualAndRangeSelection };
}
*/
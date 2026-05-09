import { findParentTdFromTable, findParentTableFromTd } from "../utils/selectionUtils.js";
/**
 * 활성 컨테이너(ID) 추출 및 분석 서비스
 */
export function createRangeService() {
    function applyVisualAndRangeSelection(selectedCells, normalized, stateAPI, rootId, startTD) {

        console.log('========== RANGE START ==========');

        console.log(
            'INPUT selectedCells :',
            selectedCells.map(td => td?.id)
        );

        console.log(
            'normalized :',
            normalized
        );
        
        if (!selectedCells || selectedCells.length === 0) return;

        let newSelectedCells = [];
        const rootContainer  = document.getElementById(normalized.containerId);
        if (!rootContainer) return;

        // [1] 데이터 수집 (여러 라인 선택 시)
        if (normalized.ranges && normalized.ranges.length > 1) {
            const startLine   = normalized.ranges[0].lineIndex;
            const endLine     = normalized.ranges[normalized.ranges.length - 1].lineIndex;
            const targetLines = stateAPI.getLineRange(startLine, endLine, normalized.containerId);
            
            // 2. 재귀 호출 (stateAPI를 함께 넘겨서 내부 셀들도 조회하며 수집)
            const finalSelectedIds = new Set();
            collectAllCellIdsFromState(targetLines, finalSelectedIds, stateAPI);
            console.log(
                'finalSelectedIds :',
                [...finalSelectedIds]
            );
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

                    if (!cell?.id) {
                        return;
                    }

                    // 자기 자신
                    allCollectedIds.add(cell.id);

                    // =====================================
                    // 🔥 부모 td chain 전체 수집
                    // =====================================

                    let currentTable = cell.closest('.se-table');

                    while (currentTable) {

                        console.log('CURRENT TABLE :', currentTable.id);

                        // const parentTd = currentTable.parentElement?.closest('.se-table-cell');
                        const parentTd = findParentTdFromTable(currentTable);

                        console.log(
                            'PARENT TD :',
                            parentTd?.id
                        );

                        if (!parentTd?.id) {
                            break;
                        }

                        allCollectedIds.add(parentTd.id);

                        currentTable =
                            parentTd.parentElement?.closest('.se-table');

                        console.log(
                            'NEXT TABLE :',
                            currentTable?.id
                        );
                    }
                });
                // =========================================
                // 🔥 핵심 수정 부분
                // 기존:
                // startTD 하나만 재귀 탐색
                //
                // 변경:
                // 선택된 모든 셀 재귀 탐색
                // =========================================

                selectedCells.forEach(cell => {

                    const innerLines = stateAPI.get(cell.id);

                    if (
                        innerLines &&
                        Array.isArray(innerLines) &&
                        innerLines.length > 0
                    ) {

                        collectAllCellIdsFromState(
                            innerLines,
                            allCollectedIds,
                            stateAPI
                        );
                    }
                });
                console.log(
                    'allCollectedIds :',
                    [...allCollectedIds]
                );                
                // 3. 수집된 ID들을 바탕으로 새로운 배열 생성
                newSelectedCells = mapIdsToCells(allCollectedIds, selectedCells, rootContainer);
            } else {
                newSelectedCells = [...selectedCells];
            }
        }

        console.log(
            'BEFORE MULTI CHECK :',
            newSelectedCells.map(td => td.id)
        );        

        // 셀판정
        const isMultiSelection = checkIsMultiSelection(newSelectedCells);

        newSelectedCells.forEach((td, idx) => {
            // 여러 개가 잡혔다면 무조건 'use-visual', 딱 하나면 'skip-visual'
            td.selectionStatus = (idx === 0 && !isMultiSelection) ? 'skip-visual' : 'use-visual';
        });

        if(newSelectedCells.length > 0) {
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
    }    

    // ID 셋을 받아 실제 TD 엘리먼트 배열로 변환
    function mapIdsToCells(idSet, selectedCells) {

        const result = [];

        idSet.forEach(id => {

            if (!id) {
                return;
            }

            // 이미 있는 셀 우선
            const existing = selectedCells.find(
                cell => cell?.id === id
            );

            if (existing) {
                result.push(existing);
                return;
            }

            // 🔥 rootContainer 사용 금지
            const targetTd = document.getElementById(id);

            if (targetTd) {
                result.push(targetTd);
            }
        });

        return result;
    }

    // 멀티 선택 여부 판정
    function checkIsMultiSelection(cells) {
        
        if (!cells || cells.length <= 1) return false;

        const safeCells = cells.filter(td => td && td.id);
        if (safeCells.length <= 1) return false;

        const firstCellId = safeCells[0].id;
        const firstTableId = firstCellId.split('-')[1];

        const midNames = new Set(
            safeCells.map(td => td.id.split('-')[1])
        );

        const hasDifferentTable = midNames.size > 1;
        const hasMoreCellsInSameTable = safeCells.some((td, idx) => 
            idx !== 0 && td.id.split('-')[1] === firstTableId
        );

        console.log({
            firstTableId,
            midNames: [...midNames],
            hasDifferentTable,
            hasMoreCellsInSameTable
        });        

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

        const targetTables = new Map();

        newSelectedCells.forEach(td => {

            if (!td) {
                return;
            }

            let currentTd = td;
            let currentTable =
                currentTd.closest('.se-table');

            while (currentTable) {

                console.log(
                    'VISUAL TABLE :',
                    currentTable.id
                );

                if (!targetTables.has(currentTable)) {
                    targetTables.set(currentTable, []);
                }

                targetTables.get(currentTable).push(currentTd);

                // const parentTd = currentTable.parentElement?.closest('.se-table-cell');
                const parentTd = findParentTdFromTable(currentTable);

                console.log(
                    'VISUAL PARENT TD :',
                    parentTd?.id
                );

                if (!parentTd) {
                    break;
                }

                currentTd = parentTd;

                currentTable = parentTd.parentElement?.closest('.se-table');
            }
        });

        targetTables.forEach((selectedInTable, table) => {

            const allCellsInTable = Array.from(
                table.querySelectorAll(
                    ':scope > tbody > tr > .se-table-cell, \
                    :scope > tr > .se-table-cell'
                )
            );

            allCellsInTable.forEach(td => {

                const isTarget = selectedInTable.some(
                    selected => selected?.id === td.id
                );

                td.classList.toggle('is-selected', isTarget);
                td.classList.toggle('is-not-selected', !isTarget);
            });
        });
    }
    function collectAllCellIdsFromState(lines, idSet, stateAPI) {
        if (!lines || !Array.isArray(lines)) return;

        lines.forEach(line => {
            if (!line?.chunks || !Array.isArray(line.chunks)) return;

            line.chunks.forEach(chunk => {
                if (chunk.type !== 'table' || !Array.isArray(chunk.data)) return;

                chunk.data.forEach(row => {
                    if (!Array.isArray(row)) return;

                    row.forEach(cell => {
                        // 🔥 1. 병합 placeholder (null) 방어
                        if (!cell || !cell.id) return;

                        // 🔥 2. 이미 수집된 셀 스킵 (무한 재귀 방지)
                        if (idSet.has(cell.id)) return;

                        // 🔥 3. 셀 ID 저장
                        idSet.add(cell.id);

                        // 🔥 4. 셀 내부 컨테이너 재귀 탐색 (너 구조 핵심)
                        const innerLines = stateAPI.get(cell.id);

                        if (
                            innerLines &&
                            Array.isArray(innerLines) &&
                            innerLines.length > 0
                        ) {
                            collectAllCellIdsFromState(innerLines, idSet, stateAPI);
                        }
                    });
                });
            });
        });
    }
    return { applyVisualAndRangeSelection };
}
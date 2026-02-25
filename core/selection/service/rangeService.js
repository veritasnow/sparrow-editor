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
    function mapIdsToCells(idSet, selectedCells, rootContainer) {
        const result = [];

        idSet.forEach(id => {
            if (!id) return;

            // 1️⃣ 이미 선택된 셀 우선 (가장 안전)
            const existing = selectedCells.find(cell => cell && cell.id === id);
            if (existing) {
                result.push(existing);
                return;
            }

            // 2️⃣ DOM에서 탐색 (병합으로 없을 수도 있음)
            const targetTd = rootContainer.querySelector(`#${id}`);
            if (targetTd) {
                result.push(targetTd);
            }
            // 🔥 없으면 그냥 스킵 (병합된 유령 셀)
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
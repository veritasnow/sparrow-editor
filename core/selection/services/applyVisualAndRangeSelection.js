/**
 * 활성 컨테이너(ID) 추출 및 분석 서비스
 */
export function applyVisualAndRangeSelection(selectedCells, normalized, stateAPI, rootId) {
    if (!selectedCells || selectedCells.length === 0) return;

    let newSelectedCells = [];
    const rootContainer = document.getElementById(normalized.containerId);
    if (!rootContainer) return;

    // 🚩 [수정] 다시 자식 ID들을 수집합니다. (자식들도 파란색은 되어야 하니까요)
    const allCollectedIds = new Set();
    
    // 드래그 중인 메인 셀들과 그 안의 모든 자식 ID 수집
    selectedCells.forEach(cell => {
        allCollectedIds.add(cell.id);
        const innerLines = stateAPI.get(cell.id);
        if (innerLines && innerLines.length > 0) {
            collectAllCellIdsFromState(innerLines, allCollectedIds, stateAPI);
        }
    });
    
    newSelectedCells = mapIdsToCells(allCollectedIds, selectedCells, rootContainer);

    // 🚩 [핵심] 멀티 선택 판정은 '수집된 전체'가 아니라 '원래 선택된(부모 레벨)' 셀들로만 합니다.
    // 그래야 자식들이 수집되었다고 해서 부모 테이블 전체가 어두워지지 않습니다.
    const isMultiSelection = checkIsMultiSelection(selectedCells); 

    newSelectedCells.forEach((td, idx) => {
        td.selectionStatus = (idx === 0 && !isMultiSelection) ? 'skip-visual' : 'use-visual';
    });

    if(newSelectedCells.length > 0) {
        const isSkipVisual = newSelectedCells[0].selectionStatus === "skip-visual";
        const mainRootContainer = document.getElementById(rootId);
        
        mainRootContainer?.querySelectorAll('.se-table-cell').forEach(td => {
            td.classList.remove('is-selected', 'is-not-selected');
        });

        if (isSkipVisual) {
            applySingleSelectionVisuals(normalized.ranges, rootContainer);
        } else {
            // 🚩 전체 수집된 셀(자식 포함)을 넘기되,
            // 로직 내부에서 '누가 어두워질지' 똑똑하게 판단하게 합니다.
            applyMultiSelectionVisuals(newSelectedCells, selectedCells);
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

    const tableCounts = {};
    cells.forEach(td => {
        const table = td.closest('.se-table');
        if (table) {
            const tid = table.id;
            tableCounts[tid] = (tableCounts[tid] || 0) + 1;
        }
    });
    
    const result = Object.values(tableCounts).some(count => count > 1);
    
    return result;
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
function applyMultiSelectionVisuals(allCollectedCells, originalSelectedCells) {
    // 1. 모든 셀에서 클래스 초기화 (이미 상위에서 수행됨)
    
    // 2. originalSelectedCells(부모 레벨)에 포함된 셀들은 무조건 is-selected
    originalSelectedCells.forEach(td => {
        td.classList.add('is-selected');
        // 부모 셀 내부의 모든 하위 셀들도 시각적으로 선택 표시
        td.querySelectorAll('.se-table-cell').forEach(child => {
            child.classList.add('is-selected');
            child.classList.remove('is-not-selected');
        });
    });

    // 3. 같은 테이블 내의 선택되지 않은 형제 셀들은 is-not-selected 처리
    const tablesToProcess = new Set();
    originalSelectedCells.forEach(td => {
        const t = td.closest('.se-table');
        if (t) tablesToProcess.add(t);
    });

    tablesToProcess.forEach(table => {
        const directCells = Array.from(table.querySelectorAll(':scope > tbody > tr > .se-table-cell, :scope > tr > .se-table-cell'));
        directCells.forEach(td => {
            const isDirectlySelected = originalSelectedCells.some(sel => sel.id === td.id);
            if (!isDirectlySelected) {
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
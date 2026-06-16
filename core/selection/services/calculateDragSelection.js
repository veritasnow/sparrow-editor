/**
 * 테이블 및 텍스트 드래그 시 선택 영역과 활성 컨테이너를 계산하는 서비스
 * ✔ rowspan + colspan 혼합 드래그 완전 대응
 * ✔ 세로 병합 셀 누락 버그 해결
 */
export function calculateDragSelection(defaultRootId, startTD, e) {
    
    if (!startTD) return { selectedCells: [], activeId: null };

    const activeId      = resolveActiveId(startTD, defaultRootId);
    const selectedCells = calculateSelectedCells(e, startTD, defaultRootId);

    return { selectedCells, activeId };
}


/**
 * [내부] 브라우저 Selection을 기반으로 실제 작업 중인 컨테이너 ID 추출
 */
function resolveActiveId(startTD, defaultRootId) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return startTD.id || defaultRootId;

    const range = sel.getRangeAt(0);
    let commonParent = range.commonAncestorContainer;

    if (commonParent.nodeType === Node.TEXT_NODE) {
        commonParent = commonParent.parentElement;
    }

    const mainContainer = commonParent.closest('.se-table-cell, .sparrow-contents');
    return mainContainer ? mainContainer.id : (startTD.id || defaultRootId);
}

/**
 * [내부] 마우스 위치에 따른 최종 선택 셀 배열 결정
 */
function calculateSelectedCells(e, startTD, defaultRootId) {
    let targetEl = e.target;
    
    // 1. 마우스 아래의 요소가 셀이 아니라면 elementFromPoint로 재탐색
    if (!targetEl.closest?.('.se-table-cell')) {
        const hit = document.elementFromPoint(e.clientX, e.clientY);
        if (hit) targetEl = hit;
    }

    const currentTD = targetEl.closest('.se-table-cell');
    const startTable = startTD.closest('.se-table');
    
    // 시작점이 테이블이 아니면 단일 셀 반환 (방어 코드)
    if (!startTable) return [startTD];

    // CASE 0: 마우스가 셀이 아닌 텍스트 영역 등에 있을 때 (currentTD 없음)
    if (!currentTD) {
        return [startTD]; 
    }

    // CASE 1: 동일 테이블 내부 드래그 (자식 테이블 포함)
    // 마우스가 위치한 곳이 시작 테이블의 안쪽이라면 기존 그리드 계산 수행
    if (startTable.contains(currentTD)) {
        const effectiveEndTD = findDirectCellOfTable(startTable, currentTD);
        return getGridCellRange(startTable, startTD, effectiveEndTD);
    }

    // CASE 2: 완전히 다른 테이블 간의 드래그 혹은 부모 테이블로의 드래그
    // 두 셀의 공통 조상 테이블을 찾거나, 없으면 에디터 루트를 기준으로 범위를 잡음
    const commonAncestor = findCommonAncestor(startTD, currentTD, defaultRootId);
    
    if (commonAncestor) {
        // 공통 조상이 테이블인 경우 (중첩 테이블 관계)
        if (commonAncestor.classList.contains('se-table')) {
            const effectiveStart = findDirectCellOfTable(commonAncestor, startTD);
            const effectiveEnd = findDirectCellOfTable(commonAncestor, currentTD);
            return getGridCellRange(commonAncestor, effectiveStart, effectiveEnd);
        } 
        
        // 공통 조상이 에디터 루트인 경우 (형제 테이블 간 드래그)
        // 두 테이블 사이의 모든 요소를 훑어 셀을 수집
        return getCrossTableCells(commonAncestor, startTD, currentTD);
    }

    return [startTD];
}

/**
 * [유틸] 두 요소의 공통 조상을 찾음 (가장 가까운 .se-table 혹은 .sparrow-contents)
 */
function findCommonAncestor(node1, node2, defaultRootId) {
    let p = node1.parentElement;
    while (p) {
        if (p.contains(node2)) {
            // 테이블이거나 최상위 컨테이너면 반환
            if (p.classList.contains('se-table') || p.classList.contains('sparrow-contents')) {
                return p;
            }
        }
        p = p.parentElement;
    }
    return document.getElementById(defaultRootId);
}

/**
 * [유틸] 서로 다른 테이블 간 드래그 시 범위 내 모든 셀 수집
 */
function getCrossTableCells(root, startNode, endNode) {
    const allElements = Array.from(root.querySelectorAll('.se-table, .se-table-cell'));
    const startTable = startNode.closest('.se-table');
    const endTable = endNode.closest('.se-table');
    
    let startIndex = allElements.indexOf(startTable);
    let endIndex = allElements.indexOf(endTable);

    if (startIndex === -1 || endIndex === -1) return [startNode];

    const [minIdx, maxIdx] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];
    const resultCells = [];
    
    // 인덱스 범위 내의 모든 요소를 순회하며 셀 추출
    const elementsInRange = allElements.slice(minIdx, maxIdx + 1);
    
    elementsInRange.forEach(el => {
        if (el.classList.contains('se-table-cell')) {
            resultCells.push(el);
        } else if (el.classList.contains('se-table')) {
            // 테이블인 경우 그 내부의 모든 직계 셀 추가
            const cells = el.querySelectorAll(':scope > tbody > tr > .se-table-cell, :scope > tr > .se-table-cell');
            resultCells.push(...Array.from(cells));
        }
    });

    // 중복 제거
    return Array.from(new Set(resultCells));
}

/**
 * [추가 유틸] 특정 테이블의 직계 TD를 찾을 때까지 거슬러 올라감
 */
function findDirectCellOfTable(table, node) {
    let current = node;
    while (current && current.parentElement) {
        if (current.parentElement.closest('.se-table') === table) {
            return current.closest('.se-table-cell');
        }
        current = current.parentElement;
    }
    return node;
}

/**
 * 🔥 핵심: rowspan/colspan 포함 논리 그리드 기반 범위 계산 (완전 수정본)
 */
function getGridCellRange(table, start, end) {
    const rows = Array.from(
        table.querySelectorAll(':scope > tbody > tr, :scope > tr')
    );

    // 1️⃣ 논리 그리드 생성 (rowspan/colspan 반영)
    const grid = [];

    rows.forEach((tr, r) => {
        if (!grid[r]) grid[r] = [];
        let colPointer = 0;

        const cells = Array.from(
            tr.querySelectorAll(':scope > .se-table-cell')
        );

        cells.forEach(cell => {
            // 병합으로 이미 채워진 칸 skip
            while (grid[r][colPointer]) {
                colPointer++;
            }

            const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
            const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);

            for (let rr = 0; rr < rowspan; rr++) {
                for (let cc = 0; cc < colspan; cc++) {
                    const targetRow = r + rr;
                    const targetCol = colPointer + cc;

                    if (!grid[targetRow]) grid[targetRow] = [];
                    grid[targetRow][targetCol] = cell;
                }
            }

            colPointer += colspan;
        });
    });

    // 2️⃣ 🔥 병합셀 점유 영역(rect) 기반 좌표 계산 (기존 코드 완전 교체)
    const startAnchor = findCellAnchor(grid, start);
    const endAnchor   = findCellAnchor(grid, end);

    if (!startAnchor || !endAnchor) {
        return [start];
    }

    const minRow = Math.min(startAnchor.row, endAnchor.row);
    const maxRow = Math.max(startAnchor.row, endAnchor.row);

    const minCol = Math.min(startAnchor.col, endAnchor.col);
    const maxCol = Math.max(startAnchor.col, endAnchor.col);
    
    const uniqueCells = new Set();

    grid.forEach(row => {

        row?.forEach(cell => {

            if (cell) {
                uniqueCells.add(cell);
            }
        });
    });

    const resultSet = new Set();

    uniqueCells.forEach(cell => {

        const cellRect = findCellRect(
            grid,
            cell
        );

        if (!cellRect) {
            return;
        }

        // 🔥 선택 rect 와 셀 rect 가 겹치는가
        const intersects =
            cellRect.maxR >= minRow &&
            cellRect.minR <= maxRow &&
            cellRect.maxC >= minCol &&
            cellRect.minC <= maxCol;

        if (intersects) {
            resultSet.add(cell);
        }
    });
    
    const result = Array.from(resultSet);

    return result;
}

/**
 * 🔥 병합셀 anchor 위치 찾기
 * (병합셀의 시작 좌표)
 */
function findCellAnchor(grid, targetCell) {

    for (let r = 0; r < grid.length; r++) {

        const row = grid[r];

        if (!row) continue;

        for (let c = 0; c < row.length; c++) {

            if (row[c] === targetCell) {

                return {
                    row: r,
                    col: c
                };
            }
        }
    }

    return null;
}    

/**
 * 🔥 신규: 병합 셀의 실제 점유 사각형 영역 찾기 (핵심 함수)
 */
function findCellRect(grid, targetCell) {
    let minR = Infinity, maxR = -1;
    let minC = Infinity, maxC = -1;

    for (let r = 0; r < grid.length; r++) {
        const row = grid[r];
        if (!row) continue;

        for (let c = 0; c < row.length; c++) {
            if (row[c] === targetCell) {
                if (r < minR) minR = r;
                if (r > maxR) maxR = r;
                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
            }
        }
    }

    if (minR === Infinity) return null;

    return { minR, maxR, minC, maxC };
}    

/**
 * [유틸] 테이블 직계 셀만 추출
 */
function getDirectCells(table) {
    return Array.from(
        table.querySelectorAll(
            ':scope > tbody > tr > .se-table-cell, :scope > tr > .se-table-cell, :scope > tr > td.se-table-cell'
        )
    );
}


function findParentTdFromTable(table) {

    let current = table.parentElement;

    while (current) {

        if (
            current.classList &&
            current.classList.contains('se-table-cell')
        ) {
            return current;
        }

        current = current.parentElement;
    }

    return null;
}

function findParentTableFromTd(td) {

    if (!td) {
        return null;
    }

    let current = td.parentElement;

    while (current) {

        // 자기 내부 table 제외
        const table = current.closest?.('.se-table');

        if (table && !td.contains(table)) {
            return table;
        }

        current = current.parentElement;
    }

    return null;
}
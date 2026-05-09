import { findParentTdFromTable, findParentTableFromTd } from "../utils/selectionUtils.js";

/**
 * 테이블 및 텍스트 드래그 시 선택 영역과 활성 컨테이너를 계산하는 서비스
 * ✔ rowspan + colspan 혼합 드래그 완전 대응
 * ✔ 세로 병합 셀 누락 버그 해결
 */
export function createDragService(defaultRootId) {
    
    /**
     * 메인 진입점: mousemove 이벤트 발생 시 드래그 상태 계산
     */
    function mouseDragCalculate(e, startTD) {
        if (!startTD) return { selectedCells: [], activeId: null };

        const activeId      = _resolveActiveId(startTD);
        const selectedCells = _calculateSelectedCells(e, startTD);

        return { selectedCells, activeId };
    }

    /**
     * [내부] 브라우저 Selection을 기반으로 실제 작업 중인 컨테이너 ID 추출
     */
    function _resolveActiveId(startTD) {
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
    function _calculateSelectedCells(e, startTD) {
        // 🔥 contenteditable + span 위 드래그 안정화 (핵심 보강)
        let targetEl = e.target;
        if (!targetEl.closest?.('.se-table-cell')) {
            const hit = document.elementFromPoint(e.clientX, e.clientY);
            if (hit) targetEl = hit;
        }

        const currentTD  = targetEl.closest('.se-table-cell');
        const startTable = startTD.closest('.se-table');

        // CASE 0: 동일 테이블 내부 드래그
        if (currentTD && startTable?.contains(currentTD)) {

            return _getGridCellRange(
                startTable,
                startTD,
                currentTD
            );
        }

        // CASE 1: 상위 테이블/부모 TD 영역으로 진입 (중첩 테이블 대응)
        const parentTD = targetEl.closest('.se-table-cell');
        if (parentTD && parentTD !== startTD) {
            const parentTable = parentTD.closest('.se-table');
            if (parentTable) {
                return _calculateNestedTableRange(parentTable, startTD, parentTD);
            }
        }

        // CASE 2: 테이블 외부로 완전히 나감
        if (startTable) {
            return _getDirectCells(startTable);
        }

        return [startTD];
    }

    /**
     * [내부] 중첩 테이블 범위 계산
     * ✔ 자식 → 부모 drag rectangle 확장 지원
     * ✔ 병합셀 intersects 방식 유지
     * ✔ 기존 튀는 selection 버그 유지 해결
     */
    function _calculateNestedTableRange(parentTable, startTD, parentTD) {

        // 현재 드래그 시작 셀이 속한 자식 테이블
        const childTable = startTD.closest('.se-table');

        // 방어
        if (!childTable) {
            return [parentTD];
        }

        // 자식 테이블 전체 셀 유지
        const childCells = _getDirectCells(childTable);

        // =========================================
        // 🔥 핵심
        // 자식 테이블을 감싸고 있는
        // 부모 table-cell 찾기
        // =========================================

        // const childRootTD = childTable.closest('.se-table-cell');
        let childRootTD = findParentTdFromTable(childTable);

        // 🔥 parentTable 기준 direct td 까지 상승
        while (
            childRootTD &&
            childRootTD.closest('.se-table') !== parentTable
        ) {
            const upperTable = childRootTD.closest('.se-table');

            if (!upperTable) {
                break;
            }

            childRootTD = findParentTdFromTable(upperTable);
        }

        // 부모 셀 못찾으면 fallback
        if (!childRootTD) {

            return [
                ...childCells,
                parentTD
            ];
        }

        // =========================================
        // 🔥 부모 table 기준 rectangle selection
        // =========================================

        const parentRange = _getGridCellRange(
            parentTable,
            childRootTD,
            parentTD
        );

        // =========================================
        // 🔥 자식 셀 + 부모 rectangle 병합
        // =========================================

        return Array.from(
            new Set([
                ...childCells,
                ...parentRange
            ])
        );
    }

    /**
     * 🔥 핵심: rowspan/colspan 포함 논리 그리드 기반 범위 계산 (완전 수정본)
     */
    function _getGridCellRange(table, start, end) {
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
        const startAnchor = _findCellAnchor(grid, start);
        const endAnchor   = _findCellAnchor(grid, end);

        if (!startAnchor || !endAnchor) {
            return [start];
        }

        const minRow = Math.min(startAnchor.row, endAnchor.row);
        const maxRow = Math.max(startAnchor.row, endAnchor.row);

        const minCol = Math.min(startAnchor.col, endAnchor.col);
        const maxCol = Math.max(startAnchor.col, endAnchor.col);

        // 3️⃣ unique 셀 수집
        /*
        앵커형식
        const uniqueCells = new Set();

        grid.forEach(row => {
            row?.forEach(cell => {
                if (cell) {
                    uniqueCells.add(cell);
                }
            });
        });

        // 4️⃣ anchor 가 선택 영역 안에 있는 셀만 선택
        const resultSet = new Set();

        uniqueCells.forEach(cell => {

            const anchor = _findCellAnchor(grid, cell);

            if (!anchor) return;

            const isInside =
                anchor.row >= minRow &&
                anchor.row <= maxRow &&
                anchor.col >= minCol &&
                anchor.col <= maxCol;

            if (isInside) {
                resultSet.add(cell);
            }
        });
        */
        
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

            const cellRect = _findCellRect(
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
    function _findCellAnchor(grid, targetCell) {

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
    function _findCellRect(grid, targetCell) {
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
    function _getDirectCells(table) {
        return Array.from(
            table.querySelectorAll(
                ':scope > tbody > tr > .se-table-cell, :scope > tr > .se-table-cell, :scope > tr > td.se-table-cell'
            )
        );
    }

    /**
     * [유틸] 상위 조상 중 directCells에 포함된 TD 찾기
     */
    function _findDirectAncestorInList(node, stopAt, list) {
        let current = node;
        while (current && current !== stopAt) {
            if (list.includes(current)) return current;
            current = current.parentElement;
        }
        return null;
    }

    return { mouseDragCalculate };
}
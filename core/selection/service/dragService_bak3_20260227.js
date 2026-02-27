/**
 * 테이블 및 텍스트 드래그 시 선택 영역과 활성 컨테이너를 계산하는 서비스
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
        const currentTD  = e.target.closest('.se-table-cell');
        const startTable = startTD.closest('.se-table');

        // CASE 0: 동일 테이블 내부 드래그
        if (currentTD && startTable?.contains(currentTD)) {
            return _getGridCellRange(startTable, startTD, currentTD);
        }

        // CASE 1: 상위 테이블/부모 TD 영역으로 진입 (중첩 테이블 대응)
        const parentTD = e.target.closest('.se-table-cell');
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
     * [내부] 중첩 테이블 상황에서 할아버지 테이블의 직계 아들 TD를 찾아 범위 계산
     */
    function _calculateNestedTableRange(parentTable, startTD, parentTD) {
        const directCells      = _getDirectCells(parentTable);
        const effectiveStartTD = _findDirectAncestorInList(startTD, parentTable, directCells);

        const startIdx = directCells.indexOf(effectiveStartTD);
        const endIdx   = directCells.indexOf(parentTD);

        if (startIdx !== -1 && endIdx !== -1) {
            const rangeIndices = [startIdx, endIdx].sort((a, b) => a - b);
            return directCells.slice(rangeIndices[0], rangeIndices[1] + 1);
        }

        return [startTD];
    }

    /**
     * [유틸] 특정 요소로부터 상위로 올라가며 주어진 리스트에 포함된 직계 조상 TD 탐색
     */
    function _findDirectAncestorInList(node, stopAt, list) {
        let current = node;
        while (current && current !== stopAt) {
            if (list.includes(current)) return current;
            current = current.parentElement;
        }
        return null;
    }

    /**
     * [유틸] 테이블의 직계 자식 셀(TD)들만 추출
     */
    function _getDirectCells(table) {
        return Array.from(table.querySelectorAll(':scope > tbody > tr > .se-table-cell, :scope > tr > .se-table-cell, :scope > tr > td.se-table-cell'));
    }

    function _getGridCellRange(table, start, end) {
        const rows = Array.from(table.querySelectorAll(':scope > tbody > tr, :scope > tr'));

        // 1️⃣ 논리 그리드 생성 (rowspan/colspan 반영)
        const grid = [];
        
        rows.forEach((tr, r) => {
            if (!grid[r]) grid[r] = [];
            let colPointer = 0;

            const cells = Array.from(tr.querySelectorAll(':scope > .se-table-cell'));

            cells.forEach(cell => {
                // 이미 병합으로 채워진 col skip
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

        // 2️⃣ start / end의 "논리 좌표" 찾기
        let startPos = null;
        let endPos = null;

        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < (grid[r]?.length || 0); c++) {
                if (grid[r][c] === start && !startPos) {
                    startPos = { r, c };
                }
                if (grid[r][c] === end && !endPos) {
                    endPos = { r, c };
                }
            }
        }

        if (!startPos || !endPos) {
            return [start];
        }

        const minRow = Math.min(startPos.r, endPos.r);
        const maxRow = Math.max(startPos.r, endPos.r);
        const minCol = Math.min(startPos.c, endPos.c);
        const maxCol = Math.max(startPos.c, endPos.c);

        // 3️⃣ 논리 범위 내 셀 수집 (중복 제거)
        const resultSet = new Set();

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const cell = grid[r]?.[c];
                if (cell) {
                    resultSet.add(cell);
                }
            }
        }

        return Array.from(resultSet);
    }

    return { mouseDragCalculate };
}
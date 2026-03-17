/**
 * 테이블 툴바 액션 서비스
 * (행 추가 / 열 추가 / 병합 / 삭제)
 * 실제 로직은 추후 구현 예정 - 현재는 이벤트 연결용 스켈레톤
 */
export function createTableToolbarService(stateAPI, uiAPI, selectionAPI) {

    /**
     * 아래에 행 추가
     */
    function addRow({ tableEl, rootEl, action, event }) {
        alert("기능 구현중");        
        if (!tableEl) return false;
        // TODO: 행 추가 로직 구현 예정
        // 1. 선택된 셀 위치 분석
        // 2. 모델 state에 row 삽입
        // 3. UI 부분 렌더링
        
        console.log("[TableToolbar] addRow called", {
            tableId: tableEl.id,
            action
        });

        return true;
    }

    /**
     * 오른쪽에 열 추가
     */
    function addCol({ tableEl, rootEl, action, event }) {
        alert("기능 구현중");        
        if (!tableEl) return false;

        // TODO: 열 추가 로직 구현 예정
        // 1. 현재 셀 column index 계산
        // 2. 각 row에 column 삽입
        // 3. state & UI 동기화

        console.log("[TableToolbar] addCol called", {
            tableId: tableEl.id,
            action
        });

        return true;
    }

    /**
     * 셀 병합
     */
    function mergeCells({ tableId }) {

        const selectedCellIds = selectionAPI.getSelectedKeys();
        if (!selectedCellIds || selectedCellIds.length < 2) {
            return false;
        }

        // 1️⃣ 부모 상태
        const parentKey   = selectionAPI.findParentContainerId(tableId);
        const parentState = stateAPI.get(parentKey);
        if (!parentState) return false;

        // 2️⃣ 정확한 테이블 찾기
        const tableInfo = findTableChunkById(parentState, tableId);
        if (!tableInfo) return false;

        const { lineIndex, chunk } = tableInfo;
        const data = chunk.data;

        // 3️⃣ 선택된 셀 → 좌표 변환
        const positions = [];

        for (let r = 0; r < data.length; r++) {
            for (let c = 0; c < data[r].length; c++) {
                const cell = data[r][c];
                if (cell && selectedCellIds.includes(cell.id)) {
                    positions.push({ r, c });
                }
            }
        }

        if (positions.length < 2) {
            return false;
        }

        // 4️⃣ 병합 범위 계산
        const minRow = Math.min(...positions.map(p => p.r));
        const maxRow = Math.max(...positions.map(p => p.r));
        const minCol = Math.min(...positions.map(p => p.c));
        const maxCol = Math.max(...positions.map(p => p.c));

        // 🔥 baseCell 안전 확보 (이미 병합된 영역 방어)
        let baseCell = data[minRow][minCol];

        if (!baseCell) {
            const firstValid = positions.find(p => data[p.r][p.c]);
            if (!firstValid) return false;
            baseCell = data[firstValid.r][firstValid.c];
        }

        baseCell.rowspan = maxRow - minRow + 1;
        baseCell.colspan = maxCol - minCol + 1;

        // 5️⃣ 나머지 셀 제거 (🔥 null 방어 포함)
        const deleteKeys = [];

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {

                if (r === minRow && c === minCol) continue;

                const cell = data[r][c];

                // 🔥 이미 병합된 영역(null) 방어
                if (!cell) {
                    data[r][c] = null;
                    continue;
                }

                if (cell.id) {
                    deleteKeys.push(cell.id);
                }

                data[r][c] = null;
            }
        }

        if (deleteKeys.length) {
            stateAPI.deleteBatch(deleteKeys);
        }

        // 6️⃣ 상태 저장
        stateAPI.save(parentKey, parentState);

        // 7️⃣ 강제 테이블 렌더
        uiAPI.renderLine(lineIndex, parentState[lineIndex], {
            key            : parentKey,
            shouldRenderSub: true,
            tableStrategy  : 'force'
        });

        return true;
    }
    /*
    function mergeCells({ tableId }) {

        const selectedCellIds = selectionAPI.getSelectedKeys();
        if (!selectedCellIds.length || selectedCellIds.length < 2) {
            return false;
        }

        // ⭐ 1. 부모 상태
        const parentKey   = selectionAPI.findParentContainerId(tableId);
        const parentState = stateAPI.get(parentKey);
        if (!parentState) {
            return false;
        }

        // ⭐ 2. tableId로 정확하게 테이블 찾기
        const tableInfo = findTableChunkById(parentState, tableId);
        if (!tableInfo) {
            return false;
        }

        const { lineIndex, chunk } = tableInfo;
        const data = chunk.data;

        // ⭐ 3. cellId → 좌표 변환
        const positions = [];

        for (let r = 0; r < data.length; r++) {
            for (let c = 0; c < data[r].length; c++) {
                const cell = data[r][c];
                if (cell && selectedCellIds.includes(cell.id)) {
                    positions.push({ r, c });
                }
            }
        }

        if (positions.length < 2) {
            return false;
        }

        // ⭐ 4. 직사각형 계산
        const minRow = Math.min(...positions.map(p => p.r));
        const maxRow = Math.max(...positions.map(p => p.r));
        const minCol = Math.min(...positions.map(p => p.c));
        const maxCol = Math.max(...positions.map(p => p.c));
        const baseCell = data[minRow][minCol];

        baseCell.rowspan = maxRow - minRow + 1;
        baseCell.colspan = maxCol - minCol + 1;

        // ⭐ 5. 나머지 셀 제거
        const deleteKeys = [];

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                if (r === minRow && c === minCol) continue;
                const cell = data[r][c];
                if (cell.id) {
                    deleteKeys.push(cell.id);
                }
                data[r][c] = null;
            }
        }

        if (deleteKeys.length) {
            stateAPI.deleteBatch(deleteKeys);
        }

        // ⭐ 6. 저장
        stateAPI.save(parentKey, parentState);

        // ⭐ 7. 렌더
        uiAPI.renderLine(lineIndex, parentState[lineIndex], {
            key            : parentKey,
            shouldRenderSub: true,
            tableStrategy  : 'force'
        });

        return true;
    }
    */
    function findTableChunkById(parentState, tableId) {
        for (let i = 0; i < parentState.length; i++) {
            const line = parentState[i];
            for (let j = 0; j < line.chunks.length; j++) {
                const chunk = line.chunks[j];
                if (chunk.type === "table" && chunk.tableId === tableId) {
                    return {
                        lineIndex: i,
                        chunkIndex: j,
                        chunk
                    };
                }
            }
        }
        return null;
    }    

    /**
     * 테이블 삭제
     */
    function deleteTable({ tableEl, rootEl, action, event }) {
        alert("기능 구현중");        
        if (!tableEl) return false;

        // TODO: 테이블 삭제 로직 구현 예정
        // 1. 현재 activeKey 확인
        // 2. state에서 table chunk 제거
        // 3. 라인 재렌더링
        // 4. 커서 복원 처리

        console.log("[TableToolbar] deleteTable called", {
            tableId: tableEl.id,
            action
        });

        return true;
    }

    return {
        addRow,
        addCol,
        mergeCells,
        deleteTable
    };
}
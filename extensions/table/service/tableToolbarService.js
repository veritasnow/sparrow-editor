import { EditorLineModel } from '../../../model/editorLineModel.js';
import { TextChunkModel } from '../../../model/editorModel.js';
import { DEFAULT_TEXT_STYLE } from '../../../constants/styleConstants.js';

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
        if (!tableEl) return false;

        const tableId = tableEl.id;
        const selectedCellIds = selectionAPI.getSelectedKeys();
        if (!selectedCellIds || selectedCellIds.length === 0) return false;

        // 1️⃣ 부모 상태 확보 (Deep Copy까지는 아니어도 얕은 복사는 준비)
        const parentKey = selectionAPI.findParentContainerId(tableId);
        const parentState = stateAPI.get(parentKey);
        if (!parentState) return false;

        // 2️⃣ 테이블 정보 및 타겟 위치 계산
        const tableInfo = findTableChunkById(parentState, tableId);
        if (!tableInfo) return false;

        const { lineIndex, chunk } = tableInfo;
        const { data } = chunk;

        let targetRowIndex = -1;
        for (let r = 0; r < data.length; r++) {
            for (let c = 0; c < data[r].length; c++) {
                const cell = data[r][c];
                if (cell && selectedCellIds.includes(cell.id)) {
                    const rowEnd = r + (cell.rowspan || 1) - 1;
                    targetRowIndex = Math.max(targetRowIndex, rowEnd);
                }
            }
        }
        if (targetRowIndex === -1) return false;

        // 3️⃣ 새로운 셀 데이터 및 행 생성
        const colCount = data[0].length;
        const newRow = [];
        
        // 개별 셀 상태 등록 (이 부분은 외부 API이므로 그대로 유지하되, 내부 로직은 순수하게 관리)
        for (let i = 0; i < colCount; i++) {
            const newCellId = `cell-${tableId}-${Math.random().toString(36).slice(2, 11)}`;
            
            stateAPI.save(newCellId, [
                EditorLineModel('left', [
                    TextChunkModel('text', '', { ...DEFAULT_TEXT_STYLE })
                ])
            ], false);

            newRow.push({
                id: newCellId,
                style: {},
                rowspan: 1,
                colspan: 1
            });
        }

        // 4️⃣ 🔥 [불변성 핵심] 데이터 구조 재구성
        // A. 새로운 Data 배열 생성 (기존 data 수정 X)
        const updatedData = [
            ...data.slice(0, targetRowIndex + 1),
            newRow,
            ...data.slice(targetRowIndex + 1)
        ];

        // B. 새로운 ParentState 생성 (부모 객체들 교체)
        const updatedParentState = parentState.map((line, idx) => {
            if (idx !== lineIndex) return line; // 다른 라인은 그대로 유지

            return {
                ...line,
                chunks: line.chunks.map(c => {
                    // 테이블 chunk가 아니거나 ID가 다르면 그대로 유지
                    if (c.type !== 'table' || c.tableId !== tableId) return c;
                    
                    // 타겟 테이블만 새로운 data를 가진 객체로 교체
                    return { ...c, data: updatedData };
                })
            };
        });

        // 5️⃣ 최종 확정 저장
        stateAPI.save(parentKey, updatedParentState);

        // 6️⃣ UI 렌더링
        uiAPI.renderLine(lineIndex, updatedParentState[lineIndex], {
            key: parentKey,
            shouldRenderSub: true,
            tableStrategy: 'force'
        });

        return true;
    }

    /**
     * 오른쪽에 열 추가
     */
    function addCol({ tableEl, rootEl, action, event }) {
        if (!tableEl) return false;

        const tableId = tableEl.id;
        const selectedCellIds = selectionAPI.getSelectedKeys();
        if (!selectedCellIds || selectedCellIds.length === 0) return false;

        // 1️⃣ 부모 상태 확보
        const parentKey = selectionAPI.findParentContainerId(tableId);
        const parentState = stateAPI.get(parentKey);
        if (!parentState) return false;

        // 2️⃣ 테이블 정보 및 타겟 열 위치(Index) 계산
        const tableInfo = findTableChunkById(parentState, tableId);
        if (!tableInfo) return false;

        const { lineIndex, chunk } = tableInfo;
        const { data } = chunk; // data: [row][col] 구조

        let targetColIndex = -1;
        // 선택된 셀들 중 가장 오른쪽에 있는 열의 인덱스를 찾음
        for (let r = 0; r < data.length; r++) {
            for (let c = 0; c < data[r].length; c++) {
                const cell = data[r][c];
                if (cell && selectedCellIds.includes(cell.id)) {
                    // 병합된 셀인 경우 colspan을 고려하여 끝 지점 계산
                    const colEnd = c + (cell.colspan || 1) - 1;
                    targetColIndex = Math.max(targetColIndex, colEnd);
                }
            }
        }

        if (targetColIndex === -1) return false;

        // 3️⃣ 새로운 열 데이터 생성 및 각 행에 삽입
        // 🔥 [불변성] 기존 data를 직접 수정하지 않기 위해 map 사용
        const updatedData = data.map((row) => {
            const newRow = [...row]; // 행 복사
            
            // 새 셀 생성
            const newCellId = `cell-${tableId}-${Math.random().toString(36).slice(2, 11)}`;
            
            // 개별 셀의 상세 상태(텍스트 등) 저장
            stateAPI.save(newCellId, [
                EditorLineModel('left', [
                    TextChunkModel('text', '', { ...DEFAULT_TEXT_STYLE })
                ])
            ], false);

            const newCell = {
                id: newCellId,
                style: {},
                rowspan: 1,
                colspan: 1
            };

            // 계산된 위치 다음에 삽입
            newRow.splice(targetColIndex + 1, 0, newCell);
            return newRow;
        });

        // 4️⃣ [불변성] 전체 ParentState 구조 재구성
        const updatedParentState = parentState.map((line, idx) => {
            if (idx !== lineIndex) return line;

            return {
                ...line,
                chunks: line.chunks.map(c => {
                    if (c.type !== 'table' || c.tableId !== tableId) return c;
                    return { ...c, data: updatedData };
                })
            };
        });

        // 5️⃣ 최종 확정 저장
        stateAPI.save(parentKey, updatedParentState);

        // 6️⃣ UI 렌더링
        uiAPI.renderLine(lineIndex, updatedParentState[lineIndex], {
            key: parentKey,
            shouldRenderSub: true,
            tableStrategy: 'force'
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
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

        // 1️⃣ 단일 활성 키(Active Key) 가져오기
        const activeCellId = selectionAPI.getActiveKey();
        console.log("Active Key : ", activeCellId);
        if (!activeCellId) return false;

        const tableId = tableEl.id;
        const parentKey = selectionAPI.findParentContainerId(tableId);
        const parentState = stateAPI.get(parentKey);
        if (!parentState) return false;

        // 2️⃣ 테이블 정보 확보
        const tableInfo = findTableChunkById(parentState, tableId);
        if (!tableInfo) return false;

        const { lineIndex, chunk } = tableInfo;
        const { data } = chunk;

        // 3️⃣ Active Key가 위치한 행Index 찾기
        let targetRowIndex = -1;
        for (let r = 0; r < data.length; r++) {
            // find()를 사용해 해당 행에 activeCellId가 있는지 확인
            const hasActiveCell = data[r].find(cell => cell && cell.id === activeCellId);
            if (hasActiveCell) {
                // Rowspan이 있을 경우를 대비해 실제 해당 셀이 끝나는 지점을 계산
                targetRowIndex = r + (hasActiveCell.rowspan || 1) - 1;
                break; 
            }
        }

        if (targetRowIndex === -1) return false;

        // 4️⃣ 새로운 행(newRow) 생성
        const colCount = data[0].length;
        const newRow = [];
        
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

        // 5️⃣ 불변성을 유지하며 데이터 업데이트
        const updatedData = [
            ...data.slice(0, targetRowIndex + 1),
            newRow,
            ...data.slice(targetRowIndex + 1)
        ];

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

        // 6️⃣ 저장 및 렌더링
        stateAPI.save(parentKey, updatedParentState);
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

        // 1️⃣ 단일 활성 키(Active Key) 가져오기
        const activeCellId = selectionAPI.getActiveKey();
        if (!activeCellId) return false;

        const tableId = tableEl.id;
        const parentKey = selectionAPI.findParentContainerId(tableId);
        const parentState = stateAPI.get(parentKey);
        if (!parentState) return false;

        // 2️⃣ 테이블 정보 및 타겟 열 위치(Index) 계산
        const tableInfo = findTableChunkById(parentState, tableId);
        if (!tableInfo) return false;

        const { lineIndex, chunk } = tableInfo;
        const { data } = chunk;

        let targetColIndex = -1;
        
        // Active Key가 위치한 열의 인덱스 찾기
        for (let r = 0; r < data.length; r++) {
            const activeCell = data[r].find(cell => cell && cell.id === activeCellId);
            if (activeCell) {
                const colStart = data[r].indexOf(activeCell);
                // colspan이 있으면 끝나는 지점을 계산하여 그 오른쪽에 추가
                targetColIndex = colStart + (activeCell.colspan || 1) - 1;
                break;
            }
        }

        if (targetColIndex === -1) return false;

        // 3️⃣ 새로운 열 데이터 생성 및 각 행에 삽입 (불변성 유지)
        const updatedData = data.map((row) => {
            const newRow = [...row]; // 행 복사
            
            // 새 셀 고유 ID 생성
            const newCellId = `cell-${tableId}-${Math.random().toString(36).slice(2, 11)}`;
            
            // 개별 셀 상태 저장 (비어있는 에디터 라인 모델)
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

            // 찾은 타겟 열 인덱스 바로 뒤에 삽입
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

        // 5️⃣ 최종 데이터 저장
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
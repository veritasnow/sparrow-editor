import { EditorLineModel } from '../../../model/editorLineModel.js';
import { TextChunkModel } from '../../../model/editorModel.js';
import { DEFAULT_TEXT_STYLE } from '../../../constants/styleConstants.js';

export function createTableToolbarService(stateAPI, uiAPI, selectionAPI) {

    // --- 🛠️ 내부 공통 유틸리티 함수 ---

    /**
     * 테이블 조작에 필요한 모든 컨텍스트(부모 상태, 위치 등)를 한 번에 가져옴
     */
    function getTableContext(tableId) {
        const parentKey = selectionAPI.findParentContainerId(tableId);
        const parentState = stateAPI.get(parentKey);
        if (!parentState) return null;

        for (let i = 0; i < parentState.length; i++) {
            const chunkIndex = parentState[i].chunks.findIndex(c => c.type === 'table' && c.tableId === tableId);
            if (chunkIndex !== -1) {
                return {
                    parentKey,
                    parentState,
                    lineIndex: i,
                    chunkIndex,
                    chunk: parentState[i].chunks[chunkIndex]
                };
            }
        }
        return null;
    }

    /**
     * 새로운 빈 셀 모델 생성 및 개별 상태 저장
     */
    function createNewCell(tableId) {
        const newCellId = `cell-${tableId}-${Math.random().toString(36).slice(2, 11)}`;
        stateAPI.save(newCellId, [
            EditorLineModel('left', [TextChunkModel('text', '', { ...DEFAULT_TEXT_STYLE })])
        ], false);

        return { id: newCellId, style: {}, rowspan: 1, colspan: 1 };
    }

    /**
     * 변경된 테이블 데이터를 부모 상태에 반영하고 UI를 갱신
     */
    function commitTableUpdate(ctx, updatedData) {
        const { parentKey, parentState, lineIndex, chunkIndex } = ctx;

        const updatedParentState = parentState.map((line, idx) => {
            if (idx !== lineIndex) return line;
            const newChunks = [...line.chunks];
            newChunks[chunkIndex] = { ...newChunks[chunkIndex], data: updatedData };
            return { ...line, chunks: newChunks };
        });

        stateAPI.save(parentKey, updatedParentState);
        uiAPI.renderLine(lineIndex, updatedParentState[lineIndex], {
            key: parentKey,
            shouldRenderSub: true,
            tableStrategy: 'force'
        });
        return true;
    }

    // --- 🚀 메인 서비스 액션 ---

    function addRow({ tableEl }) {
        const ctx = getTableContext(tableEl?.id);
        const activeCellId = selectionAPI.getActiveKey();
        if (!ctx || !activeCellId) return false;

        const { data } = ctx.chunk;
        let targetRowIndex = -1;

        for (let r = 0; r < data.length; r++) {
            const cell = data[r].find(c => c?.id === activeCellId);
            if (cell) {
                targetRowIndex = r + (cell.rowspan || 1) - 1;
                break;
            }
        }

        if (targetRowIndex === -1) return false;

        const newRow = Array.from({ length: data[0].length }, () => createNewCell(tableEl.id));
        const updatedData = [...data.slice(0, targetRowIndex + 1), newRow, ...data.slice(targetRowIndex + 1)];

        return commitTableUpdate(ctx, updatedData);
    }

    function addCol({ tableEl }) {
        const ctx = getTableContext(tableEl?.id);
        const activeCellId = selectionAPI.getActiveKey();
        if (!ctx || !activeCellId) return false;

        const { data } = ctx.chunk;
        let targetColIndex = -1;

        for (let r = 0; r < data.length; r++) {
            const cell = data[r].find(c => c?.id === activeCellId);
            if (cell) {
                targetColIndex = data[r].indexOf(cell) + (cell.colspan || 1) - 1;
                break;
            }
        }

        if (targetColIndex === -1) return false;

        const updatedData = data.map(row => {
            const newRow = [...row];
            newRow.splice(targetColIndex + 1, 0, createNewCell(tableEl.id));
            return newRow;
        });

        return commitTableUpdate(ctx, updatedData);
    }

    function mergeCells({ tableId }) {
        const selectedCellIds = selectionAPI.getSelectedKeys();
        const ctx = getTableContext(tableId);
        if (!ctx || !selectedCellIds || selectedCellIds.length < 2) return false;

        const { data } = ctx.chunk;
        const positions = [];

        // 좌표 추출
        data.forEach((row, r) => {
            row.forEach((cell, c) => {
                if (cell && selectedCellIds.includes(cell.id)) positions.push({ r, c });
            });
        });

        if (positions.length < 2) return false;

        const minRow = Math.min(...positions.map(p => p.r));
        const maxRow = Math.max(...positions.map(p => p.r));
        const minCol = Math.min(...positions.map(p => p.c));
        const maxCol = Math.max(...positions.map(p => p.c));

        const baseCell = data[minRow][minCol] || data[positions.find(p => data[p.r][p.c]).r][positions.find(p => data[p.r][p.c]).c];
        baseCell.rowspan = maxRow - minRow + 1;
        baseCell.colspan = maxCol - minCol + 1;

        const deleteKeys = [];
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                if (r === minRow && c === minCol) continue;
                if (data[r][c]?.id) deleteKeys.push(data[r][c].id);
                data[r][c] = null;
            }
        }

        if (deleteKeys.length) stateAPI.deleteBatch(deleteKeys);
        return commitTableUpdate(ctx, data);
    }

    function deleteTable({ tableEl }) {
        const ctx = getTableContext(tableEl.id);
        if (!ctx) return false;

        const { parentKey, parentState, lineIndex, chunkIndex } = ctx;
        
        // 해당 테이블 청크를 제외하고 재생성
        const updatedParentState = parentState.map((line, idx) => {
            if (idx !== lineIndex) return line;
            return {
                ...line,
                chunks: line.chunks.filter((_, cIdx) => cIdx !== chunkIndex)
            };
        });

        stateAPI.save(parentKey, updatedParentState);
        uiAPI.renderLine(lineIndex, updatedParentState[lineIndex], { key: parentKey });
        return true;
    }

    function deleteRow({ tableEl }) {
        console.log("ssssssssssssssssssssssss");
        const ctx = getTableContext(tableEl?.id);
        const activeCellId = selectionAPI.getActiveKey();
        if (!ctx || !activeCellId) return false;

        const { data } = ctx.chunk;
        if (data.length <= 1) {
            // 행이 하나뿐이라면 테이블 전체 삭제로 연결하거나 무시
            return deleteTable({ tableEl });
        }

        let targetRowIndex = -1;
        for (let r = 0; r < data.length; r++) {
            if (data[r].find(c => c?.id === activeCellId)) {
                targetRowIndex = r;
                break;
            }
        }

        if (targetRowIndex === -1) return false;

        // 삭제될 행에 있는 셀들의 ID 수집 (메모리 해제용)
        const deleteKeys = data[targetRowIndex]
            .filter(cell => cell && cell.id)
            .map(cell => cell.id);

        // 데이터 업데이트: 해당 인덱스 행 제거
        const updatedData = data.filter((_, idx) => idx !== targetRowIndex);

        if (deleteKeys.length) stateAPI.deleteBatch(deleteKeys);
        return commitTableUpdate(ctx, updatedData);
    }

    function deleteCol({ tableEl }) {
        const ctx = getTableContext(tableEl?.id);
        const activeCellId = selectionAPI.getActiveKey();
        if (!ctx || !activeCellId) return false;

        const { data } = ctx.chunk;
        const colCount = data[0].length;

        if (colCount <= 1) {
            // 열이 하나뿐이라면 테이블 전체 삭제로 연결하거나 무시
            return deleteTable({ tableEl });
        }

        let targetColIndex = -1;
        for (let r = 0; r < data.length; r++) {
            const cellIndex = data[r].findIndex(c => c?.id === activeCellId);
            if (cellIndex !== -1) {
                targetColIndex = cellIndex;
                break;
            }
        }

        if (targetColIndex === -1) return false;

        const deleteKeys = [];
        const updatedData = data.map(row => {
            const newRow = [...row];
            const removed = newRow.splice(targetColIndex, 1)[0];
            if (removed && removed.id) deleteKeys.push(removed.id);
            return newRow;
        });

        if (deleteKeys.length) stateAPI.deleteBatch(deleteKeys);
        return commitTableUpdate(ctx, updatedData);
    }    

    return { addRow, addCol, mergeCells, deleteTable, deleteRow, deleteCol };
}
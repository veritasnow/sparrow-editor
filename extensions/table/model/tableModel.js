// extensions/table/model/TableChunkModel.js
export function TableChunkModel(rows, cols) {
    // 1. 이 테이블 덩어리(Chunk)만의 고유 식별자 생성
    const tableId = Math.random().toString(36).slice(2, 6); 

    return {
        type: 'table',
        tableId: tableId, // 테이블 자체 ID 저장
        data: Array.from({ length: rows }, () => 
            Array.from({ length: cols }, () => ({
                // 2. ID 규칙: cell-[TableID]-[CellUniqueID]
                id: `cell-${tableId}-${Math.random().toString(36).slice(2, 11)}`,
                style: {}
            }))
        ),
        style: { width: '100%' },
        length: 1
    };
}
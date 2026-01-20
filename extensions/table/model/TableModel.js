// extensions/table/model/TableChunkModel.js
// model/tableModel.js 혹은 factory 내부
export function TableChunkModel(rows, cols) {
    return {
        type: 'table',
        data: Array.from({ length: rows }, () => 
            Array.from({ length: cols }, () => ({
                id: `cell-${Math.random().toString(36).slice(2, 11)}`,
                style: {}
            }))
        ),
        style: { width: '100%' },
        length: 1
    };
}
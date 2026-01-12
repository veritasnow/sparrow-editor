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
/*
export function TableChunkModel(rows, cols) {
    function createEmptyTableData(rows, cols) {
        return Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => ({
                text: "\u00A0", // 초기값 (공백)
                style: {}       // 셀별 스타일 객체
            }))
        );
    }
    
    return {
        type : 'table',
        data : createEmptyTableData(rows, cols), // {text: string, style: object}[][]
        style: {},  // 테이블 전체 스타일 (Border, Margin 등)
        length: 1   
    };
}
*/

/*
export function TableChunkModel(rows, cols) {
    function createEmptyTableData(rows, cols) {
        return Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => "\u00A0")
        );
    }
    
    return {
        type : 'table',
        data : createEmptyTableData(rows, cols),       // string[][]
        style: {},  // 테이블 전체 스타일
        length: 1   // chunk 단위 유지용 (기존 로직 호환)
    };
}
*/
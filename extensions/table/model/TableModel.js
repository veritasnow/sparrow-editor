// extensions/table/model/TableChunkModel.js
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
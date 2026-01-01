// extensions/table/model/TableChunkModel.js
export function TableChunkModel(rows, cols, data) {
    // data가 없으면 빈 배열 생성
    const initData = data ?? Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => "")
    );

    return {
        type : 'table',
        rows,
        cols,
        data: initData,   // <-- 핵심 추가!
        style: {},        // 테이블 전체 스타일
        length: 1 // 핵심!
    };
}
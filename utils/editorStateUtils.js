/**
 * 에디터 State 모델에서 특정 라인의 순수 텍스트 길이를 계산합니다.
 * @param {Object} lineData - EditorLineModel 객체
 * @returns {number} 라인의 총 텍스트 길이
 */
export function getLineLengthFromState(lineData) {
    if (!lineData || !lineData.chunks) return 0;
    
    // 청크 배열을 순회하며 텍스트 타입 청크의 길이만 합산
    return lineData.chunks.reduce((sum, chunk) => {
        // 텍스트 청크만 길이를 가짐
        return sum + (chunk.type === 'text' ? (chunk.text?.length || 0) : 0);
    }, 0);
}
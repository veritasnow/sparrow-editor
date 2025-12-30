import { chunkRegistry } from '../core/chunk/chunkRegistry.js'; // 레지스트리 도입

/**
 * 에디터 State 모델에서 특정 라인의 논리적 길이를 계산합니다.
 * @param {Object} lineData - EditorLineModel 객체
 * @returns {number} 라인의 총 논리적 길이 (Registry 기준)
 */
export function getLineLengthFromState(lineData) {
    if (!lineData || !lineData.chunks) return 0;
    
    return lineData.chunks.reduce((sum, chunk) => {
        // [수정] Registry에서 해당 타입의 핸들러를 가져옵니다.
        const handler = chunkRegistry.get(chunk.type);
        
        // [수정] 핸들러가 정의한 길이를 합산합니다.
        // 비디오라면 1을 반환할 것이고, 텍스트라면 text.length를 반환합니다.
        return sum + (handler ? handler.getLength(chunk) : 0);
    }, 0);
}
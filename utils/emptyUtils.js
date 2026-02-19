export function isLineEmpty(lineState) {
    if (!lineState || !lineState.chunks) return true;

    const chunks = Array.isArray(lineState.chunks) 
        ? lineState.chunks 
        : [lineState.chunks]; // 단일 객체인 경우 배열로 변환

    // 모든 청크를 돌면서 텍스트가 있는지 확인
    return chunks.every(chunk => {
        const text = chunk.text;
        // 1. text 필드가 없거나
        // 2. 빈 문자열이거나
        // 3. 제로 너비 공백(\u200B)만 있는 경우 '비어있음'으로 간주
        return !text || text === "" || text === "\u200B";
    });
}
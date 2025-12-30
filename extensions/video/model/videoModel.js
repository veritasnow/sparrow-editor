/**
 * VideoChunk Entity 모델을 생성하여 반환합니다. 
 * @param {string} videoId - 동영상의 고유 ID (예: YouTube ID).
 * @param {string} src - 동영상 임베드 URL.
 * @returns {VideoChunk}
 */
export function VideoChunkModel(videoId, src) {
    const model = {
        type   : 'video',
        videoId: videoId,
        src    : src,
        text   : '', // 비텍스트 청크
        style  : {} // 스타일 미적용
    };
    // ⚠️ 얕은 동결(Shallow Freeze)
    return Object.freeze(model);
}
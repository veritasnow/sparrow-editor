/**
 * VideoChunk Entity 모델을 생성하여 반환합니다. 
 * @param {string} videoId - 동영상의 고유 ID (예: YouTube ID).
 * @param {string} src - 동영상 임베드 URL.
 * @returns {Readonly<Object>} VideoChunk
 */
export function createVideoChunk(videoId, src) {
    // 필수 값 검증 (바닐라 JS에서 안정성을 높여줍니다)
    if (!videoId || !src) {
        throw new Error('VideoChunk를 생성하려면 videoId와 src가 필요합니다.');
    }

    const model = {
        type   : 'video',
        videoId: videoId,
        src    : src,
        text   : '', // 비텍스트 청크
        style  : Object.freeze({}) // 1️⃣ 내부 객체도 동결하여 얕은 동결 문제 해결
    };

    // 2️⃣ 전체 모델 동결 및 반환
    return Object.freeze(model);
}
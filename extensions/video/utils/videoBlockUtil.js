// extensions/video/utils/videoBlockUtil.js
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

export function applyVideoBlock(areaState, videoId, currentLineIndex, cursorOffset) {
    const currentLine = areaState[currentLineIndex];
    if (!currentLine) return { newState: areaState };

    const videoHandler = chunkRegistry.get('video');
    const textHandler = chunkRegistry.get('text');
    
    // 1. 비디오 청크 생성
    const videoChunk = videoHandler.create(videoId, `https://www.youtube.com/embed/${videoId}`);
    
    // 2. 커서 기준으로 청크 분리
    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);

    // 3. [최적화] filter 대신 플래그 기반 유효성 검사 (Garbage Collection 감소)
    const hasValidBefore = beforeChunks.length > 0 && 
        (beforeChunks.length > 1 || beforeChunks[0].type !== 'text' || beforeChunks[0].text !== '');
    
    const hasValidAfter = afterChunks.length > 0 && 
        (afterChunks.length > 1 || afterChunks[0].type !== 'text' || afterChunks[0].text !== '');

    const finalBefore = hasValidBefore ? beforeChunks : [];
    
    // 비디오 뒤에 텍스트 입력이 가능하도록 빈 텍스트 청크 보장
    const finalAfter = hasValidAfter ? afterChunks : [textHandler.create('', { fontSize: '14px' })];

    // 4. 새로운 chunks 조합 및 정렬 결정
    const mergedChunks = [...finalBefore, videoChunk, ...finalAfter];
    
    // 비디오만 단독 삽입되는 경우(앞에 없고 뒤가 빈 텍스트) 중앙 정렬
    const newAlign = (!hasValidBefore && finalAfter.length === 1 && finalAfter[0].text === '') 
                    ? 'center' 
                    : currentLine.align;

    // 5. [최적화] 얕은 복사 후 해당 라인만 교체
    const newState = [...areaState];
    newState[currentLineIndex] = EditorLineModel(newAlign, mergedChunks);

    return {
        newState,
        restoreLineIndex: currentLineIndex,
        restoreChunkIndex: finalBefore.length + 1, // 비디오 바로 다음 인덱스
        restoreOffset: 0
    };
}

/**
 * 🔍 유튜브 URL에서 videoId 추출 최적화
 * - 정규식에 'g' 플래그를 빼고, 비포획 그룹을 활용하여 매칭 속도 개선
 */
export function extractYouTubeId(url) {
    if (!url) return null;
    const regExp = /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/)|youtu\.be\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return (match && match[1]) ? match[1] : null;
}
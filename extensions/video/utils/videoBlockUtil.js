// extensions/video/utils/videoBlockUtil.js
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

export function applyVideoBlock(areaState, videoId, currentLineIndex, cursorOffset) {
    const newState = [...areaState];
    const currentLine = areaState[currentLineIndex];
    if (!currentLine) return { newState: areaState };

    const videoHandler = chunkRegistry.get('video');
    const textHandler = chunkRegistry.get('text'); // 텍스트 핸들러 추가
    const videoChunk = videoHandler.create(videoId, `https://www.youtube.com/embed/${videoId}`);
    
    // 1. 커서 기준으로 청크 분리
    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);

    // 2. 불필요한 빈 청크 정리
    const cleanBefore = beforeChunks.filter(c => c.type !== 'text' || c.text !== '');
    const cleanAfter = afterChunks.filter(c => c.type !== 'text' || c.text !== '');

    // 💡 핵심: 비디오 바로 뒤에 커서가 올 수 있도록 빈 텍스트 청크 하나를 보장
    if (cleanAfter.length === 0) {
        cleanAfter.push(textHandler.create('', { fontSize: '14px' }));
    }

    // 3. 새로운 chunks 조합
    const mergedChunks = [...cleanBefore, videoChunk, ...cleanAfter];
    
    // 비디오만 단독 삽입되는 경우 중앙 정렬 시도
    const newAlign = (cleanBefore.length === 0 && cleanAfter.length === 1 && cleanAfter[0].text === '') 
                     ? 'center' 
                     : currentLine.align;

    newState[currentLineIndex] = EditorLineModel(newAlign, mergedChunks);

    // 4. 복구 위치: 비디오 바로 다음(텍스트 청크의 시작점)
    const targetChunkIndex = cleanBefore.length + 1;

    return {
        newState,
        restoreLineIndex: currentLineIndex,
        restoreChunkIndex: targetChunkIndex,
        restoreOffset: 0
    };
}

/**
 * 🔍 유튜브 URL에서 videoId 추출 (기존과 동일)
 */
export function extractYouTubeId(url) {
    const regExp = /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : null;
}
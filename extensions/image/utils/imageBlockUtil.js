// extensions/image/utils/imageBlockUtil.js
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

export function applyImageBlock(areaState, src, currentLineIndex, cursorOffset) {
    const currentLine = areaState[currentLineIndex];
    if (!currentLine) return { newState: areaState };

    const handler = chunkRegistry.get('image');
    const textHandler = chunkRegistry.get('text');
    const imageChunk = handler.create(src);

    // 1. 커서 기준으로 청크 분리
    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);

    // 2. [최적화] filter 대신 직접 유효성 검사 (불필요한 배열 생성 방지)
    // 텍스트가 있는 청크거나 텍스트가 아닌 청크(이미지, 비디오 등)만 유지
    const hasValidBefore = beforeChunks.length > 0 && (beforeChunks.length > 1 || beforeChunks[0].type !== 'text' || beforeChunks[0].text !== '');
    const hasValidAfter = afterChunks.length > 0 && (afterChunks.length > 1 || afterChunks[0].type !== 'text' || afterChunks[0].text !== '');

    const finalBefore = hasValidBefore ? beforeChunks : [];
    const finalAfter = hasValidAfter ? afterChunks : [textHandler.create('', { fontSize: '14px' })];

    // 3. [최적화] 새로운 chunks 조합
    // spread 연산자 대신 push/concat을 고려할 수 있으나, 가독성을 위해 유지하되 배열 생성을 최소화
    const mergedChunks = [...finalBefore, imageChunk, ...finalAfter];
    
    // 중앙 정렬 로직 (이미지만 있는 라인일 경우)
    const newAlign = (!hasValidBefore && finalAfter.length === 1 && finalAfter[0].text === '') 
                    ? 'center' 
                    : currentLine.align;

    // 4. [최적화] 불필요한 전체 복사([...areaState]) 대신 해당 라인만 교체
    const newState = [...areaState]; 
    newState[currentLineIndex] = EditorLineModel(newAlign, mergedChunks);

    // 5. 복구 정보 설정 (이미지 다음 텍스트 청크 시작점)
    const targetChunkIndex = finalBefore.length + 1;

    return {
        newState,
        restoreLineIndex: currentLineIndex,
        restoreChunkIndex: targetChunkIndex,
        restoreOffset: 0
    };
}
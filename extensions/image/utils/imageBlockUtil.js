import { EditorLineModel } from '../../../model/editorLineModel.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';


export function applyImageBlock(editorState, src, currentLineIndex, cursorOffset) {
    const newState = [...editorState];
    const currentLine = editorState[currentLineIndex];

    const handler = chunkRegistry.get('image');
    const textHandler = chunkRegistry.get('text');
    const imageChunk = handler.create(src);

    // 1. 커서 기준으로 청크 분리
    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);

    // 2. 불필요한 빈 텍스트 청크 필터링 (청소)
    const cleanBefore = beforeChunks.filter(c => c.type !== 'text' || c.text !== '');
    const cleanAfter = afterChunks.filter(c => c.type !== 'text' || c.text !== '');

    // [핵심] 이미지 뒤에 글을 쓸 수 있도록 빈 텍스트 청크 하나 보장
    if (cleanAfter.length === 0) {
        cleanAfter.push(textHandler.create('', { fontSize: '14px' }));
    }

    // 3. 새로운 chunks 조합 (인덱스 변화 없음)
    const mergedChunks = [...cleanBefore, imageChunk, ...cleanAfter];
    
    // 이미지만 단독인 경우 중앙 정렬, 내용이 섞여있으면 기존 정렬 유지
    const newAlign = (cleanBefore.length === 0 && cleanAfter.length === 1 && cleanAfter[0].text === '') 
                     ? 'center' 
                     : currentLine.align;

    newState[currentLineIndex] = EditorLineModel(newAlign, mergedChunks);

    // 4. 커서 위치: 이미지 바로 다음 청크의 시작점
    const targetChunkIndex = cleanBefore.length + 1;

    return {
        newState,
        restoreLineIndex: currentLineIndex, // 🚩 늘 currentLineIndex를 반환하여 인덱스 유지
        restoreChunkIndex: targetChunkIndex,
        restoreOffset: 0
    };
}
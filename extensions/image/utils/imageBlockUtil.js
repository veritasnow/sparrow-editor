import { EditorLineModel } from '../../../model/editorLineModel.js';
import { DEFAULT_LINE_STYLE } from '../../../constants/styleConstants.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';


export function applyImageBlock(editorState, src, currentLineIndex, cursorOffset) {
    const newState = [...editorState];
    const currentLine = editorState[currentLineIndex];

    const handler = chunkRegistry.get('image');
    const textHandler = chunkRegistry.get('text');
    const imageChunk = handler.create(src);

    // 1. 현재 커서 위치를 기준으로 청크 분리
    // (앞서 수정한 splitLineChunks를 사용하여 불필요한 빈 청크 생성을 억제함)
    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);

    // 유틸리티: 청크 배열이 실질적으로 비어있는지 확인 (단순 빈 문자열 청크 포함)
    const isEffectivelyEmpty = (chunks) => 
        chunks.length === 0 || (chunks.length === 1 && chunks[0].type === 'text' && chunks[0].text === '');

    // ---------------------------------------------------
    // Case 1) 빈 줄 → 블록 이미지로 삽입
    // ---------------------------------------------------
    if (isEffectivelyEmpty(beforeChunks) && isEffectivelyEmpty(afterChunks)) {
        // 현재 줄은 이미지만 깔끔하게 (앞뒤 공백 제거)
        newState[currentLineIndex] = EditorLineModel('center', [imageChunk]);

        // 다음 줄에 빈 입력 필드 생성
        const nextLine = EditorLineModel(DEFAULT_LINE_STYLE.align, [
            textHandler.create('', {})
        ]);
        newState.splice(currentLineIndex + 1, 0, nextLine);

        return {
            newState,
            restoreLineIndex: currentLineIndex + 1,
            restoreChunkIndex: 0,
            restoreOffset: 0
        };
    }

    // ---------------------------------------------------
    // Case 2) 텍스트 사이 → 인라인 이미지로 삽입
    // ---------------------------------------------------
    
    // 삽입 전 정규화: 앞뒤의 불필요한 빈 텍스트 청크 필터링
    const cleanBefore = beforeChunks.filter(c => c.type !== 'text' || c.text !== '');
    const cleanAfter = afterChunks.filter(c => c.type !== 'text' || c.text !== '');

    // 만약 이미지 삽입 후 뒤에 아무것도 없다면 입력을 위해 빈 청크 하나 확보
    if (cleanAfter.length === 0) {
        cleanAfter.push(textHandler.create('', {}));
    }

    const mergedChunks = [...cleanBefore, imageChunk, ...cleanAfter];
    newState[currentLineIndex] = EditorLineModel(currentLine.align, mergedChunks);

    // 커서 위치: 이미지가 삽입된 인덱스(cleanBefore.length) 바로 다음(+1)
    const targetChunkIndex = cleanBefore.length + 1;

    return {
        newState,
        restoreLineIndex: currentLineIndex,
        restoreChunkIndex: targetChunkIndex,
        restoreOffset: 0
    };
}
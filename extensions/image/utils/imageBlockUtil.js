import { EditorLineModel } from '../../../model/editorLineModel.js';
import { DEFAULT_LINE_STYLE } from '../../../constants/styleConstants.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

export function applyImageBlock(editorState, src, currentLineIndex, cursorOffset) {
    const newState = [...editorState];
    const currentLine = editorState[currentLineIndex];

    const handler = chunkRegistry.get('image');
    const imageChunk = handler.create(src);

    // 1. 현재 커서 위치(offset)를 기준으로 청크 배열을 쪼갬
    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);

    // ---------------------------------------------------
    // Case 1) 빈 줄 → 블록 이미지로 삽입
    // ---------------------------------------------------
    const isEmptyLine =
        beforeChunks.length === 0 &&
        (afterChunks.length === 0 || (afterChunks.length === 1 && afterChunks[0].type === 'text' && afterChunks[0].text === ''));

    if (isEmptyLine) {
        const newLine = EditorLineModel('center', [imageChunk]);
        newState[currentLineIndex] = newLine;

        // 다음 줄 생성
        const textHandler = chunkRegistry.get('text');
        const nextLine = EditorLineModel(DEFAULT_LINE_STYLE.align, [
            textHandler.create('', {})
        ]);
        newState.splice(currentLineIndex + 1, 0, nextLine);

        return {
            newState,
            restoreLineIndex: currentLineIndex + 1,
            restoreChunkIndex: 0, // 다음 줄은 새 줄이므로 첫 번째 청크(0)가 맞음
            restoreOffset: 0
        };
    }

    // ---------------------------------------------------
    // Case 2) 텍스트 사이 → 인라인 이미지로 삽입
    // ---------------------------------------------------
    // 새로운 청크 배열 구성: [이전 청크들] + [이미지] + [이후 청크들]
    const mergedChunks = [...beforeChunks, imageChunk, ...afterChunks];
    const newLine = EditorLineModel(currentLine.align, mergedChunks);
    newState[currentLineIndex] = newLine;

    /**
     * 핵심 로직: 커서 위치 결정
     * 이미지가 mergedChunks의 beforeChunks.length 인덱스에 삽입됨.
     * 커서를 이미지 바로 뒤에 붙이려면 index는 beforeChunks.length + 1이 되어야 함.
     */
    let targetChunkIndex = beforeChunks.length + 1;
    let targetOffset = 0;

    // 만약 이미지 뒤에 청크가 없다면(라인 끝에 삽입), 
    // 방금 넣은 이미지 청크 자체를 가리키거나 빈 텍스트 청크를 추가해야 함
    if (targetChunkIndex >= mergedChunks.length) {
        // 안전을 위해 라인 끝에 빈 텍스트 청크 하나를 밀어넣어 커서 자리를 확보할 수도 있음
        const textHandler = chunkRegistry.get('text');
        mergedChunks.push(textHandler.create('', {}));
        targetChunkIndex = mergedChunks.length - 1; 
        targetOffset = 0;
    }

    return {
        newState,
        restoreLineIndex: currentLineIndex,
        restoreChunkIndex: targetChunkIndex, // 동적으로 계산된 인덱스
        restoreOffset: targetOffset
    };
}
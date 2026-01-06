// extensions/table/utils/tableBlockUtil.js
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { DEFAULT_LINE_STYLE } from '../../../constants/styleConstants.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

export function applyTableBlock(editorState, rows, cols, currentLineIndex, cursorOffset) {
    const newState = [...editorState];
    const currentLine = editorState[currentLineIndex];

    const tableHandler = chunkRegistry.get('table');
    const textHandler = chunkRegistry.get('text');
    const tableChunk = tableHandler.create(rows, cols);

    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);

    // 헬퍼: 실제 내용이 없는 빈 줄인지 확인
    const isEmpty = (chunks) => chunks.length === 0 || (chunks.length === 1 && chunks[0].type === 'text' && chunks[0].text === '');

    // 1) 빈 줄에 삽입하는 경우: 현재 줄을 테이블로 바꾸고 다음 줄에 빈 입력줄 추가
    if (isEmpty(beforeChunks) && isEmpty(afterChunks)) {
        newState[currentLineIndex] = EditorLineModel('left', [tableChunk]);

        const nextLine = EditorLineModel(DEFAULT_LINE_STYLE.align, [textHandler.create('', {})]);
        newState.splice(currentLineIndex + 1, 0, nextLine);

        return {
            newState,
            restoreLineIndex: currentLineIndex + 1,
            restoreChunkIndex: 0,
            restoreOffset: 0
        };
    }

    // 2) 텍스트 사이에 삽입하는 경우: 인라인 블록처럼 동작
    const cleanBefore = beforeChunks.filter(c => c.type !== 'text' || c.text !== '');
    const cleanAfter = afterChunks.filter(c => c.type !== 'text' || c.text !== '');

    // 뒤쪽이 비어있다면 입력을 위한 빈 텍스트 청크 확보
    if (cleanAfter.length === 0) {
        cleanAfter.push(textHandler.create('', {}));
    }

    const mergedChunks = [...cleanBefore, tableChunk, ...cleanAfter];
    newState[currentLineIndex] = EditorLineModel(currentLine.align, mergedChunks);

    // 커서 위치: 테이블(tableChunk) 바로 다음 청크의 시작점
    const targetChunkIndex = cleanBefore.length + 1;

    return {
        newState,
        restoreLineIndex: currentLineIndex,
        restoreChunkIndex: targetChunkIndex,
        restoreOffset: 0
    };
}
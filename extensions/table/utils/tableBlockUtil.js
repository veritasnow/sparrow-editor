// extensions/table/utils/tableBlockUtil.js
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

export function applyTableBlock(editorState, rows, cols, currentLineIndex, cursorOffset) {
    const currentLine = editorState[currentLineIndex];
    if (!currentLine) return { newState: editorState };

    const tableHandler = chunkRegistry.get('table');
    const textHandler = chunkRegistry.get('text');
    
    // 1. 테이블 청크 생성
    const tableChunk = tableHandler.create(rows, cols);

    // 2. 커서 위치 기준으로 기존 라인의 청크 분리
    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);

    // 3. [최적화] 불필요한 filter 대신 유효성 검사
    const hasValidBefore = beforeChunks.length > 0 && 
        (beforeChunks.length > 1 || beforeChunks[0].type !== 'text' || beforeChunks[0].text !== '');
    
    const hasValidAfter = afterChunks.length > 0 && 
        (afterChunks.length > 1 || afterChunks[0].type !== 'text' || afterChunks[0].text !== '');

    const finalBefore = hasValidBefore ? beforeChunks : [];
    
    // 테이블 바로 뒤에 커서가 위치할 수 있도록 빈 텍스트 청크 보장 (개행 대신 청크 추가)
    const finalAfter = hasValidAfter ? afterChunks : [textHandler.create('', {})];

    // 4. 새로운 chunks 조합 (이미지/비디오와 동일한 Inline-Block 방식)
    const mergedChunks = [...finalBefore, tableChunk, ...finalAfter];
    
    // 5. 상태 업데이트 (해당 라인만 교체)
    const newState = [...editorState];
    newState[currentLineIndex] = EditorLineModel(currentLine.align, mergedChunks);

    // 6. 복구 정보 설정 (테이블 바로 다음 청크의 시작점)
    const targetChunkIndex = finalBefore.length + 1;

    return {
        newState,
        tableChunk,
        restoreLineIndex: currentLineIndex,
        restoreChunkIndex: targetChunkIndex,
        restoreOffset: 0
    };
}
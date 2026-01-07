// extensions/table/utils/tableBlockUtil.js
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

export function applyTableBlock(editorState, rows, cols, currentLineIndex, cursorOffset) {
    const newState = [...editorState];
    const currentLine = editorState[currentLineIndex];

    const tableHandler = chunkRegistry.get('table');
    const textHandler = chunkRegistry.get('text');
    
    // 1. 테이블 청크 생성
    const tableChunk = tableHandler.create(rows, cols);

    // 2. 커서 위치 기준으로 청크 분리
    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);

    // 3. 청크 정제 (불필요한 빈 청크 제거)
    const cleanBefore = beforeChunks.filter(c => c.type !== 'text' || c.text !== '');
    const cleanAfter = afterChunks.filter(c => c.type !== 'text' || c.text !== '');

    // [핵심] 테이블 삽입 후 바로 타이핑할 수 있도록 뒤에 빈 텍스트 청크 보장
    if (cleanAfter.length === 0) {
        cleanAfter.push(textHandler.create('', { fontSize: '14px' }));
    }

    // 4. 새로운 chunks 조합 (인덱스 변화 없음)
    const mergedChunks = [...cleanBefore, tableChunk, ...cleanAfter];
    
    // 5. 상태 업데이트
    // 테이블은 보통 가로를 다 차지하므로, 앞에 내용이 없으면 좌측 정렬(기본) 혹은 
    // 에디터 정책에 따라 설정 (여기서는 기존 정렬 유지)
    newState[currentLineIndex] = EditorLineModel(currentLine.align, mergedChunks);

    // 6. 커서 위치: 테이블 바로 뒤의 텍스트 청크 시작점
    const targetChunkIndex = cleanBefore.length + 1;

    return {
        newState,
        restoreLineIndex: currentLineIndex, // 🚩 라인 인덱스 고정
        restoreChunkIndex: targetChunkIndex,
        restoreOffset: 0
    };
}
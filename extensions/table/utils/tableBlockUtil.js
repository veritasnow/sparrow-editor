// extensions/table/utils/tableBlockUtil.js
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

export function applyTableBlock(editorState, rows, cols, currentLineIndex, cursorOffset) {
    const currentLine = editorState[currentLineIndex];
    if (!currentLine) return { newState: editorState };

    const tableHandler = chunkRegistry.get('table');
    //const textHandler = chunkRegistry.get('text');
    
    // 1. 테이블 청크 생성
    const tableChunk = tableHandler.create(rows, cols);

    // 2. 커서 위치 기준으로 기존 라인 분리
    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);

    // 3. 유효성 검사 (내용이 있는지 확인)
    const hasBeforeContent = beforeChunks.some(c => c.type !== 'text' || c.text.trim() !== '');
    //const hasAfterContent = afterChunks.some(c => c.type !== 'text' || c.text.trim() !== '');

    const newState = [...editorState];
    const insertedLines = [];

    // [Step A] 테이블 앞부분 처리
    if (hasBeforeContent) {
        // 앞에 내용이 있으면 기존 라인 유지
        insertedLines.push(EditorLineModel(currentLine.align, beforeChunks));
    } else {
        // 내용이 없더라도 구조 유지를 위해 빈 라인 하나를 보장할 수 있음 (선택 사항)
    }

    // [Step B] 테이블 전용 라인 (독립된 행으로 삽입)
    insertedLines.push(EditorLineModel(currentLine.align, [tableChunk]));

    // [Step C] 테이블 뒷부분 처리 (커서가 갈 곳)
    // 테이블 뒤에는 항상 글을 쓸 수 있는 빈 텍스트 라인을 하나 생성해줍니다.
    //const finalAfter = hasAfterContent ? afterChunks : [textHandler.create('', {})];
    //insertedLines.push(EditorLineModel(currentLine.align, finalAfter));

    // 4. 기존 라인 하나를 제거하고 쪼개진 2~3개의 라인을 삽입
    newState.splice(currentLineIndex, 1, ...insertedLines);

    // 5. 복구 정보 설정
    // 테이블이 들어간 라인(혹은 그 전 라인) 이후의 "뒷부분" 라인 인덱스 계산
    const restoreLineIndex = hasBeforeContent ? currentLineIndex + 2 : currentLineIndex + 1;

    return {
        newState,
        tableChunk,
        restoreLineIndex, // 테이블 다음 라인으로 커서 이동
        restoreChunkIndex: 0,
        restoreOffset: 0
    };
}
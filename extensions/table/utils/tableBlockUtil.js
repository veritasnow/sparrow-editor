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
    // 💡 팁: tableHandler.create 내부에서 각 셀(td)에 
    // `cell-${Date.now()}-${r}-${c}` 같은 고유 ID를 부여하도록 구현하세요.
    const tableChunk = tableHandler.create(rows, cols);

    // 2. 커서 위치 기준으로 기존 라인의 청크 분리
    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);

    // 3. 청크 정제
    const cleanBefore = beforeChunks.filter(c => c.type !== 'text' || c.text !== '');
    const cleanAfter = afterChunks.filter(c => c.type !== 'text' || c.text !== '');

    /**
     * 💡 개선 포인트: 테이블을 독립적인 라인으로 분리 (Blockify)
     * 테이블이 텍스트 중간에 끼어들면 편집이 어려우므로 3개의 라인으로 나눕니다.
     * [이전 텍스트 라인]
     * [테이블 라인]
     * [이후 텍스트 라인]
     */
    
    const tableLine = EditorLineModel(currentLine.align, [tableChunk]);
    const afterLine = EditorLineModel(currentLine.align, 
        cleanAfter.length > 0 ? cleanAfter : [textHandler.create('', {})]
    );

    // 4. 상태 업데이트 (기존 라인을 쪼개서 중간에 테이블 삽입)
    if (cleanBefore.length === 0) {
        // 라인 맨 앞에서 삽입 시: 현재 줄을 테이블 줄로 바꾸고 뒤에 빈 줄 추가
        newState.splice(currentLineIndex, 1, tableLine, afterLine);
    } else {
        // 라인 중간에서 삽입 시: 현재 줄(앞부분), 테이블 줄, 뒷부분 줄 총 3개로 분리
        const beforeLine = EditorLineModel(currentLine.align, cleanBefore);
        newState.splice(currentLineIndex, 1, beforeLine, tableLine, afterLine);
    }

    // 5. 커서 위치 결정
    // 테이블 바로 다음 줄(afterLine)의 첫 번째 청크 시작점으로 보냅니다.
    const restoreLineIndex = (cleanBefore.length === 0) ? currentLineIndex + 1 : currentLineIndex + 2;

    return {
        newState,
        tableChunk, // 🚩 중요: Service에서 셀 ID들을 추출할 수 있도록 청크 객체 전달
        restoreLineIndex,
        restoreChunkIndex: 0,
        restoreOffset: 0
    };
}
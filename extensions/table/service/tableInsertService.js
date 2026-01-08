// extensions/table/service/tableInsertService.js
import { applyTableBlock } from '../utils/tableBlockUtil.js';

export function createTableInsertService(stateAPI, uiAPI) {
    function insertTable(rows, cols, cursorPos) {
        if (!rows || !cols) return false;

        const editorState = stateAPI.get();

        // 1. 위치 결정 로직: 외부 주입 좌표 -> 없으면 마지막 유효 좌표 -> 없으면 문서 맨 끝
        let pos = cursorPos || uiAPI.getLastValidPosition();

        if (!pos) {
            const lastLineIdx = Math.max(0, editorState.length - 1);
            const lastLine = editorState[lastLineIdx];
            pos = {
                lineIndex: lastLineIdx,
                absoluteOffset: lastLine?.chunks.reduce((sum, c) => sum + (c.text?.length || 0), 0) || 0
            };
        }

        const { lineIndex, absoluteOffset } = pos;

        // 2. 상태 계산 (테이블 생성 및 삽입 위치 계산)
        // applyTableBlock 내부에서도 이제 absoluteOffset을 사용하도록 맞춰야 합니다.
        const { newState, restoreLineIndex, restoreChunkIndex, restoreOffset } =
            applyTableBlock(editorState, rows, cols, lineIndex, absoluteOffset);

        // 3. 상태 저장
        stateAPI.save(newState);

        // 4. 커서 위치 객체 생성 (이미지 서비스와 동일한 규격)
        const nextCursorPos = {
            lineIndex: restoreLineIndex,
            anchor: {
                chunkIndex: restoreChunkIndex,
                type: 'text',
                offset: restoreOffset
            }
        };

        stateAPI.saveCursor(nextCursorPos);

        // 5. UI 렌더링: 변경된 줄과 커서가 이동할 줄 모두 갱신
        uiAPI.renderLine(lineIndex, newState[lineIndex]);
        
        if (restoreLineIndex !== lineIndex && newState[restoreLineIndex]) {
            uiAPI.renderLine(restoreLineIndex, newState[restoreLineIndex]);
        }

        // 6. 실제 DOM 커서 복원
        uiAPI.restoreCursor(nextCursorPos);

        return true;
    }

    return { insertTable };
}
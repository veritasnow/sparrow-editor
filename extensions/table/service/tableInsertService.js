// extensions/table/service/tableInsertService.js
import { applyTableBlock } from '../utils/tableBlockUtil.js';
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { TextChunkModel } from '../../../model/editorModel.js';
import { DEFAULT_TEXT_STYLE } from '../../../constants/styleConstants.js';

export function createTableInsertService(stateAPI, uiAPI) {
    
    function insertTable(rows, cols, cursorPos) {
        if (!rows || !cols) return false;

        // 1. 현재 포커스가 있는 컨테이너 키 획득
        const activeKey = uiAPI.getActiveKey() || uiAPI.getLastActiveKey();
        const editorState = stateAPI.get(activeKey);

        // 2. 위치 결정
        let pos = cursorPos || uiAPI.getLastValidPosition();
        if (!pos) {
            const lastLineIdx = Math.max(0, editorState.length - 1);
            pos = {
                lineIndex: lastLineIdx,
                absoluteOffset: editorState[lastLineIdx]?.chunks.reduce((sum, c) => sum + (c.text?.length || 0), 0) || 0
            };
        }

        const { lineIndex, absoluteOffset } = pos;

        // 3. 상태 계산 (테이블 청크 및 새로운 라인 배열 생성)
        const { newState, restoreLineIndex, restoreChunkIndex, restoreOffset, tableChunk } =
            applyTableBlock(editorState, rows, cols, lineIndex, absoluteOffset);

        // 4. 🔥 [핵심] 각 셀의 ID를 State 엔진에 개별 컨테이너로 등록
        tableChunk.data.forEach(row => {
            row.forEach(cell => {
                // 셀 내부의 초기 데이터는 빈 텍스트 라인 하나
                stateAPI.save(cell.id, [
                    EditorLineModel('left', [
                        TextChunkModel('text', '', { ...DEFAULT_TEXT_STYLE })
                    ])
                ]);
            });
        });

        // 5. 부모 컨테이너 상태 업데이트
        stateAPI.save(activeKey, newState);

        // 6. 커서 위치 정보 구성
        const nextCursorPos = {
            containerId: activeKey, 
            lineIndex: restoreLineIndex,
            anchor: {
                chunkIndex: restoreChunkIndex,
                type: 'text',
                offset: restoreOffset
            }
        };
        stateAPI.saveCursor(nextCursorPos);

        // 7. UI 렌더링
        uiAPI.renderLine(lineIndex, newState[lineIndex], activeKey);
        if (restoreLineIndex !== lineIndex && newState[restoreLineIndex]) {
            uiAPI.renderLine(restoreLineIndex, newState[restoreLineIndex], activeKey);
        }

        // 8. 커서 복원 (DOM 렌더링 동기화를 위해 setTimeout 사용)
        setTimeout(() => {
            uiAPI.restoreCursor(nextCursorPos);
        }, 0);

        return true;
    }

    return { insertTable };
}
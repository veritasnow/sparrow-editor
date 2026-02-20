// extensions/table/service/tableInsertService.js
import { applyTableBlock } from '../utils/tableBlockUtil.js';
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { TextChunkModel } from '../../../model/editorModel.js';
import { DEFAULT_TEXT_STYLE } from '../../../constants/styleConstants.js';
import { showEditorAlert } from '../../../core/layout/components/editorModal.js';

/**
 * 테이블 삽입 서비스
 * 테이블 구조를 생성하고 각 셀을 독립적인 상태 저장소에 등록합니다.
 */
export function createTableInsertService(stateAPI, uiAPI, selectionAPI) {
    
    function insertTable(rows, cols, cursorPos) {
        if (!rows || !cols) return false;

        // 1. 현재 타겟팅된 컨테이너(본문 혹은 부모 셀) 확보
        const activeKey = selectionAPI.getActiveKey() || selectionAPI.getLastActiveKey();
        if(!activeKey.includes("list-")) {
            if (!activeKey) return false;

            const editorState = stateAPI.get(activeKey);
            if (!editorState) return false;

            // 2. 삽입 위치 결정
            let pos = cursorPos || selectionAPI.getLastValidPosition();
            if (!pos) {
                const lastLineIdx = Math.max(0, editorState.length - 1);
                pos = {
                    lineIndex     : lastLineIdx,
                    absoluteOffset: editorState[lastLineIdx]?.chunks.reduce((sum, c) => sum + (c.text?.length || 0), 0) || 0
                };
            }

            const { lineIndex, absoluteOffset } = pos;

            // 3. 모델 계산 (새로운 라인 데이터 및 TableChunk 생성)
            // applyTableBlock은 특정 라인을 쪼개서 사이에 테이블을 넣거나, 새 줄을 추가하는 로직을 수행합니다.
            const { newState, restoreLineIndex, restoreChunkIndex, restoreOffset, tableChunk } =
                applyTableBlock(editorState, rows, cols, lineIndex, absoluteOffset);

            // 4. 🔥 [핵심] 각 셀을 독립적인 State 컨테이너로 초기화
            // 테이블 렌더러가 작동하기 전에 상태 저장소에 셀 ID들이 먼저 등록되어 있어야 합니다.
            tableChunk.data.forEach(row => {
                row.forEach(cell => {
                    // 각 셀(cell.id)에 대해 빈 텍스트 라인 하나를 가진 상태 배열을 생성
                    stateAPI.save(cell.id, [
                        EditorLineModel('left', [
                            TextChunkModel('text', '', { ...DEFAULT_TEXT_STYLE })
                        ])
                    ], false);
                });
            });

            // 5. 부모 컨테이너 상태 저장
            stateAPI.save(activeKey, newState);

            // 6. 커서 위치 정보 구성
            const nextCursorPos = {
                containerId: activeKey, 
                lineIndex  : restoreLineIndex,
                anchor: {
                    chunkIndex: restoreChunkIndex,
                    type      : 'text',
                    offset    : restoreOffset
                }
            };
            
            // 히스토리 및 복원용 커서 저장
            stateAPI.saveCursor(nextCursorPos);

            // 7. UI 렌더링
            // 💡 테이블 삽입은 라인 수가 늘어나거나 구조가 크게 변하므로 renderLine보다 
            // 해당 컨테이너 전체를 render하는 것이 DOM 노드 개수 동기화에 훨씬 안전합니다.
            uiAPI.render(newState, activeKey);

            // 8. 커서 복원
            // 💡 테이블은 복잡한 DOM이 생성되는 과정이 있으므로 
            // 브라우저가 렌더링을 마친 후 커서를 잡을 수 있도록 테스크 큐에 넣습니다.
            setTimeout(() => {
                selectionAPI.restoreCursor(nextCursorPos);
            }, 0);
        } else {
            const creatEditorId = selectionAPI.getMainKey();
            showEditorAlert(
                creatEditorId.replace("-content", ""), 
                "글머리 기호에는 테이블 삽입이<br/> 불가능합니다.", 
                "기본 영역 혹은 테이블 안에서만 삽입이 가능합니다."
            );
        }
    }

    return { insertTable };
}
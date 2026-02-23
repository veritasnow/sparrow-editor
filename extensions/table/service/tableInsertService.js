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
        if (!activeKey) return false;
        
        if(!activeKey.includes("list-")) {


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
            //uiAPI.render(newState, activeKey);
            uiAPI.renderLine(lineIndex, newState[lineIndex], { 
                key: activeKey, 
                shouldRenderSub: false 
            });

            // Case 2: 테이블 라인부터 복구 라인까지 새 줄 삽입 및 렌더링
            // applyTableBlock 결과에 따라 lineIndex 이후에 1개 또는 2개의 라인이 추가됨
            for (let i = lineIndex + 1; i <= restoreLineIndex; i++) {
                if (!newState[i]) continue;

                // (A) 물리적 DOM 라인 생성 및 인덱스 동기화
                uiAPI.insertLine(i, newState[i].align, activeKey);

                // (B) 해당 라인 렌더링 (i가 테이블을 포함한 줄이면 하위 셀까지 렌더링)
                const isTableLine = newState[i].chunks.some(c => c.type === 'table');
                uiAPI.renderLine(i, newState[i], { 
                    key: activeKey, 
                    shouldRenderSub: isTableLine // 테이블일 때만 하위 렌더링 true
                });
            }            

            // 8. 커서 복원
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
// extensions/table/service/tableInsertService.js
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { TextChunkModel } from '../../../model/editorModel.js';
import { DEFAULT_TEXT_STYLE } from '../../../constants/styleConstants.js';
import { showEditorAlert } from '../../../core/layout/components/editorModal.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';


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

            const oldLength = editorState.length;
            const newLength = newState.length;
            const diff      = newLength - oldLength; // 늘어난 라인 수 확인

            // (A) 현재 라인 업데이트 (기존 DOM 재활용)
            // 테이블이 포함되었으므로 shouldRenderSub를 true로 설정하여 테이블 내부 렌더링 트리거
            const hasTableInCurrent = newState[lineIndex].chunks.some(c => c.type === 'table');
            uiAPI.renderLine(lineIndex, newState[lineIndex], { 
                key            : activeKey, 
                shouldRenderSub: hasTableInCurrent 
            });

            // (B) 늘어난 라인만큼만 물리적 Insert 실행 (Split 발생 시)
            if (diff > 0) {
                for (let i = 1; i <= diff; i++) {
                    const targetIdx = lineIndex + i;
                    if (!newState[targetIdx]) continue;

                    // 새 물리 노드 생성 및 뒤쪽 인덱스 밀기
                    uiAPI.insertLine(targetIdx, newState[targetIdx].align, activeKey);

                    // 새 라인 내용 렌더링
                    const hasTableInNew = newState[targetIdx].chunks.some(c => c.type === 'table');
                    uiAPI.renderLine(targetIdx, newState[targetIdx], { 
                        key            : activeKey, 
                        shouldRenderSub: hasTableInNew 
                    });
                }
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


function applyTableBlock(editorState, rows, cols, currentLineIndex, cursorOffset) {
    const currentLine = editorState[currentLineIndex];
    if (!currentLine) return { newState: editorState };

    const tableHandler = chunkRegistry.get('table');
    
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
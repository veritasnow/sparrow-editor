
 // extensions/table/service/tableInsertService.js
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { TextChunkModel } from '../../../model/editorModel.js';
import { DEFAULT_TEXT_STYLE } from '../../../constants/styleConstants.js';
import { EditorAlert } from '../../../core/layout/components/EditorAlert.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

/**
 * 테이블 삽입 기능 생성
 * 에디터 인스턴스별 API를 주입받아 사용한다.
 */
export function createTableInsert({ stateAPI, uiAPI, selectionAPI }) {
    function insertTable(rows, cols, cursorPos) {
        if (!rows || !cols) return false;

        // 1. 현재 타겟 컨테이너 확보
        const activeKey =
            selectionAPI.getActiveKey() ||
            selectionAPI.getLastActiveKey();

        if (!activeKey) return false;

        // 글머리 기호 영역에는 테이블 삽입 불가
        if (activeKey.includes('list-')) {
            const editorId = selectionAPI.getMainKey();

            if (editorId) {
                EditorAlert(
                    editorId.replace('-content', ''),
                    '글머리 기호에는 테이블 삽입이<br/> 불가능합니다.',
                    '기본 영역 혹은 테이블 안에서만 삽입이 가능합니다.'
                );
            }

            return false;
        }

        // 2. 현재 상태 가져오기
        const editorState = stateAPI.get(activeKey);

        if (!editorState || editorState.length === 0) return false;

        // 3. 삽입 위치 결정
        let pos = cursorPos || selectionAPI.getLastValidPosition();

        if (!pos) {
            const lastLineIdx = Math.max(0, editorState.length - 1);

            pos = {
                lineIndex: lastLineIdx,
                absoluteOffset:
                    editorState[lastLineIdx]?.chunks.reduce(
                        (sum, chunk) => sum + (chunk.text?.length || 0),
                        0
                    ) || 0
            };
        }

        const { lineIndex, absoluteOffset } = pos;

        // 잘못된 라인 인덱스 방지
        if (
            !Number.isInteger(lineIndex) ||
            lineIndex < 0 ||
            lineIndex >= editorState.length
        ) {
            return false;
        }

        // 4. 새 상태 및 테이블 청크 생성
        const result = buildTableInsertion(
            editorState,
            rows,
            cols,
            lineIndex,
            absoluteOffset
        );

        if (!result?.tableChunk || !result.newState) return false;

        const {
            newState,
            restoreLineIndex,
            restoreChunkIndex,
            restoreOffset,
            tableChunk
        } = result;

        // 5. 각 테이블 셀을 독립적인 상태 컨테이너로 초기화
        tableChunk.data.forEach(row => {
            row.forEach(cell => {
                stateAPI.save(
                    cell.id,
                    [
                        EditorLineModel('left', [
                            TextChunkModel(
                                'text',
                                '',
                                { ...DEFAULT_TEXT_STYLE }
                            )
                        ])
                    ],
                    false
                );
            });
        });

        // 6. 부모 컨테이너 상태 저장
        stateAPI.save(activeKey, newState);

        // 7. 커서 위치 구성 및 저장
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

        // 8. 변경된 라인 렌더링
        const oldLength = editorState.length;
        const newLength = newState.length;
        const diff = newLength - oldLength;

        // 현재 라인 업데이트
        const currentLine = newState[lineIndex];
        if (!currentLine) return false;

        const hasTableInCurrent = currentLine.chunks.some(
            chunk => chunk.type === 'table'
        );

        uiAPI.renderLine(lineIndex, currentLine, {
            key: activeKey,
            shouldRenderSub: hasTableInCurrent
        });

        // 추가된 라인 삽입 및 렌더링
        if (diff > 0) {
            for (let i = 1; i <= diff; i++) {
                const targetIdx = lineIndex + i;
                const targetLine = newState[targetIdx];

                if (!targetLine) continue;

                uiAPI.insertLine(
                    targetIdx,
                    targetLine.align,
                    activeKey
                );

                const hasTableInNew = targetLine.chunks.some(
                    chunk => chunk.type === 'table'
                );

                uiAPI.renderLine(targetIdx, targetLine, {
                    key: activeKey,
                    shouldRenderSub: hasTableInNew
                });
            }
        }

        // 9. 커서 복원
        setTimeout(() => {
            selectionAPI.restoreCursor(nextCursorPos);
        }, 0);

        return true;
    }

    return { insertTable };
}

/**
 * 커서 위치를 기준으로 테이블 청크를 삽입한 새 상태를 계산한다.
 */
function buildTableInsertion(
    editorState,
    rows,
    cols,
    currentLineIndex,
    cursorOffset
) {
    const currentLine = editorState[currentLineIndex];

    if (!currentLine) return null;

    const tableHandler = chunkRegistry.get('table');

    // 1. 테이블 청크 생성
    const tableChunk = tableHandler.create(rows, cols);

    // 2. 커서 위치 기준으로 기존 라인 분리
    const { beforeChunks, afterChunks } = splitLineChunks(
        currentLine.chunks,
        cursorOffset
    );

    // 3. 테이블 앞부분에 유지할 내용이 있는지 확인
    const hasBeforeContent = beforeChunks.some(
        chunk =>
            chunk.type !== 'text' ||
            chunk.text.trim() !== ''
    );

    const newState = [...editorState];
    const insertedLines = [];

    // 4. 테이블 앞 라인 처리
    if (hasBeforeContent) {
        insertedLines.push(
            EditorLineModel(currentLine.align, beforeChunks)
        );
    }

    // 5. 테이블 전용 라인 삽입
    insertedLines.push(
        EditorLineModel(currentLine.align, [tableChunk])
    );

    // 6. 기존 라인을 앞부분 및 테이블 라인으로 교체
    // afterChunks는 기존 로직대로 별도 라인에 삽입하지 않는다.
    newState.splice(
        currentLineIndex,
        1,
        ...insertedLines
    );

    // 7. 테이블 다음 라인으로 커서 이동
    const restoreLineIndex = hasBeforeContent
        ? currentLineIndex + 2
        : currentLineIndex + 1;

    return {
        newState,
        tableChunk,
        restoreLineIndex,
        restoreChunkIndex: 0,
        restoreOffset: 0
    };
}


import { EditorLineModel } from '../../../model/editorLineModel.js';
import { TextChunkModel } from '../../../model/editorModel.js';
import { EditorAlert } from '../../../core/layout/components/EditorAlert.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

/**
 * 리스트 삽입 기능 생성
 */
export function createUnorderedListInsert({
    stateAPI,
    uiAPI,
    selectionAPI
}) {
    function insertUnorderedList() {
        const activeKey = selectionAPI.getActiveKey();

        if (!activeKey) return false;

        if (activeKey === selectionAPI.getMainKey()) {
            const pos = selectionAPI.getLastValidPosition();
            if (!pos) return false;

            const editorState = stateAPI.get(activeKey);
            if (!editorState) return false;

            const { lineIndex, absoluteOffset } = pos;

            const {
                newState,
                listChunk,
                combinedText
            } = buildListInsertion(
                editorState,
                lineIndex,
                absoluteOffset
            );

            if (!listChunk) return false;

            const initialLines = [
                EditorLineModel('left', [
                    TextChunkModel('text', combinedText || '', {})
                ])
            ];

            // 리스트 내부 컨테이너 초기화
            stateAPI.save(listChunk.id, initialLines, false);

            // 부모 컨테이너 상태 저장
            stateAPI.save(activeKey, newState);

            const nextCursorPos = {
                containerId: listChunk.id,
                lineIndex: 0,
                anchor: {
                    chunkIndex: 0,
                    type: 'text',
                    offset: combinedText.length
                }
            };

            stateAPI.saveCursor(nextCursorPos);

            uiAPI.renderLine(lineIndex, newState[lineIndex], {
                key: activeKey,
                shouldRenderSub: true
            });

            setTimeout(() => {
                selectionAPI.restoreCursor(nextCursorPos);
            }, 0);

            return true;
        }

        const editorId = selectionAPI.getMainKey();

        if (editorId) {
            EditorAlert(
                editorId.replace('-content', ''),
                '테이블에는 글머리기호 삽입이<br/> 불가능합니다.',
                '기본 영역에만 삽입이 가능합니다.'
            );
        }

        return false;
    }

    return { insertUnorderedList };
}

/**
 * 리스트 청크를 생성하고 부모 상태를 계산한다.
 */
function buildListInsertion(
    editorState,
    currentLineIndex,
    cursorOffset = 0
) {
    const currentLine = editorState[currentLineIndex];

    if (!currentLine) {
        return {
            newState: editorState,
            listChunk: null,
            combinedText: ''
        };
    }

    const listHandler = chunkRegistry.get('unorderedList');

    // 커서 앞뒤의 텍스트를 합친다.
    const { beforeChunks, afterChunks } = splitLineChunks(
        currentLine.chunks,
        cursorOffset
    );

    const combinedText = [...beforeChunks, ...afterChunks]
        .filter(chunk => chunk.type === 'text')
        .map(chunk => chunk.text)
        .join('')
        .replace(/\u200B/g, '');

    // 리스트 청크 생성
    const listChunk = listHandler.create(1, [combinedText]);

    // 렌더러가 기대하는 데이터 구조 유지
    listChunk.data = [{ index: 0 }];

    const newState = [...editorState];

    newState[currentLineIndex] = EditorLineModel(
        currentLine.align,
        [listChunk]
    );

    return {
        newState,
        listChunk,
        combinedText
    };
}

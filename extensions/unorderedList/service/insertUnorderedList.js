import { EditorLineModel } from '../../../model/editorLineModel.js';
import { TextChunkModel } from '../../../model/editorModel.js';
import { EditorAlert } from '../../../core/layout/components/EditorAlert.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

/**
 * 리스트(ul/li) 삽입 및 전환 서비스
 */
export function insertUnorderedList(stateAPI, uiAPI, selectionAPI) {
    const activeKey = selectionAPI.getActiveKey();

    if (activeKey === selectionAPI.getMainKey()) {
        const pos = selectionAPI.getLastValidPosition();
        if (!pos) return false;

        const editorState = stateAPI.get(activeKey);
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

        const initialLines = [
            EditorLineModel('left', [
                TextChunkModel('text', combinedText || '', {})
            ])
        ];

        stateAPI.save(listChunk.id, initialLines, false);
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

    EditorAlert(
        editorId.replace("-content", ""),
        "테이블에는 글머리기호 삽입이<br/> 불가능합니다.",
        "기본 영역에만 삽입이 가능합니다."
    );

    return false;
}


function buildListInsertion(editorState, currentLineIndex, cursorOffset = 0) {
    const currentLine = editorState[currentLineIndex];
    if (!currentLine) return { newState: editorState, combinedText: "" };

    const listHandler = chunkRegistry.get('unorderedList');

    // 1. 텍스트 추출
    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);
    const combinedText = [...beforeChunks, ...afterChunks]
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('')
        .replace(/\u200B/g, '');

    // 2. 리스트 청크 생성
    const listChunk = listHandler.create(1, [combinedText]);

    // 💡 렌더러가 기대하는 데이터 구조로 일단 초기화 (id는 ul의 id를 기반으로 하거나 규칙 생성)
    // 렌더러에서 li.id = itemData.id 를 쓰므로 id가 필요합니다.
    listChunk.data = [{ 
        //id: `${listChunk.id}-item-0`, // li 요소에 부여될 고유 ID
        //id: `${listChunk.id}-item-0`, // li 요소에 부여될 고유 ID
        index: 0 
    }];

    const newState = [...editorState];
    newState[currentLineIndex] = EditorLineModel(currentLine.align, [listChunk]);

    return {
        newState,
        listChunk,
        combinedText: combinedText || "" // 👈 이게 있어야 length 에러가 안 남
    };
}
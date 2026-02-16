// extensions/list/utils/listBlockUtil.js
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

/**
 * 현재 라인의 내용을 바탕으로 리스트(ul) 블록을 생성
 */
export function applyListBlock(editorState, currentLineIndex, cursorOffset = 0) {
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
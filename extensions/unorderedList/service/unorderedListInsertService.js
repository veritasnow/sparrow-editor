import { EditorLineModel } from '../../../model/editorLineModel.js';
import { TextChunkModel } from '../../../model/editorModel.js';
import { showEditorAlert } from '../../../core/layout/components/editorModal.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

/**
 * 리스트(ul/li) 삽입 및 전환 서비스
 */
export function createUnorderedListInsertService(stateAPI, uiAPI, selectionAPI) {
    function insertUnorderedList() {
        const activeKey = selectionAPI.getActiveKey();

        if(activeKey === selectionAPI.getMainKey()) {
            const pos = selectionAPI.getLastValidPosition();
            if (!pos) return false;

            const editorState = stateAPI.get(activeKey);
            const { lineIndex, absoluteOffset } = pos;

            // 1. 블록 변환 (여기서 반환된 listChunk.data는 [{index: 0}] 처럼 깨끗한 상태)
            const { newState, listChunk, combinedText } = buildListInsertion(editorState, lineIndex, absoluteOffset);

            // 2. 실제 상세 데이터 저장 (별도 키: list-xxx)
            const initialLines = [
                EditorLineModel('left', [
                    TextChunkModel('text', combinedText || '', {})
                ])
            ];
            stateAPI.save(listChunk.id, initialLines, false);

            // 3. 메인 에디터 상태 저장 (순수한 구조만 저장됨!)
            // 💡 중요: listChunk.data[0].line = ... 같은 코드를 수행하기 "전"에 저장하세요.
            stateAPI.save(activeKey, newState);

            // 4. 커서 위치 설정
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

            // 5. 렌더링을 위한 임시 데이터 매핑
            // newState를 직접 건드리지 않기 위해 깊은 복사를 하거나, 
            // 렌더링 시점에만 필요한 정보를 주입합니다.
            const renderState = JSON.parse(JSON.stringify(newState)); // 간단한 깊은 복사
            const targetChunk = renderState[lineIndex].chunks[0];
            
            // 💡 렌더러가 화면을 그릴 수 있게 여기서만 line을 넣어줌
            if (targetChunk && targetChunk.data[0]) {
                targetChunk.data[0].line = initialLines[0];
            }

            // 6. 렌더링 실행 (주입된 renderState 사용)
            uiAPI.renderLine(lineIndex, newState[lineIndex], { 
                key: activeKey, 
                shouldRenderSub: true // 리스트 내부 아이템(initialLines)을 그려야 하므로 true
            });            
            //uiAPI.render(renderState, activeKey);

            setTimeout(() => {
                selectionAPI.restoreCursor(nextCursorPos);
            }, 0);
        } else {
            const creatEditorId = selectionAPI.getMainKey();
            showEditorAlert(
                creatEditorId.replace("-content", ""), 
                "테이블에는 글머리기호 삽입이<br/> 불가능합니다.", 
                "기본 영역에만 삽입이 가능합니다."
            );  
        }

    }
    return { insertUnorderedList };
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
import { applyListBlock } from '../utils/unorderedListBlockUtil.js';
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { TextChunkModel } from '../../../model/editorModel.js';

/**
 * 리스트(ul/li) 삽입 및 전환 서비스
 */
export function createUnorderedListInsertService(stateAPI, uiAPI, selectionAPI) {
    function insertUnorderedList() {
        const activeKey = selectionAPI.getActiveKey() || 'myEditor-content';
        const pos = selectionAPI.getLastValidPosition();
        if (!pos) return false;

        const editorState = stateAPI.get(activeKey);
        const { lineIndex, absoluteOffset } = pos;

        // 1. 블록 변환 (여기서 반환된 listChunk.data는 [{index: 0}] 처럼 깨끗한 상태)
        const { newState, listChunk, combinedText } = applyListBlock(editorState, lineIndex, absoluteOffset);

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
        uiAPI.render(renderState, activeKey);

        setTimeout(() => {
            selectionAPI.restoreCursor(nextCursorPos);
        }, 0);

        return true;
    }
    return { insertUnorderedList };
}
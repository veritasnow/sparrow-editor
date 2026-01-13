// extensions/image/service/imageInsertService.js
import { applyImageBlock } from '../utils/imageBlockUtil.js';

/**
 * 이미지 삽입 서비스
 * 특정 컨테이너(본문/셀) 내에 이미지를 삽입하고 UI를 동기화합니다.
 */
export function createImageInsertService(stateAPI, uiAPI) {
    
    /**
     * @param {string} src - 이미지 소스 URL
     * @param {string|object} targetKeyOrPos - 삽입할 위치의 Key 혹은 구체적인 포지션 객체
     */
    function insertImage(src, targetKeyOrPos) {
        if (!src) return false;

        // 1. 타겟 영역(activeKey) 확보
        // targetKeyOrPos가 문자열(ID)일 수도 있고, 포지션 객체일 수도 있음을 고려
        const activeKey = (typeof targetKeyOrPos === 'string' ? targetKeyOrPos : null) 
                         || uiAPI.getActiveKey() 
                         || uiAPI.getLastActiveKey();
        
        if (!activeKey) return false;

        // 2. 해당 영역의 현재 상태 가져오기
        const areaState = stateAPI.get(activeKey);
        if (!areaState) return false;
        
        // 3. 삽입 위치(Pos) 결정
        let pos = (typeof targetKeyOrPos === 'object' ? targetKeyOrPos : null) 
                  || uiAPI.getLastValidPosition();

        // 위치 정보가 없는 경우 해당 컨테이너의 맨 마지막 라인으로 설정
        if (!pos) {
            const lastLineIdx = Math.max(0, areaState.length - 1);
            const lastLine = areaState[lastLineIdx];
            pos = {
                lineIndex: lastLineIdx,
                // 마지막 청크의 끝 지점을 offset으로 계산
                absoluteOffset: lastLine.chunks.reduce((s, c) => s + (c.text?.length || 0), 0)
            };
        }

        const { lineIndex, absoluteOffset } = pos;

        // 4. 비즈니스 로직 실행 (이미지 블록 생성 및 상태 분리/병합)
        // applyImageBlock은 이미지를 삽입하고 그 뒤에 빈 텍스트 라인을 생성하는 등의 로직을 처리합니다.
        const { newState, restoreLineIndex, restoreChunkIndex, restoreOffset } =
            applyImageBlock(areaState, src, lineIndex, absoluteOffset);

        // 5. 변경된 상태 저장 (해당 영역 Key에 귀속)
        stateAPI.save(activeKey, newState);

        // 6. 복원할 커서 위치 객체 생성
        const nextCursorPos = {
            containerId: activeKey, // 💡 어느 셀/본문인지 명시
            lineIndex: restoreLineIndex,
            anchor: {
                chunkIndex: restoreChunkIndex,
                type: 'text',
                offset: restoreOffset
            }
        };

        // 7. 커서 상태 저장 (Undo용)
        stateAPI.saveCursor(nextCursorPos);
        
        // 8. UI 업데이트 (activeKey 전달이 핵심!)
        // 이미지가 들어간 라인 렌더링
        uiAPI.renderLine(lineIndex, newState[lineIndex], activeKey);
        
        // 이미지가 삽입되면서 새로 생성되거나 변경된 다음 라인(restoreLine)이 있다면 렌더링
        if (restoreLineIndex !== lineIndex && newState[restoreLineIndex]) {
            // 만약 applyImageBlock이 새로운 P 태그를 생성해야 하는 로직을 포함한다면 
            // ui.insertNewLineElement가 필요할 수 있으나, 보통 render(newState, activeKey)로 전체 동기화하는 것이 안전합니다.
            uiAPI.render(newState, activeKey); 
        }

        // 9. 최종 커서 복원
        uiAPI.restoreCursor(nextCursorPos);
        
        return true;
    }

    return { insertImage };
}
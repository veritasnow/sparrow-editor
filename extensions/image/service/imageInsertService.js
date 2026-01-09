// extensions/image/service/imageInsertService.js
import { applyImageBlock } from '../utils/imageBlockUtil.js';

// extensions/image/service/imageInsertService.js
export function createImageInsertService(stateAPI, uiAPI) {
    function insertImage(src, cursorPos) {
        if (!src) return false;

        // 1. 현재 활성화된 영역(본문 혹은 TD)의 Key와 데이터 가져오기
        const activeKey = uiAPI.getLastActiveKey();
        if (!activeKey) return false;
        const areaState = stateAPI.get(activeKey); // 💡 영역별 상태 추출
        
        // 2. 위치 결정 로직
        let pos = cursorPos || uiAPI.getLastValidPosition();
        // 위치 정보가 아예 없는 경우 해당 영역의 맨 마지막 라인 처리
        if (!pos) {
            const lastLineIdx = Math.max(0, areaState.length - 1);
            pos = {
                lineIndex: lastLineIdx,
                absoluteOffset: areaState[lastLineIdx].chunks.reduce((s, c) => s + (c.text?.length || 0), 0)
            };
        }

        const { lineIndex, absoluteOffset } = pos;

        // 3. 상태 계산 (특정 영역 데이터 전달)
        const { newState, restoreLineIndex, restoreChunkIndex, restoreOffset } =
            applyImageBlock(areaState, src, lineIndex, absoluteOffset);

        // 4. 상태 저장 (Key 기반)
        stateAPI.save(activeKey, newState);
        const nextCursorPos = {
            containerId: activeKey, // 💡 컨테이너 정보 포함
            lineIndex: restoreLineIndex,
            anchor: {
                chunkIndex: restoreChunkIndex,
                type: 'text',
                offset: restoreOffset
            }
        };

        // 5. 커서 저장 및 UI 업데이트
        stateAPI.saveCursor(nextCursorPos);
        
        // 해당 라인 렌더링 (uiAPI.renderLine 내부에서 activeKey를 고려한다고 가정)
        uiAPI.renderLine(lineIndex, newState[lineIndex]);
        
        if (restoreLineIndex !== lineIndex && newState[restoreLineIndex]) {
            uiAPI.renderLine(restoreLineIndex, newState[restoreLineIndex]);
        }

        // 6. 커서 복원
        uiAPI.restoreCursor(nextCursorPos);
        return true;
    }

    return { insertImage };
}
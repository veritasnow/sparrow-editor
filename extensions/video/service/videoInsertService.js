// extensions/video/service/videoInsertService.js
import { extractYouTubeId, applyVideoBlock } from '../utils/videoBlockUtil.js';

export function createVideoInsertService(stateAPI, uiAPI, selectionAPI) {
    
    function insertVideo(url, cursorPos) {
        if (!url) {
            alert('유튜브 URL을 입력하세요.');
            return false;
        }

        const videoId = extractYouTubeId(url);
        if (!videoId) {
            alert('올바른 유튜브 URL이 아닙니다.');
            return false;
        }

        const activeKey = selectionAPI.getActiveKey() || selectionAPI.getLastActiveKey();
        if (!activeKey) return false;

        const areaState = stateAPI.get(activeKey);
        if (!areaState) return false;

        // 1. 위치 결정 최적화 (reduce 제거)
        let pos = cursorPos || selectionAPI.getLastValidPosition();
        if (!pos) {
            const lastIdx = Math.max(0, areaState.length - 1);
            const lastLine = areaState[lastIdx];
            let offset = 0;
            if (lastLine) {
                const chunks = lastLine.chunks;
                for (let i = 0; i < chunks.length; i++) {
                    offset += (chunks[i].text?.length || 0);
                }
            }
            pos = { lineIndex: lastIdx, absoluteOffset: offset };
        }

        const { lineIndex, absoluteOffset } = pos;

        // 2. 상태 변경 실행
        const { newState, restoreLineIndex, restoreChunkIndex, restoreOffset } = applyVideoBlock(
            areaState,
            videoId,
            lineIndex,
            absoluteOffset
        );

        // 3. 상태 저장
        stateAPI.save(activeKey, newState);

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
        
        // 4. 🔥 [핵심 최적화] 전체 렌더링 대신 라인 렌더링 사용
        // 비디오(iframe)는 전체 렌더링 시 기존에 재생 중이던 다른 비디오들이 
        // 모두 새로고침되는 치명적인 문제가 있습니다. renderLine으로 해당 줄만 교체합니다.
        uiAPI.renderLine(lineIndex, newState[lineIndex], activeKey);
        
        // 5. 커서 복원 (브라우저 레이아웃 계산 후 실행되도록 rAF 적용)
        requestAnimationFrame(() => {
            selectionAPI.restoreCursor(nextCursorPos);
        });

        return true;
    }

    return { insertVideo };
}
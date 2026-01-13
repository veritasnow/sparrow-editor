// extensions/video/service/videoInsertService.js
import { extractYouTubeId, applyVideoBlock } from '../utils/videoBlockUtil.js';

/**
 * 유튜브 비디오 삽입 서비스
 */
export function createVideoInsertService(stateAPI, uiAPI) {
    
    /**
     * @param {string} url - 유튜브 URL
     * @param {object} cursorPos - 삽입할 구체적 위치 (선택 사항)
     */
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

        // 1. 활성화된 영역(본문 또는 TD)의 Key 확보
        // 💡 포커스가 빠졌을 상황을 대비해 LastActiveKey까지 체크
        const activeKey = uiAPI.getActiveKey() || uiAPI.getLastActiveKey();
        if (!activeKey) return false;

        // 2. 해당 영역 데이터 가져오기
        const areaState = stateAPI.get(activeKey);
        if (!areaState) return false;

        // 3. 위치 결정
        let pos = cursorPos || uiAPI.getLastValidPosition();
        
        if (!pos) {
            const lastIdx = Math.max(0, areaState.length - 1);
            pos = {
                lineIndex: lastIdx,
                absoluteOffset: areaState[lastIdx]?.chunks.reduce((s, c) => s + (c.text?.length || 0), 0) || 0
            };
        }

        const { lineIndex, absoluteOffset } = pos;

        // 4. 상태 변경 (비즈니스 로직 실행)
        const { newState, restoreLineIndex, restoreChunkIndex, restoreOffset } = applyVideoBlock(
            areaState,
            videoId,
            lineIndex,
            absoluteOffset
        );

        // 5. 상태 저장 (Key 기반)
        stateAPI.save(activeKey, newState);

        // 6. 복원할 커서 정보 생성
        const nextCursorPos = {
            containerId: activeKey, // 💡 컨테이너 정보 주입
            lineIndex: restoreLineIndex,
            anchor: {
                chunkIndex: restoreChunkIndex,
                type: 'text',
                offset: restoreOffset
            }
        };

        // 7. 커서 정보 저장 (History 관리용)
        stateAPI.saveCursor(nextCursorPos);
        
        // 8. UI 반영 (activeKey 타겟팅)
        // 💡 비디오 블록은 새로운 라인을 생성하거나 구조를 바꾸므로 전체 render가 안전합니다.
        uiAPI.render(newState, activeKey);
        
        // 9. 커서 최종 복원 (해당 셀 내부로 복귀)
        uiAPI.restoreCursor(nextCursorPos);

        return true;
    }

    return { insertVideo };
}
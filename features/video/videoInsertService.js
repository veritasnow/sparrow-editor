// sparrow-editor\service\video\videoInsertService.js
// 상태 변경 로직
import { extractYouTubeId, applyVideoBlock } from './videoBlockUtil.js';

/**
 * 🎬 비디오 삽입 핵심 로직
 * stateAPI, uiAPI를 통해 상태 변경/커서 이동/렌더링 처리
 */
export function createVideoInsertService(stateAPI, uiAPI) {

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

        const editorState = stateAPI.get();

        // 🔹 저장된 커서 위치 우선 사용, 없으면 getSelectionPosition()
        const pos = cursorPos ?? uiAPI.getSelectionPosition();
        let lineIndex = pos?.lineIndex ?? editorState.length;
        let offset    = pos?.offset ?? 0;

        // 안전 장치: 커서가 상태 범위를 벗어나지 않도록
        if (lineIndex >= editorState.length) {
            lineIndex = Math.max(0, editorState.length - 1);
            offset = editorState[lineIndex]?.chunks.reduce((sum, c) => sum + (c.text?.length || 0), 0) || 0;
        }

        // 상태 변경 위임
        const { newState, restoreLineIndex, restoreOffset } = applyVideoBlock(
            editorState,
            videoId,
            lineIndex,
            offset
        );

        // 상태/커서 저장
        stateAPI.save(newState);
        stateAPI.saveCursor({ lineIndex: restoreLineIndex, offset: restoreOffset });

        // UI 반영
        uiAPI.renderLine(lineIndex, newState[lineIndex]);        
        uiAPI.restoreCursor({ lineIndex: restoreLineIndex, offset: restoreOffset });

        return true;
    }

    return { insertVideo };
}
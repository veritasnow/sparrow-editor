// sparrow-editor\service\video\videoInsertService.js
// 상태 변경 로직
import { extractYouTubeId, applyVideoBlock } from './videoBlockUtil.js';

/**
 * 비디오 삽입의 핵심 비즈니스 로직을 제공하는 서비스/훅 모듈.
 * (DOM에 의존하지 않고, 주입된 콜백을 통해 에디터 상태를 변경합니다.)
 */
export function createVideoInsertService(getEditorState, saveEditorState, updateAndRestore, getSelectionPosition) {

    /**
     * URL을 받아 비디오 블록을 에디터에 삽입하는 메인 핸들러
     * @param {string} url - 입력된 유튜브 URL
     * @returns {boolean} 성공 여부 (UI에서 팝업을 닫을지 결정)
     */
    function insertVideo(url) {
        if (!url) {
            alert('유튜브 URL을 입력하세요.');
            return false;
        }

        const videoId = extractYouTubeId(url);
        if (!videoId) {
            alert('올바른 유튜브 URL이 아닙니다.');
            return false;
        }

        // 🟢 1. 현재 커서 위치 파악 (주입된 콜백 사용)
        const pos = getSelectionPosition();
        
        const editorState = getEditorState();
        let currentLineIndex = (pos && pos.lineIndex !== undefined) ? pos.lineIndex : editorState.length;
        let cursorOffset = (pos && pos.offset !== undefined) ? pos.offset : 0;
        
        // 커서 위치 안전 장치 로직
        if (currentLineIndex >= editorState.length) {
            currentLineIndex = editorState.length > 0 ? editorState.length - 1 : 0;
            cursorOffset = (editorState.length > 0 && editorState[currentLineIndex].chunks.length > 0) ? 
                            editorState[currentLineIndex].chunks.reduce((sum, c) => sum + (c.text?.length || 0), 0) : 0;
        }

        // 🟢 2. 상태 변경 위임 및 적용
        const { newState, restoreLineIndex, restoreOffset } = applyVideoBlock(
            editorState, 
            videoId, 
            currentLineIndex, 
            cursorOffset
        );

        saveEditorState(newState); // 상태 모듈에 저장
        updateAndRestore({ lineIndex: restoreLineIndex, offset: restoreOffset }); // UI 렌더링 요청

        return true;
    }

    return { insertVideo };
}
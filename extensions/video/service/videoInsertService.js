// extensions/video/service/videoInsertService.js

import { extractYouTubeId, applyVideoBlock } from '../utils/videoBlockUtil.js';




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

        // 1. 위치 결정: 주입된 좌표 -> 저장된 마지막 유효 절대 좌표 -> 안전장치(끝 지점)
        let pos = cursorPos || uiAPI.getLastValidPosition();
        
        if (!pos) {
            const lastIdx = Math.max(0, editorState.length - 1);
            pos = {
                lineIndex: lastIdx,
                absoluteOffset: editorState[lastIdx]?.chunks.reduce((s, c) => s + (c.text?.length || 0), 0) || 0
            };
        }

        const { lineIndex, absoluteOffset } = pos;

        // 2. 상태 변경 실행 (절대 오프셋 전달)
        const { newState, restoreLineIndex, restoreChunkIndex, restoreOffset } = applyVideoBlock(
            editorState,
            videoId,
            lineIndex,
            absoluteOffset
        );

        // 3. 상태 저장
        stateAPI.save(newState);

        // 4. 복구용 통합 모델 객체 생성
        const nextCursorPos = {
            lineIndex: restoreLineIndex,
            anchor: {
                chunkIndex: restoreChunkIndex,
                type      : 'text',
                offset    : restoreOffset
            }
        };

        stateAPI.saveCursor(nextCursorPos);

        // 5. UI 반영
        uiAPI.renderLine(lineIndex, newState[lineIndex]);
        if (restoreLineIndex !== lineIndex && newState[restoreLineIndex]) {
            uiAPI.renderLine(restoreLineIndex, newState[restoreLineIndex]);
        }
        
        // 6. 커서 최종 복원
        uiAPI.restoreCursor(nextCursorPos);

        return true;
    }

    return { insertVideo };
}
/* 
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
        // 특정 라인만 렌더링
        if (stateAPI.isLineChanged(lineIndex)) {
            uiAPI.renderLine(lineIndex, newState[lineIndex]);   
        }
        
        uiAPI.restoreCursor({ lineIndex: restoreLineIndex, offset: restoreOffset });

        return true;
    }

    return { insertVideo };
}
*/
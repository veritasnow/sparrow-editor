// extensions/image/service/imageInsertService.js
import { applyImageBlock } from '../utils/imageBlockUtil.js';

// extensions/image/service/imageInsertService.js
export function createImageInsertService(stateAPI, uiAPI) {
    function insertImage(src, cursorPos) {
        if (!src) return false;

        const editorState = stateAPI.get();
        
        // 1. 위치 결정 로직
        // 외부 주입 좌표(cursorPos) -> 없으면 기억된 좌표(getLastValidPosition)
        let pos = cursorPos || uiAPI.getLastValidPosition();
        
        // 만약 둘 다 없다면 최후의 수단으로 맨 마지막 라인 끝
        if (!pos) {
            const lastLineIdx = Math.max(0, editorState.length - 1);
            pos = {
                lineIndex: lastLineIdx,
                absoluteOffset: editorState[lastLineIdx].chunks.reduce((s, c) => s + (c.text?.length || 0), 0)
            };
        }

        const { lineIndex, absoluteOffset } = pos;

        // 2. 상태 계산 (절대 오프셋 기반)
        const { newState, restoreLineIndex, restoreChunkIndex, restoreOffset } =
            applyImageBlock(editorState, src, lineIndex, absoluteOffset);

        // 3. 상태 저장 및 UI 복원
        stateAPI.save(newState);

        const nextCursorPos = {
            lineIndex: restoreLineIndex,
            anchor: {
                chunkIndex: restoreChunkIndex,
                type      : 'text',
                offset    : restoreOffset
            }
        };

        stateAPI.saveCursor(nextCursorPos);
        uiAPI.renderLine(lineIndex, newState[lineIndex]);
        
        // 줄바꿈 대응 렌더링
        if (restoreLineIndex !== lineIndex && newState[restoreLineIndex]) {
            uiAPI.renderLine(restoreLineIndex, newState[restoreLineIndex]);
        }

        uiAPI.restoreCursor(nextCursorPos);
        return true;
    }

    return { insertImage };
}
/*
export function createImageInsertService(stateAPI, uiAPI) {
    function insertImage(src, cursorPos) {
        if (!src) {
            alert('이미지 URL 또는 파일을 선택하세요.');
            return false;
        }

        const editorState = stateAPI.get();
        
        // 1. 통합 커서 포지션 가져오기
        // pos는 { lineIndex, anchor: { chunkIndex, type, offset, detail } } 구조임
        const pos = cursorPos ?? uiAPI.getSelectionPosition();

        let lineIndex = pos?.lineIndex ?? 0;
        let offset = 0;

        // 2. 삽입 지점 결정 (안전 장치 포함)
        if (lineIndex >= editorState.length) {
            lineIndex = Math.max(0, editorState.length - 1);
            // 라인의 끝 오프셋 계산 (상태 기반 길이를 사용)
            const lineData = editorState[lineIndex];
            offset = lineData ? lineData.chunks.reduce((sum, c) => sum + (c.text?.length || 0), 0) : 0;
        } else {
            // 통합 모델의 anchor.offset을 사용하거나, 없으면 0
            offset = pos?.anchor?.offset ?? 0;
        }

        // 3. 비즈니스 로직 실행 (상태 계산)
        // [수정] 이제 restoreChunkIndex를 함께 반환받음
        const { newState, restoreLineIndex, restoreChunkIndex, restoreOffset } =
            applyImageBlock(editorState, src, lineIndex, offset);

        // 4. 상태 저장
        stateAPI.save(newState);

        // 5. 통합 모델 규격으로 커서 포지션 객체 생성
        const nextCursorPos = {
            lineIndex: restoreLineIndex,
            anchor: {
                chunkIndex: restoreChunkIndex,
                type: 'text', // 이미지가 삽입된 후 커서는 텍스트 청크로 가기 때문
                offset: restoreOffset
            }
        };

        // 6. 상태에 커서 정보 저장
        stateAPI.saveCursor(nextCursorPos);

        // 7. UI 반영 (라인 단위 렌더링)
        // 삽입 과정에서 줄이 늘어날 수 있으므로 변경된 인덱스들을 체크
        if (stateAPI.isLineChanged(lineIndex)) {
            uiAPI.renderLine(lineIndex, newState[lineIndex]);
        }
        // 줄바꿈이 발생한 경우(isEmptyLine 케이스) 다음 줄도 렌더링
        if (restoreLineIndex !== lineIndex && newState[restoreLineIndex]) {
            uiAPI.renderLine(restoreLineIndex, newState[restoreLineIndex]);
        }

        // 8. 최종 커서 복원
        uiAPI.restoreCursor(nextCursorPos);

        return true;
    }

    return { insertImage };
}
*/
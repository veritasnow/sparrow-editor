import { EditorLineModel } from '../../../model/editorLineModel.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

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
        const { newState, restoreLineIndex, restoreChunkIndex, restoreOffset } = buildVideoInsertion(
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
        uiAPI.renderLine(lineIndex, newState[lineIndex], { 
            key: activeKey 
        });
        
        // 5. 커서 복원 (브라우저 레이아웃 계산 후 실행되도록 rAF 적용)
        requestAnimationFrame(() => {
            selectionAPI.restoreCursor(nextCursorPos);
        });

        return true;
    }

    return { insertVideo };
}


function buildVideoInsertion(areaState, videoId, currentLineIndex, cursorOffset) {
    const currentLine = areaState[currentLineIndex];
    if (!currentLine) return { newState: areaState };

    const videoHandler = chunkRegistry.get('video');
    const textHandler = chunkRegistry.get('text');
    
    // 1. 비디오 청크 생성
    const videoChunk = videoHandler.create(videoId, `https://www.youtube.com/embed/${videoId}`);
    
    // 2. 커서 기준으로 청크 분리
    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);

    // 3. [최적화] filter 대신 플래그 기반 유효성 검사 (Garbage Collection 감소)
    const hasValidBefore = beforeChunks.length > 0 && 
        (beforeChunks.length > 1 || beforeChunks[0].type !== 'text' || beforeChunks[0].text !== '');
    
    const hasValidAfter = afterChunks.length > 0 && 
        (afterChunks.length > 1 || afterChunks[0].type !== 'text' || afterChunks[0].text !== '');

    const finalBefore = hasValidBefore ? beforeChunks : [];
    
    // 비디오 뒤에 텍스트 입력이 가능하도록 빈 텍스트 청크 보장
    const finalAfter = hasValidAfter ? afterChunks : [textHandler.create('', { fontSize: '14px' })];

    // 4. 새로운 chunks 조합 및 정렬 결정
    const mergedChunks = [...finalBefore, videoChunk, ...finalAfter];
    
    // 비디오만 단독 삽입되는 경우(앞에 없고 뒤가 빈 텍스트) 중앙 정렬
    const newAlign = (!hasValidBefore && finalAfter.length === 1 && finalAfter[0].text === '') 
                    ? 'center' 
                    : currentLine.align;

    // 5. [최적화] 얕은 복사 후 해당 라인만 교체
    const newState = [...areaState];
    newState[currentLineIndex] = EditorLineModel(newAlign, mergedChunks);

    return {
        newState,
        restoreLineIndex: currentLineIndex,
        restoreChunkIndex: finalBefore.length + 1, // 비디오 바로 다음 인덱스
        restoreOffset: 0
    };
}


function extractYouTubeId(url) {
    if (!url) return null;
    const regExp = /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/)|youtu\.be\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return (match && match[1]) ? match[1] : null;
}
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

export function insertImage(src, {stateAPI, uiAPI, selectionAPI}) {
    if (!src) return false;

    // 1. 타겟 영역 확보
    const activeKey = selectionAPI.getActiveKey() || selectionAPI.getLastActiveKey();
    
    if (!activeKey) return false;

    // 2. 상태 가져오기
    const areaState = stateAPI.get(activeKey);
    if (!areaState || areaState.length === 0) {
        return false;
    }
    
    // 3. 삽입 위치 결정
    let pos = selectionAPI.getLastValidPosition();

    if (!pos) {
        const lastLineIdx = Math.max(0, areaState.length - 1);
        pos = {
            lineIndex: lastLineIdx,
            absoluteOffset: areaState[lastLineIdx].chunks.reduce((s, c) => s + (c.text?.length || 0), 0)
        };
    }

    const { lineIndex } = pos;

    // 4. 비즈니스 로직 실행 (이미지 블록 생성)
    const { newState, restoreLineIndex, restoreChunkIndex, restoreOffset } =
        applyImageBlock(areaState, src, lineIndex, pos.absoluteOffset);

    // 5. 변경된 상태 저장
    stateAPI.save(activeKey, newState);

    // 6. UI 업데이트 최적화 시작
    const container = document.getElementById(activeKey);
    if (!container) return false;

    // 🔥 [최적화] 7. DOM 개수 동기화 (이미지 삽입으로 늘어난 라인만큼 미리 DIV/P 생성)
    // uiAPI.render 내부의 syncParagraphCount를 직접 활용하거나 호출합니다.
    uiAPI.syncParagraphCount?.(newState, activeKey);

    // 8. 이미지가 들어간 줄부터 커서가 복원될 줄까지 루프를 돌며 업데이트
    const startUpdateIdx = Math.min(lineIndex, restoreLineIndex);
    const endUpdateIdx = Math.max(lineIndex, restoreLineIndex);

    for (let i = startUpdateIdx; i < newState.length; i++) {
        const lineEl = container.children[i];
        
        // 💡 현재 라인의 테이블 DOM을 미리 확보 (재사용)
        // getElementsByClassName이 querySelectorAll보다 빠름
        const tablePool = lineEl ? Array.from(lineEl.getElementsByClassName('chunk-table')) : [];
        
        // 만약 새로 생성된 라인이면 renderLine이 알아서 새 태그를 만듦
        uiAPI.renderLine(i, newState[i], {
            key : activeKey,
            pool: tablePool
        });
        
        // endUpdateIdx까지만 필수 렌더링하고, 이후 라인은 데이터가 변했을 때만 렌더링하도록 
        // 렌더링 엔진 내부 로직에 맡기거나 여기서 중단 가능
        if (i > endUpdateIdx && i < areaState.length) {
                // 줄 번호(index)만 바뀌고 데이터는 같은 경우 렌더링 스킵 로직이 있으면 좋음
        }
    }

    // 9. 커서 위치 복원
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
    selectionAPI.restoreCursor(nextCursorPos);
    
    return true;
}




function applyImageBlock(areaState, src, currentLineIndex, cursorOffset) {
    const currentLine = areaState[currentLineIndex];
    if (!currentLine) return { newState: areaState };

    const handler = chunkRegistry.get('image');
    const textHandler = chunkRegistry.get('text');
    const imageChunk = handler.create(src);

    // 1. 커서 기준으로 청크 분리
    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);

    // 2. [최적화] filter 대신 직접 유효성 검사 (불필요한 배열 생성 방지)
    // 텍스트가 있는 청크거나 텍스트가 아닌 청크(이미지, 비디오 등)만 유지
    const hasValidBefore = beforeChunks.length > 0 && (beforeChunks.length > 1 || beforeChunks[0].type !== 'text' || beforeChunks[0].text !== '');
    const hasValidAfter  = afterChunks.length > 0 && (afterChunks.length > 1 || afterChunks[0].type !== 'text' || afterChunks[0].text !== '');

    const finalBefore = hasValidBefore ? beforeChunks : [];
    const finalAfter  = hasValidAfter ? afterChunks : [textHandler.create('', { fontSize: '14px' })];

    // 3. [최적화] 새로운 chunks 조합
    // spread 연산자 대신 push/concat을 고려할 수 있으나, 가독성을 위해 유지하되 배열 생성을 최소화
    const mergedChunks = [...finalBefore, imageChunk, ...finalAfter];
    
    // 중앙 정렬 로직 (이미지만 있는 라인일 경우)
    const newAlign = (!hasValidBefore && finalAfter.length === 1 && finalAfter[0].text === '') 
                    ? 'center' 
                    : currentLine.align;

    // 4. [최적화] 불필요한 전체 복사([...areaState]) 대신 해당 라인만 교체
    const newState = [...areaState]; 
    newState[currentLineIndex] = EditorLineModel(newAlign, mergedChunks);

    // 5. 복구 정보 설정 (이미지 다음 텍스트 청크 시작점)
    const targetChunkIndex = finalBefore.length + 1;

    return {
        newState,
        restoreLineIndex: currentLineIndex,
        restoreChunkIndex: targetChunkIndex,
        restoreOffset: 0
    };
}
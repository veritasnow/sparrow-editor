import { applyImageBlock } from '../utils/imageBlockUtil.js';

export function createImageInsertService(stateAPI, uiAPI, selectionAPI) {
    
    function insertImage(src, targetKeyOrPos) {
        if (!src) return false;

        // 1. 타겟 영역 확보
        const activeKey = (typeof targetKeyOrPos === 'string' ? targetKeyOrPos : null) 
                         || selectionAPI.getActiveKey() 
                         || selectionAPI.getLastActiveKey();
        
        if (!activeKey) return false;

        // 2. 상태 가져오기
        const areaState = stateAPI.get(activeKey);
        if (!areaState) return false;
        
        // 3. 삽입 위치 결정
        let pos = (typeof targetKeyOrPos === 'object' ? targetKeyOrPos : null) 
                  || selectionAPI.getLastValidPosition();

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

        // 8. 라인별 증분 렌더링 (테이블 보호 포함)
        // 이미지가 들어간 줄부터 커서가 복원될 줄까지 루프를 돌며 업데이트
        const startUpdateIdx = Math.min(lineIndex, restoreLineIndex);
        const endUpdateIdx = Math.max(lineIndex, restoreLineIndex);

        for (let i = startUpdateIdx; i < newState.length; i++) {
            const lineEl = container.children[i];
            
            // 💡 현재 라인의 테이블 DOM을 미리 확보 (재사용)
            // getElementsByClassName이 querySelectorAll보다 빠름
            const tablePool = lineEl ? Array.from(lineEl.getElementsByClassName('chunk-table')) : [];
            
            // 만약 새로 생성된 라인이면 renderLine이 알아서 새 태그를 만듦
            uiAPI.renderLine(i, newState[i], activeKey, tablePool);
            
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

    return { insertImage };
}
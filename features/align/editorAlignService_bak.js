// sparrow-editor\service\align\editorAlignService.js
import { EditorLineModel } from '../../model/editorLineModel.js'; 

/**
 * 📐 정렬 서비스
 * 현재 선택된 라인들의 정렬을 변경하는 비즈니스 로직만 담당
 */

export function createEditorAlignService(stateAPI, uiAPI) {

    /**
     * @param {"left" | "center" | "right"} alignType
     */
    function applyAlign(alignType) {
        // 1. 현재 활성화된 영역의 Key 확보 (본문 ID 혹은 TD ID)
        const activeKey = uiAPI.getActiveKey();
        if (!activeKey) return;

        // 2. 해당 영역의 Selection 범위 조회
        const domRanges = uiAPI.getDomSelection();
        if (!domRanges || domRanges.length === 0) return;

        // 3. 해당 Key에 해당하는 상태만 가져오기
        const currentState = stateAPI.get(activeKey); 
        const newState = [...currentState];

        // 4. 시작/끝 라인 인덱스 계산
        const startLineIndex = Math.min(...domRanges.map(r => r.lineIndex));
        const endLineIndex   = Math.max(...domRanges.map(r => r.lineIndex));

        // 5. 라인 정렬 업데이트
        for (let i = startLineIndex; i <= endLineIndex; i++) {
            if (!newState[i]) continue;
            // 기존 청크는 유지하고 align만 변경
            newState[i] = EditorLineModel(alignType, newState[i].chunks);
        }

        // 6. 상태 저장 (Key 기반)
        stateAPI.save(activeKey, newState);

        // 7. 커서 위치 정보 확보 및 저장
        const pos = uiAPI.getSelectionPosition();
        if (pos) {
            stateAPI.saveCursor({ ...pos, containerId: activeKey });
        }

        // 8. UI 리렌더 (해당 라인들만) 및 커서 복원
        for (let i = startLineIndex; i <= endLineIndex; i++) {
            uiAPI.renderLine(i, newState[i]);
        }
        
        // 복구 시에도 activeKey 정보를 담아서 복원
        uiAPI.restoreCursor({ ...pos, containerId: activeKey });
    }

    return { applyAlign };
}
/*
export function createEditorAlignService(stateAPI, uiAPI) {

    function applyAlign(alignType) {

        // 0. 현재 선택 영역의 DOM 기반 오프셋 정보 가져오기?? 필요한가?
        const selection = window.getSelection();
        if (!selection.rangeCount) return;


        // 1. DOM Selection 범위 조회
        const domRanges = uiAPI.getDomSelection();
        if (!domRanges || domRanges.length === 0) return;

        // 2. 시작/끝 라인 인덱스 계산 (정렬은 offset 필요 없음)
        const startLineIndex = Math.min(...domRanges.map(r => r.lineIndex));
        const endLineIndex   = Math.max(...domRanges.map(r => r.lineIndex));

        // 3. 현재 상태 복사
        const currentState = stateAPI.get();
        const newState = [...currentState];

        // 4. 라인 정렬 업데이트
        for (let i = startLineIndex; i <= endLineIndex; i++) {
            if (!newState[i]) continue;
            newState[i] = EditorLineModel(alignType, newState[i].chunks);
        }

        // 5. 상태 저장
        stateAPI.save(newState);

        // 6. 커서 저장
        const pos = uiAPI.getSelectionPosition();
        stateAPI.saveCursor({
            lineIndex: pos.lineIndex,
            startOffset: 0,
            endOffset: pos.offset
        });

        // 7. UI 리렌더 및 커서 복원 (전체 렌더 → 라인 단위)
        for (let i = startLineIndex; i <= endLineIndex; i++) {
            uiAPI.renderLine(i, newState[i]);
        }        
        uiAPI.restoreCursor(pos);
    }

    return { applyAlign };
}
*/
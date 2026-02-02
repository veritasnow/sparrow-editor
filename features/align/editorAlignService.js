import { EditorLineModel } from '../../model/editorLineModel.js'; 
import { normalizeCursorData } from '../../utils/cursorUtils.js';

export function createEditorAlignService(stateAPI, uiAPI, selectionAPI) {

    function applyAlign(alignType) {
        const activeKey = selectionAPI.getActiveKey() || selectionAPI.getLastActiveKey();
        if (!activeKey) return;

        const domRanges = selectionAPI.getDomSelection(activeKey);
        if (!domRanges || domRanges.length === 0) return;

        const currentState = stateAPI.get(activeKey); 
        if (!currentState) return;

        const newState = [...currentState];

        // 1. 선택된 라인 인덱스 추출 최적화
        const lineIndices = domRanges.map(r => r.lineIndex);
        const startIdx = Math.min(...lineIndices);
        const endIdx = Math.max(...lineIndices);

        const container = document.getElementById(activeKey);

        // 2. 루프 내부 최적화
        for (let i = startIdx; i <= endIdx; i++) {
            if (!newState[i]) continue;

            // 모델 업데이트
            newState[i] = EditorLineModel(alignType, newState[i].chunks);
            
            // UI 업데이트 최적화
            const lineEl = container?.children[i]; // O(1) 접근
            if (!lineEl) continue;

            // 💡 [최적화 핵심] 태그 교체가 필요한지 확인
            // 테이블 유무에 따라 P <-> DIV 전환이 필요한 경우에만 renderLine 호출
            const hasTable = newState[i].chunks.some(c => c.type === 'table');
            const requiredTagName = hasTable ? "DIV" : "P";

            if (lineEl.tagName === requiredTagName) {
                // 태그가 같다면 innerHTML을 건드리지 않고 스타일만 수정 (최고 속도)
                lineEl.style.textAlign = alignType;
            } else {
                // 태그가 달라져야 한다면 테이블 풀을 뽑아서 교체 렌더링
                const tablePool = Array.from(lineEl.getElementsByClassName('chunk-table'));
                uiAPI.renderLine(i, newState[i], activeKey, tablePool);
            }
        }

        // 3. 상태 저장
        stateAPI.save(activeKey, newState);

        // 4. 커서 복원
        const pos = selectionAPI.getSelectionPosition();
        if (pos) {
            const normalizedPos = normalizeCursorData({
                ...pos,
                containerId: activeKey
            }, activeKey);
            
            stateAPI.saveCursor(normalizedPos);
            selectionAPI.restoreCursor(normalizedPos);
        }
    }

    return { applyAlign };
}
// sparrow-editor\service\align\editorAlignService.js
import { EditorLineModel } from '../../model/editorLineModel.js'; 
import { normalizeCursorData } from '../../utils/cursorUtils.js';


/**
 * 📐 정렬 서비스
 * 현재 선택된 라인들의 정렬을 변경하는 비즈니스 로직만 담당
 */

export function createEditorAlignService(stateAPI, uiAPI, inputModelService) { // inputModelService 주입 가정

    function applyAlign(alignType) {
        const activeKey = uiAPI.getActiveKey();
        if (!activeKey) return;

        const domRanges = uiAPI.getDomSelection();
        if (!domRanges || domRanges.length === 0) return;

        const currentState = stateAPI.get(activeKey); 
        const newState = [...currentState];

        const startLineIndex = Math.min(...domRanges.map(r => r.lineIndex));
        const endLineIndex   = Math.max(...domRanges.map(r => r.lineIndex));

        for (let i = startLineIndex; i <= endLineIndex; i++) {
            if (!newState[i]) continue;
            newState[i] = EditorLineModel(alignType, newState[i].chunks);
        }

        stateAPI.save(activeKey, newState);

        // 💡 [수정 포인트]
        // raw한 위치 정보(pos)를 바로 저장하지 않고, 서비스 표준 포맷으로 정규화합니다.
        const pos = uiAPI.getSelectionPosition();
        if (pos) {
            const normalizedPos = normalizeCursorData({
                ...pos,
                containerId: activeKey
            }, activeKey);
            
            stateAPI.saveCursor(normalizedPos); // 정규화된 데이터 저장
            
            // UI 렌더링 후 복원
            for (let i = startLineIndex; i <= endLineIndex; i++) {
                // renderLine 시 세 번째 인자로 activeKey를 넘기는 구조인지 확인 필요 (앞선 프로세서 로직과 통일)
                uiAPI.renderLine(i, newState[i], activeKey);
            }
            
            uiAPI.restoreCursor(normalizedPos); // 정규화된 데이터로 복원
        }
    }

    return { applyAlign };
}
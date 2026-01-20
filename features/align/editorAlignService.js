// sparrow-editor\service\align\editorAlignService.js
import { EditorLineModel } from '../../model/editorLineModel.js'; 
import { normalizeCursorData } from '../../utils/cursorUtils.js';

/**
 * 📐 정렬 서비스
 * 현재 선택된 라인들의 정렬(Left, Center, Right)을 변경하는 비즈니스 로직 담당
 */
export function createEditorAlignService(stateAPI, uiAPI) {

    /**
     * @param {string} alignType - 'left' | 'center' | 'right' | 'justify'
     */
    function applyAlign(alignType) {
        // 1. 현재 활성화된 영역 확보 (팝업/버튼 클릭 대비 LastActiveKey 포함)
        const activeKey = uiAPI.getActiveKey() || uiAPI.getLastActiveKey();
        if (!activeKey) return;

        // 2. 현재 선택된 범위(DOM Selection) 가져오기
        const domRanges = uiAPI.getDomSelection(activeKey);
        if (!domRanges || domRanges.length === 0) return;

        // 3. 해당 영역의 상태 데이터 가져오기
        const currentState = stateAPI.get(activeKey); 
        if (!currentState) return;

        // 4. 새로운 상태 맵 생성
        const newState = [...currentState];

        // 5. 선택된 시작 라인과 끝 라인 계산
        const lineIndices = domRanges.map(r => r.lineIndex);
        const startLineIndex = Math.min(...lineIndices);
        const endLineIndex   = Math.max(...lineIndices);

        // 6. 모델 업데이트 (정렬 값 변경)
        for (let i = startLineIndex; i <= endLineIndex; i++) {
            if (!newState[i]) continue;
            // 기존 청크는 유지하고 align 값만 교체하여 새로운 Line 모델 생성
            newState[i] = EditorLineModel(alignType, newState[i].chunks);
        }

        // 7. 변경된 상태 저장
        stateAPI.save(activeKey, newState);

        // 8. 커서 위치 정규화 및 저장
        const pos = uiAPI.getSelectionPosition();
        let normalizedPos = null;

        if (pos) {
            normalizedPos = normalizeCursorData({
                ...pos,
                containerId: activeKey
            }, activeKey);
            
            stateAPI.saveCursor(normalizedPos);
        }

        // 9. UI 렌더링 (activeKey를 전달하여 해당 셀/본문만 타겟팅)
        const container = document.getElementById(activeKey);

        for (let i = startLineIndex; i <= endLineIndex; i++) {
            const lineData = newState[i];
            const lineEl = container?.querySelectorAll(':scope > .text-block')[i];

            // 💡 [추가] 정렬 변경 전, 기존 라인 엘리먼트에서 테이블 DOM들을 백업합니다.
            const tablePool = lineEl ? Array.from(lineEl.querySelectorAll('.chunk-table')) : null;

            // 💡 네 번째 인자로 tablePool을 전달하여 테이블 DOM이 새로 생성되지 않게 합니다.
            uiAPI.renderLine(i, lineData, activeKey, tablePool);
        }

        // 10. 커서 복원
        if (normalizedPos) {
            uiAPI.restoreCursor(normalizedPos);
        }
    }

    return { applyAlign };
}
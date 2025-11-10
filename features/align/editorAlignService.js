// sparrow-editor\service\align\editorAlignService.js
import { EditorLineModel } from '../../model/editorModel.js'; 

/**
 * 텍스트 정렬 변경의 핵심 비즈니스 로직을 제공하는 서비스 모듈.
 */
export function createEditorAlignService(app, ui, updateAndRestore) {

    /**
     * 현재 선택된 라인들의 정렬(align) 상태를 변경하고 에디터에 반영합니다.
     * @param {string} alignType - 'left', 'center', 'right' 중 하나
     */
    function applyAlign(alignType) {
        // 1. 현재 선택 영역의 DOM 기반 오프셋 정보 가져오기
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const currentState = app.getState().present.editorState;
        
        // 💡 [변경] UI에서 순수 DOM 범위만 가져옵니다.
        const domRanges = ui.getSelectionRangesInDOM(); 
        if (!domRanges || domRanges.length === 0) return;

        // 🔴 오프셋 클램프 로직은 제거합니다. 정렬 로직은 라인 인덱스만 필요합니다.
        
        // ✅ 선택 영역의 시작 및 끝 라인 인덱스 계산
        const startLineIndex = Math.min(...domRanges.map(r => r.lineIndex));
        const endLineIndex = Math.max(...domRanges.map(r => r.lineIndex));

        const newState = [...currentState];

        // 2. 상태 변경 로직
        for (let i = startLineIndex; i <= endLineIndex; i++) {
            if (!newState[i]) continue;
            // 💡 [개선] EditorLineModel DTO를 사용한다고 가정하고 불변성 유지
            newState[i] = EditorLineModel(alignType, newState[i].chunks);
        }

        // 3. 상태 저장 및 UI 업데이트 요청
        app.saveEditorState(newState);

        // ✅ 선택 영역이 유지되도록 커서 복원 위치 파악
        const pos = ui.getSelectionPosition();
        updateAndRestore(pos);
    }

    return { applyAlign };
}
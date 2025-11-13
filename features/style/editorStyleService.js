// sparrow-editor\service\style\editorStyleService.js
import { toggleInlineStyle } from "./styleUtils.js";
import { getLineLengthFromState } from '../../utils/editorStateUtils.js'; // 💡 신규 유틸리티 임포트

/**
 * 인라인 스타일 변경의 핵심 비즈니스 로직을 제공하는 서비스 모듈.
 */
export function createEditorStyleService(getEditorState, saveEditorState, ui, updateAndRestore, saveCursorState) {

    /**
     * 현재 선택된 텍스트 영역의 인라인 스타일을 토글(적용/해제)합니다.
     * @param {string} styleKey - CSS 스타일 키 (예: 'fontWeight')
     * @param {string} styleValue - CSS 스타일 값 (예: 'bold')
     */
    function applyStyle(styleKey, styleValue) {
        // 1. 현재 선택 영역 및 상태 정보 가져오기
        const currentState = getEditorState();
        
        // 💡 [변경] UI에서 순수 DOM 범위만 가져옵니다.
        const domRanges = ui.getSelectionRangesInDOM(); 
        if (!domRanges || domRanges.length === 0) return;

        // 💡 [추가] State의 길이를 기반으로 오프셋을 클램프하여 최종 ranges를 만듭니다. (도메인 책임)
        const ranges = domRanges.map(domRange => {
            const lineState = currentState[domRange.lineIndex];
            const lineLen = getLineLengthFromState(lineState);
            
            // State의 실제 길이를 벗어나지 않도록 클램프
            const startIndex = Math.max(0, Math.min(domRange.startIndex, lineLen));
            const endIndex = Math.max(0, Math.min(domRange.endIndex, lineLen));

            return { lineIndex: domRange.lineIndex, startIndex, endIndex };
        });

        // 2. 상태 변경 로직: 핵심 유틸리티에 위임
        const newState = toggleInlineStyle(currentState, ranges, styleKey, styleValue, { type: 'text' });

        // 3. 상태 저장 및 UI 업데이트 요청
        saveEditorState(newState);

        // ✅ 선택 영역이 유지되도록 커서 복원 위치 파악
        const pos = ui.getSelectionPosition();

        // 4. 커서저장
        saveCursorState({
            lineIndex  : pos.lineIndex,
            startOffset: 0,
            endOffset  : pos.offset
        });      

        updateAndRestore(pos);
    }

    return { applyStyle };
}
// sparrow-editor\service\style\editorStyleService.js
import { toggleInlineStyle } from "./styleUtils.js"; // 핵심 유틸리티는 그대로 사용

/**
 * 인라인 스타일 변경의 핵심 비즈니스 로직을 제공하는 서비스 모듈.
 * (DOM이나 버튼에 의존하지 않고, 주입된 콜백을 통해 에디터 상태를 변경합니다.)
 */
export function createEditorStyleService(getEditorState, saveEditorState, ui, updateAndRestore) {

    /**
     * 현재 선택된 텍스트 영역의 인라인 스타일을 토글(적용/해제)합니다.
     * @param {string} styleKey - CSS 스타일 키 (예: 'fontWeight')
     * @param {string} styleValue - CSS 스타일 값 (예: 'bold')
     */
    function applyStyle(styleKey, styleValue) {
        // 1. 현재 선택 영역 및 상태 정보 가져오기
        // ui.getSelectionRangesInState는 UI 레이어의 기능(선택 영역 파악)입니다.
        const ranges = ui.getSelectionRangesInState(getEditorState());
        if (!ranges || ranges.length === 0) return;

        // 2. 상태 변경 로직: 핵심 유틸리티에 위임
        const newState = toggleInlineStyle(getEditorState(), ranges, styleKey, styleValue, { type: 'text' });

        // 3. 상태 저장 및 UI 업데이트 요청 (주입된 콜백 사용)
        saveEditorState(newState);

        // ✅ 선택 영역이 유지되도록 커서 복원 위치 파악
        const pos = ui.getSelectionPosition();
        updateAndRestore(pos);
    }

    return { applyStyle };
}
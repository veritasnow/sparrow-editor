// sparrow-editor\service\style\styleFeatureBinder.js

import { createEditorStyleService } from '../style/editorStyleService.js'; // 💡 분리된 핵심 서비스

/**
 * 🎨 스타일 버튼 이벤트 바인딩 (최상위 컴포지션 레이어)
 * 이 함수는 Style Service를 초기화하고 이벤트 리스너를 연결합니다.
 */
export function bindStyleButtons(getEditorState, saveEditorState, ui, updateAndRestore, { boldBtn, italicBtn, underLineBtn }, saveCursorState) {

    // 1. Logic 모듈 초기화 (필요한 의존성 주입)
    const { applyStyle } = createEditorStyleService(
        getEditorState, 
        saveEditorState, 
        ui, 
        updateAndRestore,
        saveCursorState
    );

    // 2. 이벤트 연결 (Binding) - 뷰 이벤트와 로직 연결
    
    // ───────── 굵게(Bold) ─────────
    boldBtn.addEventListener('click', () => applyStyle("fontWeight", "bold"));

    // ───────── 기울이기(Italic) ─────────
    italicBtn.addEventListener('click', () => applyStyle("fontStyle", "italic"));

    // ───────── 밑줄(Underline) ─────────
    underLineBtn.addEventListener('click', () => applyStyle("textDecoration", "underline"));
}
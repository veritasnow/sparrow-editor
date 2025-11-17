// sparrow-editor\service\style\styleFeatureBinder.js

import { createEditorStyleService } from '../style/editorStyleService.js'; // 💡 분리된 핵심 서비스

/**
 * 🎨 스타일 버튼 이벤트 바인딩 (최상위 컴포지션 레이어)
 * 이 함수는 Style Service를 초기화하고 이벤트 리스너를 연결합니다.
 */
export function bindStyleButtons(stateAPI, uiAPI, { boldBtn, italicBtn, underLineBtn }) {

    // StyleService 초기화
    const { applyStyle } = createEditorStyleService(stateAPI, uiAPI);

    // 이벤트 연결
    boldBtn.addEventListener('click', () => applyStyle("fontWeight", "bold"));
    italicBtn.addEventListener('click', () => applyStyle("fontStyle", "italic"));
    underLineBtn.addEventListener('click', () => applyStyle("textDecoration", "underline"));
}
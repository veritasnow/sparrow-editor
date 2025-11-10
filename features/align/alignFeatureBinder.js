// sparrow-editor\service\align\alignFeatureBinder.js

import { createEditorAlignService } from '../align/editorAlignService.js'; // 💡 분리된 핵심 서비스

/**
 * 📐 정렬 버튼 이벤트 바인딩 (최상위 컴포지션 레이어)
 * 이 함수는 Service를 초기화하고 이벤트 리스너를 연결합니다.
 */
export function bindAlignButtons(app, ui, updateAndRestore, { leftBtn, centerBtn, rightBtn }) {

    // 1. Logic 모듈 초기화 (필요한 의존성 주입)
    const { applyAlign } = createEditorAlignService(app, ui, updateAndRestore);

    // 2. 이벤트 연결 (Binding) - 뷰 이벤트와 로직 연결
    leftBtn.addEventListener("click", () => applyAlign("left"));
    centerBtn.addEventListener("click", () => applyAlign("center"));
    rightBtn.addEventListener("click", () => applyAlign("right"));
}
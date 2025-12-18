// sparrow-editor\service\align\alignFeatureBinder.js
import { createEditorAlignService } from '../align/editorAlignService.js'; // 💡 분리된 핵심 서비스

/**
 * 📐 정렬 버튼 이벤트 바인딩 (최상위 컴포지션 레이어)
 * 이 함수는 Service를 초기화하고 이벤트 리스너를 연결합니다.
 */
export function bindAlignButtons(stateAPI, uiAPI, { leftBtn, centerBtn, rightBtn }) {

    // 정렬 Service 초기화
    const { applyAlign } = createEditorAlignService(stateAPI, uiAPI);

    const onLeft   = () => applyAlign("left");
    const onCenter = () => applyAlign("center");
    const onRight  = () => applyAlign("right");

    // 이벤트 연결
    leftBtn.addEventListener('click', onLeft);
    centerBtn.addEventListener('click', onCenter);
    rightBtn.addEventListener('click', onRight);

    // ✅ disposer 반환
    return function destroy() {
        leftBtn.removeEventListener('click', onLeft);
        centerBtn.removeEventListener('click', onCenter);
        rightBtn.removeEventListener('click', onRight);
    };
}
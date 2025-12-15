import { createColorPopupView } from '../../components/style/colorPopupView.js';
import { createEditorStyleService } from './editorStyleService.js';

/**
 * 🎨 스타일 팝업 바인딩
 */
export function bindStylePopupButton(styleBtn, stateAPI, uiAPI) {
    const toolbar = document.querySelector('.toolbar');

    // 1️⃣ View
    const { popup, colorButtons, open, close } = createColorPopupView(toolbar, styleBtn);

    // 2️⃣ Logic
    const { applyStyleValue } =
        createEditorStyleService(stateAPI, uiAPI);

    // 3️⃣ 버튼 클릭 → 팝업 토글
    styleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.style.display === 'block' ? close() : open();
    });

    // 4️⃣ 색상 선택
    colorButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color;
            applyStyleValue('color', color);
            close();
        });
    });

    // 5️⃣ 외부 클릭 → 닫기
    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && e.target !== styleBtn) {
            close();
        }
    });
}

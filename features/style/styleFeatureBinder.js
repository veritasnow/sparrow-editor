import { createEditorStyleService } from "./editorStyleService.js";

export function bindStyleButtons(stateAPI, uiAPI, elements) {
    const {
        boldBtn,
        italicBtn,
        underLineBtn,
        fontSizeSelect,
        textColorBtn
    } = elements;

    const { applyStyle, applyStyleValue } = createEditorStyleService(stateAPI, uiAPI);

    if (boldBtn) {
        boldBtn.addEventListener('click', () =>
            applyStyle("fontWeight", "bold")
        );
    }

    if (italicBtn) {
        italicBtn.addEventListener('click', () =>
            applyStyle("fontStyle", "italic")
        );
    }

    if (underLineBtn) {
        underLineBtn.addEventListener('click', () =>
            applyStyle("textDecoration", "underline")
        );
    }

    if (fontSizeSelect) {
        fontSizeSelect.addEventListener("change", (e) => {
            applyStyleValue("fontSize", e.target.value);
        });
    }

    if (textColorBtn) {
        const input = textColorBtn.querySelector('.color-input');
        const preview = textColorBtn.querySelector('.color-preview');

        textColorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            input.click();
        });

        // 색상 변경
        input.addEventListener('input', (e) => {
            const color = e.target.value;
            preview.style.background = color;
            applyStyleValue('color', color);
        });
    }

}

import { createEditorStyleService } from "./editorStyleService.js";

export function bindStyleButtons(stateAPI, uiAPI, elements) {
    const {
        boldBtn,
        italicBtn,
        underLineBtn,
        fontSizeSelect
    } = elements;

    const { applyStyle, applyStyleValue } =
        createEditorStyleService(stateAPI, uiAPI);

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
}

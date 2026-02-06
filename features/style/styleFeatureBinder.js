import { createEditorStyleService } from "./editorStyleService.js";

export function bindStyleButtons(stateAPI, uiAPI, selectionAPI, elements) {
    const {
        boldBtn,
        italicBtn,
        underLineBtn,
        fontSizeSelect,
        fontFamilySelect,
        textColorBtn
    } = elements;

    const { applyStyle, applyStyleValue } =
        createEditorStyleService(stateAPI, uiAPI, selectionAPI);

    // ───────────────── handlers ─────────────────

    const onBold = () =>
        applyStyle("fontWeight", "bold");

    const onItalic = () =>
        applyStyle("fontStyle", "italic");

    const onUnderline = () =>
        applyStyle("textDecoration", "underline");

    const onFontSizeChange = (e) =>
        applyStyleValue("fontSize", e.target.value);

    const onFontFamilyChange = (e) =>
        applyStyleValue("fontFamily", e.target.value);

    let onColorBtnClick;
    let onColorInputChange;

    // ───────────────── bind ─────────────────

    if (boldBtn) {
        boldBtn.addEventListener("click", onBold);
    }

    if (italicBtn) {
        italicBtn.addEventListener("click", onItalic);
    }

    if (underLineBtn) {
        underLineBtn.addEventListener("click", onUnderline);
    }

    if (fontSizeSelect) {
        fontSizeSelect.addEventListener("change", onFontSizeChange);
    }


    if (fontFamilySelect) {
        fontFamilySelect.addEventListener("change", onFontFamilyChange);
    }    

    if (textColorBtn) {
        const input   = textColorBtn.querySelector(".color-input");
        const preview = textColorBtn.querySelector(".color-preview");

        onColorBtnClick = (e) => {
            e.stopPropagation();
            input.click();
        };

        onColorInputChange = (e) => {
            const color = e.target.value;
            preview.style.background = color;
            applyStyleValue("color", color);
        };

        textColorBtn.addEventListener("click", onColorBtnClick);
        input.addEventListener("input", onColorInputChange);
    }

    // ───────────────── disposer ─────────────────

    return function destroy() {
        if (boldBtn) {
            boldBtn.removeEventListener("click", onBold);
        }

        if (italicBtn) {
            italicBtn.removeEventListener("click", onItalic);
        }

        if (underLineBtn) {
            underLineBtn.removeEventListener("click", onUnderline);
        }

        if (fontSizeSelect) {
            fontSizeSelect.removeEventListener("change", onFontSizeChange);
        }

        if (textColorBtn) {
            const input = textColorBtn.querySelector(".color-input");

            if (onColorBtnClick) {
                textColorBtn.removeEventListener("click", onColorBtnClick);
            }

            if (onColorInputChange) {
                input.removeEventListener("input", onColorInputChange);
            }
        }
    };
}

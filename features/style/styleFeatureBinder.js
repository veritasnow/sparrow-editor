import { createEditorStyleService } from "./editorStyleService.js";

export function bindStyleButtons(stateAPI, uiAPI, selectionAPI, elements, sync) {
    const { applyStyle, applyStyleValue } = createEditorStyleService(stateAPI, uiAPI, selectionAPI, sync);

    // 공통 핸들러 로직
    const handleEvent = (e) => {
        // e.currentTarget은 리스너가 걸린 버튼/셀렉트 자체
        // e.target은 실제 이벤트가 발생한 정밀한 요소 (컬러 input 등)
        const currentEl          = e.currentTarget;
        const { command, value } = currentEl.dataset;

        if (e.type === 'click') {
            if (command === 'color-trigger') {
                currentEl.querySelector('.color-input')?.click();
            } else if (value) {
                applyStyle(command, value);
            }
        } 
        else if (e.type === 'change' || e.type === 'input') {
            // 컬러 input에서 발생한 이벤트인 경우
            if (e.target.dataset.command === 'color-input') {
                const color     = e.target.value;
                // 실제 값이 바뀐 e.target(input)에서 type을 가져옴
                const styleProp = e.target.dataset.type; 

                // 미리보기 업데이트 (버튼 안의 span 찾기)
                const preview = currentEl.querySelector('.color-preview');
                if (preview) preview.style.background = color;

                applyStyleValue(styleProp, color);
            } else {
                // 일반 select 박스 등
                applyStyleValue(command, e.target.value);
            }
        }
    };

    // ───────────────── 바인딩 실행 ─────────────────
    // 넘겨받은 객체의 DOM 요소들만 순회하며 이벤트 등록
    Object.values(elements).forEach(el => {
        if (!el) return;

        // 1. 기본적으로 클릭 이벤트 등록
        el.addEventListener("click", handleEvent);

        // 2. Select 박스나 컬러 인풋이 포함된 경우 change/input 추가 등록
        if (el.tagName === 'SELECT' || el.querySelector('input[type="color"]')) {
            el.addEventListener("change", handleEvent);
            el.addEventListener("input", handleEvent);
        }
    });

    // ───────────────── 디스포저 (청소) ─────────────────
    return function destroy() {
        Object.values(elements).forEach(el => {
            if (!el) return;
            el.removeEventListener("click", handleEvent);
            el.removeEventListener("change", handleEvent);
            el.removeEventListener("input", handleEvent);
        });
    };
}
/*
옛날방식, 혹시 몰라서 남겨둠. 이 방식은 기능확장할때마다 변경을 너무 많이 해야되서 사용하지 않는게 좋을거 가틈
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
*/
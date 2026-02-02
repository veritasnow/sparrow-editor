import { toggleInlineStyle, applyStylePatch } from "./styleUtils.js";
import { createInlineServiceBase } from "../inline/inlineServiceBase.js";

export function createEditorStyleService(stateAPI, uiAPI, selectionAPI) {
    const { applyInline } = createInlineServiceBase(stateAPI, uiAPI, selectionAPI);

    /**
     * Bold / Italic / Underline 등 토글 스타일용
     */
    function applyStyle(styleKey, styleValue) {
        applyInline((currentState, ranges) =>
            toggleInlineStyle(currentState, ranges, styleKey, styleValue)
        );
    }

    /**
     * Font Size처럼 값이 바뀌는 스타일용
     */
    function applyStyleValue(styleKey, styleValue) {
        applyInline((currentState, ranges) =>
            applyStylePatch(currentState, ranges, {
                [styleKey]: styleValue
            })
        );
    }

    return { applyStyle, applyStyleValue };
}

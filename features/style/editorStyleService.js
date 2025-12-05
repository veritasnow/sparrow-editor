// sparrow-editor\service\style\editorStyleService.js
import { toggleInlineStyle } from "./styleUtils.js";
import { getLineLengthFromState } from '../../utils/editorStateUtils.js'; // 💡 신규 유틸리티 임포트

/**
 * 인라인 스타일 변경의 핵심 비즈니스 로직을 제공하는 서비스 모듈.
 */
export function createEditorStyleService(stateAPI, uiAPI) {

    function applyStyle(styleKey, styleValue) {

        const currentState = stateAPI.get();

        const domRanges = uiAPI.getDomSelection();
        if (!domRanges || domRanges.length === 0) return;

        const ranges = domRanges.map(domRange => {
            const lineState = currentState[domRange.lineIndex];
            const lineLen = getLineLengthFromState(lineState);

            return {
                lineIndex: domRange.lineIndex,
                startIndex: Math.max(0, Math.min(domRange.startIndex, lineLen)),
                endIndex:   Math.max(0, Math.min(domRange.endIndex,   lineLen))
            };
        });

        // 상태 변경
        const newState = toggleInlineStyle(
            currentState,
            ranges,
            styleKey,
            styleValue
        );

        // 상태 저장
        stateAPI.save(newState);

        // 현재 커서 정보(UI 기준)
        const pos = uiAPI.getDomSelectionPosition
            ? uiAPI.getDomSelectionPosition()
            : uiAPI.getSelectionPosition();

        // 커서 상태 저장
        stateAPI.saveCursor({
            lineIndex: pos.lineIndex,
            startOffset: 0,
            endOffset: pos.offset
        });

        // 상태 렌더링 + 커서 복원 (전체 렌더링 → 라인 단위로 변경)
        ranges.forEach(({ lineIndex }) => {
            // 💡 변경되지 않았다면 렌더링 스킵!
            if (stateAPI.isLineChanged(lineIndex)) {
                uiAPI.renderLine(lineIndex, newState[lineIndex]);
            }
        });
        // 커서 복원: 마지막 라인 기준
        const lastRange = ranges[ranges.length - 1];
        uiAPI.restoreCursor({
            lineIndex: lastRange.lineIndex,
            offset: lastRange.endIndex
        });

    }

    return { applyStyle };
}
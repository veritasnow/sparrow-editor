// features/inline/inlineServiceBase.js
import { getRanges } from "../../utils/rangeUtils.js";

export function createInlineServiceBase(stateAPI, uiAPI) {
    /**
     * updateFn: (currentState, ranges) => newState
     * options: { saveCursorFromUI: boolean } (기본 true)
     */
    function applyInline(updateFn, options = { saveCursorFromUI: true }) {
        const currentState = stateAPI.get();
        const domRanges = uiAPI.getDomSelection();
        if (!domRanges || domRanges.length === 0) return;

        const ranges = getRanges(currentState, domRanges);

        // 1) 상태 변경 (전략 함수 위임)
        const newState = updateFn(currentState, ranges);

        // 2) 상태 저장
        stateAPI.save(newState);

        // 3) (선택적) 커서 상태 저장 — 원래 style 서비스와 동일하게
        if (options.saveCursorFromUI) {
            const pos = uiAPI.getDomSelectionPosition
                ? uiAPI.getDomSelectionPosition()
                : uiAPI.getSelectionPosition();

            if (pos) {
                stateAPI.saveCursor({
                    lineIndex: pos.lineIndex,
                    startOffset: 0,
                    endOffset: pos.offset
                });
            }
        }

        // 4) 변경 라인만 렌더링
        ranges.forEach(({ lineIndex }) => {
            if (stateAPI.isLineChanged(lineIndex)) {
                uiAPI.renderLine(lineIndex, newState[lineIndex]);
            }
        });

        // 5) 커서 복원 (마지막 라인 기준)
        const last = ranges[ranges.length - 1];
        uiAPI.restoreCursor({
            lineIndex: last.lineIndex,
            offset: last.endIndex
        });
    }

    return { applyInline };
}

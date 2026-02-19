import { toggleInlineStyle, applyStylePatch } from "./styleUtils.js";
import { getRanges } from "../../utils/rangeUtils.js";
import { normalizeCursorData } from "../../utils/cursorUtils.js";

export function createEditorStyleService(stateAPI, uiAPI, selectionAPI) {

    function applyInline(updateFn, options = { saveCursor: true }) {
        const activeKeys = selectionAPI.getActiveKeys();
        const targets    = activeKeys.length > 0 ? activeKeys : [selectionAPI.getLastActiveKey()].filter(Boolean);
        if (targets.length === 0) return;

        const updates = [];
        const allNormalizedPositions = [];

        targets.forEach((activeKey) => {
            const currentState = stateAPI.get(activeKey);
            if (!currentState) return;

            const domRanges = selectionAPI.getDomSelection(activeKey);
            if (!domRanges || domRanges.length === 0) return;

            const ranges   = getRanges(currentState, domRanges);
            const newState = updateFn(currentState, ranges);

            if (newState && newState !== currentState) {
                const affectedLineIndices = Array.from(new Set(ranges.map(r => r.lineIndex)));
                updates.push({ key: activeKey, newState, affectedLineIndices });
            }

            const normalized = normalizeCursorData(domRanges, activeKey); 
            allNormalizedPositions.push(normalized);
        });

        // 3. 일괄 업데이트 실행 및 렌더링
        if (updates.length > 0) {
            stateAPI.saveBatch(updates, { saveHistory: true });

            updates.forEach(update => {
                const container = document.getElementById(update.key);
                if (!container) return;

                // 🔥 [최적화 및 격리]
                update.affectedLineIndices.forEach((lineIndex) => {
                    const lineData = update.newState[lineIndex];
                    
                    // 💡 [중요] 만약 현재 컨테이너가 메인 에디터인데, 
                    // 하위 리스트(activeKeys에 포함된)가 이 라인에 들어있다면 스킵합니다.
                    // 왜냐하면 하위 리스트 루프에서 어차피 개별적으로 그릴 것이기 때문입니다.
                    const isListInMain = update.key === selectionAPI.getMainKey() && 
                                        lineData.chunks.some(c => c.type === 'unorderedList' && targets.includes(c.id));
                    
                    if (isListInMain) {
                        console.log(`Skipping parent render for list: ${lineIndex} (Will render in its own loop)`);
                        return; 
                    }

                    // 🚩 :scope > 를 사용하여 현재 컨테이너(update.key)의 직계 라인만 찾습니다.
                    // 테이블 셀 안의 텍스트 수정 시, 바깥쪽 에디터의 동일 인덱스 라인을 건드리지 않습니다.
                    const lineEl = container.querySelector(`:scope > [data-line-index="${lineIndex}"]`);
                    
                    if (!lineEl) return;

                    // 해당 라인 내의 테이블들을 안전하게 보관 (풀 추출)
                    const tablePool = Array.from(lineEl.getElementsByClassName('chunk-table'));
                    
                    // 해당 라인만 정밀 렌더링 (targetKey를 넘겨 uiAPI도 격리 탐색하게 함)
                    uiAPI.renderLine(lineIndex, lineData, {
                        key : update.key,
                        pool: tablePool
                    });
                });
            });
        }

        // 4. 다중 커서 복원
        if (allNormalizedPositions.length > 0 && options.saveCursor) {
            stateAPI.saveCursor(allNormalizedPositions); 
            selectionAPI.restoreMultiBlockCursor(allNormalizedPositions);
        }
    }


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

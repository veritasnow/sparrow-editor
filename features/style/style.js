import { toggleInlineStyle, applyStylePatch } from "./styleUtils.js";
import { getRanges } from "../../utils/rangeUtils.js";
import { normalizeCursorData } from "../../utils/cursorUtils.js";

export function applyStyle(styleKey, styleValue, stateAPI, uiAPI, selectionAPI) {
    applyInline(
        (currentState, ranges) =>
            toggleInlineStyle(currentState, ranges, styleKey, styleValue),
        stateAPI,
        uiAPI,
        selectionAPI
    );
}

export function applyStyleValue(styleKey, styleValue, stateAPI, uiAPI, selectionAPI) {
    applyInline(
        (currentState, ranges) =>
            applyStylePatch(currentState, ranges, {
                [styleKey]: styleValue
            }),
        stateAPI,
        uiAPI,
        selectionAPI
    );
}

function applyInline(updateFn, stateAPI, uiAPI, selectionAPI, options = { saveCursor: true }) {
    const activeKeys = selectionAPI.getActiveKeys();
    const targets = activeKeys.length > 0
        ? activeKeys
        : [selectionAPI.getLastActiveKey()].filter(Boolean);

    if (targets.length === 0) return;

    const updates = [];
    const allNormalizedPositions = [];

    targets.forEach((activeKey) => {
        const currentState = stateAPI.get(activeKey);
        if (!currentState) return;

        const domRanges = selectionAPI.getDomSelection(activeKey);
        if (!domRanges || domRanges.length === 0) return;

        const ranges = getRanges(currentState, domRanges);
        const newState = updateFn(currentState, ranges);

        if (newState && newState !== currentState) {
            const affectedLineIndices = Array.from(
                new Set(ranges.map(r => r.lineIndex))
            );

            updates.push({
                key: activeKey,
                newState,
                affectedLineIndices
            });
        }

        const normalized = normalizeCursorData(domRanges, activeKey);
        allNormalizedPositions.push(normalized);
    });

    if (updates.length > 0) {
        stateAPI.saveBatch(updates, { saveHistory: true });

        updates.forEach(update => {
            const container = document.getElementById(update.key);
            if (!container) return;

            update.affectedLineIndices.forEach((lineIndex) => {
                const lineData = update.newState[lineIndex];

                const isListInMain =
                    update.key === selectionAPI.getMainKey() &&
                    lineData.chunks.some(
                        c =>
                            c.type === 'unorderedList' &&
                            targets.includes(c.id)
                    );

                if (isListInMain) {
                    console.log(
                        `Skipping parent render for list: ${lineIndex} (Will render in its own loop)`
                    );
                    return;
                }

                const lineEl = container.querySelector(
                    `:scope > [data-line-index="${lineIndex}"]`
                );

                if (!lineEl) return;

                const tablePool = Array.from(
                    lineEl.getElementsByClassName('chunk-table')
                );

                uiAPI.renderLine(lineIndex, lineData, {
                    key: update.key,
                    pool: tablePool
                });
            });
        });
    }

    if (allNormalizedPositions.length > 0 && options.saveCursor) {
        stateAPI.saveCursor(allNormalizedPositions);
        selectionAPI.restoreMultiBlockCursor(allNormalizedPositions);
    }
}
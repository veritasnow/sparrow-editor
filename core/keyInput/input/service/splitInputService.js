// /core/input/service/splitInputService.js
import { EditorLineModel } from '../../../../model/editorLineModel.js';
import { normalizeCursorData } from '../../../../utils/cursorUtils.js';

export function splitChunksByTable(chunks, align) {
    const lines = [];
    let temp = [];

    const flushTemp = () => {
        if (temp.length > 0) {
            const mergedChunks = temp.reduce((acc, current) => {
                const last = acc[acc.length - 1];
                if (last && last.type === 'text' && current.type === 'text') {
                    if (current.text.includes(last.text)) {
                        last.text = current.text;
                    } else {
                        last.text += current.text;
                    }
                } else {
                    acc.push(current);
                }
                return acc;
            }, []);

            lines.push(EditorLineModel(align, mergedChunks));
            temp = [];
        }
    };

    chunks.forEach(chunk => {
        if (chunk.type === 'table') {
            flushTemp();
            lines.push(EditorLineModel(align, [chunk]));
        } else {
            temp.push(chunk);
        }
    });

    flushTemp();
    return lines;
}

export function handleSplitInput({
    stateAPI,
    uiAPI,
    selectionAPI,
    activeKey,
    lineIndex,
    result,
    currentState
}) {
    const { separatedLines, restoreData } = result;

    const nextState = [...currentState];
    nextState.splice(lineIndex, 1, ...separatedLines);
    stateAPI.save(activeKey, nextState);

    const container = document.getElementById(activeKey);
    if (!container) return;

    const originalLineEl = container?.querySelector(`:scope > [data-line-index="${lineIndex}"]`);

    const movingTablePool = originalLineEl
        ? Array.from(originalLineEl.querySelectorAll('.chunk-table'))
        : [];

    const isTableShifted = separatedLines[1].chunks[0].type === 'table';

    if (isTableShifted) {
        uiAPI.insertLineAfter(originalLineEl, lineIndex + 1, separatedLines[1].align, activeKey);

        uiAPI.renderLine(lineIndex, separatedLines[0], {
            key: activeKey,
            shouldRenderTableSub: false
        });

        uiAPI.renderLine(lineIndex + 1, separatedLines[1], {
            key: activeKey,
            pool: movingTablePool,
            shouldRenderTableSub: false
        });

    } else {
        uiAPI.renderLine(lineIndex, separatedLines[0], {
            key: activeKey,
            pool: movingTablePool,
            shouldRenderTableSub: false
        });

        uiAPI.insertLineAfter(originalLineEl, lineIndex + 1, separatedLines[1].align, activeKey);

        uiAPI.renderLine(lineIndex + 1, separatedLines[1], {
            key: activeKey,
            shouldRenderTableSub: false
        });
    }

    movingTablePool.length = 0;

    const finalRestoreData = normalizeCursorData(restoreData, activeKey);

    if (finalRestoreData) {
        requestAnimationFrame(() => {
            selectionAPI.restoreCursor(finalRestoreData);
        });
    }
}
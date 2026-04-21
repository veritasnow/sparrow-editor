// /core/input/service/renderInputService.js
export function executeInputRendering({
    uiAPI,
    selectionAPI,
    updatedLine,
    lineIndex,
    flags,
    restoreData
}) {
    const targetKey = restoreData.containerId;
    const container = document.getElementById(targetKey);

    const lineEl = container?.querySelector(`:scope > [data-line-index="${lineIndex}"]`);

    if (flags.isChunkRendering && !flags.isNewChunk && restoreData) {
        const chunkIndex = restoreData.anchor.chunkIndex;
        const chunk = updatedLine.chunks[chunkIndex];
        const chunkEl = lineEl?.querySelector(`:scope > [data-index="${chunkIndex}"]`);

        if (chunk?.type === 'text' && chunkEl && chunkEl.textContent === chunk.text) {
            return;
        }
    }

    const tablePool = lineEl ? Array.from(lineEl.querySelectorAll('.chunk-table')) : null;

    if (flags.isNewChunk) {
        uiAPI.renderLine(lineIndex, updatedLine, {
            key: targetKey,
            pool: tablePool,
            shouldRenderTableSub: false
        });

        if (restoreData) selectionAPI.restoreCursor(restoreData);

    } else if (flags.isChunkRendering && restoreData) {

        const chunkIndex = restoreData.anchor.chunkIndex;
        const chunk = updatedLine.chunks[chunkIndex];

        if (!chunk || chunk.type !== 'text') {
            uiAPI.renderLine(lineIndex, updatedLine, {
                key: targetKey,
                pool: tablePool,
                shouldRenderTableSub: false
            });
        } else {
            uiAPI.renderChunk(lineIndex, chunkIndex, chunk, targetKey);
        }

        selectionAPI.restoreCursor(restoreData);
    }
}
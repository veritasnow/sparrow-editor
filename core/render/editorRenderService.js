// services/editorRenderService.js

export function createEditorRenderService({ stateAPI, ui }) {

    function render(data, key, shouldRenderSub = true) {
        ui.render(data, key);

        if (shouldRenderSub) {
            renderSubTree(data);
        }
    }

    function renderLine(lineIndex, lineData, options = {}) {
        const {
            key,
            pool,
            shouldRenderSub = true,
            skipSync = false,
            tableStrategy = 'reuse'
        } = options;

        ui.renderLine(lineIndex, lineData, key, pool, skipSync, { tableStrategy });

        if (shouldRenderSub) {
            renderSubTree([lineData]);
        }
    }

    /**
     * 🔥 핵심: 기존 _renderSubDom 이동
     */
    function renderSubTree(lines) {
        if (!lines || !Array.isArray(lines)) return;

        lines.forEach(line => {
            line.chunks.forEach(chunk => {

                // ✅ table
                if (chunk.type === 'table' && chunk.data) {
                    chunk.data.flat().forEach(cell => {
                        if (!cell?.id) return;

                        const cellState = stateAPI.get(cell.id);
                        if (!cellState) return;

                        render(cellState, cell.id);
                    });
                }

                // ✅ unorderedList
                else if (chunk.type === 'unorderedList' && chunk.data) {
                    const listState = stateAPI.get(chunk.id);

                    if (Array.isArray(listState)) {
                        listState.forEach((item, index) => {
                            renderLine(index, item, {
                                key: chunk.id,
                                shouldRenderSub: false
                            });
                        });
                    }
                }

            });
        });
    }

    return {
        render,
        renderLine
    };
}
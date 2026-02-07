export function createDOMParseService() {

    /**
     * 라인 DOM을 분석하여 데이터 모델(Chunks)로 변환
     * ⚠️ table chunk는 DOM에서 재구성하지 않는다.
     */
    function parseLineDOM(
        lineEl,
        currentLineChunks,
        selectionContainer,
        cursorOffset,
        lineIndex
    ) {
        const newChunks = [];
        let textBuffer = '';
        let restoreData = null;
        let hasTable = false;

        const children = lineEl.childNodes;

        for (let i = 0; i < children.length; i++) {
            const node = children[i];

            /* -----------------------------
             * 1. TEXT NODE
             * ----------------------------- */
            if (node.nodeType === Node.TEXT_NODE) {
                textBuffer += node.textContent || '';

                if (node === selectionContainer) {
                    restoreData = {
                        lineIndex,
                        chunkIndex: newChunks.length,
                        offset: cursorOffset
                    };
                }
                continue;
            }

            /* -----------------------------
             * 2. ELEMENT NODE
             * ----------------------------- */
            if (node.nodeType !== Node.ELEMENT_NODE) continue;

            // 이전 텍스트 flush
            if (textBuffer.length > 0) {
                newChunks.push({
                    type: 'text',
                    text: textBuffer,
                    style: {}
                });
                textBuffer = '';
            }

            const isTable =
                node.tagName === 'TABLE' ||
                node.classList.contains('chunk-table') ||
                node.classList.contains('se-table');

            const oldIndexStr = node.getAttribute('data-index');
            const oldIndex = oldIndexStr !== null ? Number(oldIndexStr) : null;
            const existingChunk =
                oldIndex !== null ? currentLineChunks?.[oldIndex] : null;

            /* -----------------------------
             * TABLE 처리 (🔥 핵심)
             * ----------------------------- */
            if (isTable) {
                hasTable = true;

                if (existingChunk && existingChunk.type === 'table') {
                    // ✅ table은 무조건 기존 모델 유지
                    newChunks.push(existingChunk);
                } else {
                    // 예외 케이스: 신규 table (초기 생성 직후)
                    newChunks.push({
                        type: 'table',
                        rows: 0,
                        cols: 0,
                        data: [],
                        style: {}
                    });
                }

                // 커서 위치 보정
                if (
                    node === selectionContainer ||
                    node.contains(selectionContainer)
                ) {
                    restoreData ??= {
                        lineIndex,
                        chunkIndex: newChunks.length - 1,
                        offset: 0
                    };
                }

                continue;
            }

            /* -----------------------------
             * TEXT ELEMENT (span.chunk-text)
             * ----------------------------- */
            if (existingChunk && existingChunk.type === 'text') {
                newChunks.push(existingChunk);
            } else if (node.classList.contains('chunk-text')) {
                newChunks.push({
                    type: 'text',
                    text: node.textContent || '',
                    style: _extractStyleFromElement(node)
                });
            }

            if (
                node === selectionContainer ||
                node.contains(selectionContainer)
            ) {
                restoreData ??= {
                    lineIndex,
                    chunkIndex: newChunks.length - 1,
                    offset: cursorOffset
                };
            }
        }

        /* -----------------------------
         * trailing text
         * ----------------------------- */
        if (textBuffer.length > 0) {
            newChunks.push({
                type: 'text',
                text: textBuffer,
                style: {}
            });
        }

        /* -----------------------------
         * empty line guard
         * ----------------------------- */
        if (newChunks.length === 0) {
            newChunks.push({
                type: 'text',
                text: '',
                style: {}
            });
        }

        if (!restoreData) {
            restoreData = {
                lineIndex,
                chunkIndex: 0,
                offset: 0
            };
        }

        return {
            newChunks,
            restoreData,
            shouldSplit: hasTable && newChunks.length > 1
        };
    }

    /* -----------------------------
     * STYLE EXTRACTOR
     * ----------------------------- */
    function _extractStyleFromElement(el) {
        const s = el.style;
        const style = {};

        if (s.fontWeight === 'bold' || Number(s.fontWeight) >= 700)
            style.fontWeight = 'bold';
        if (s.fontStyle === 'italic')
            style.fontStyle = 'italic';
        if (s.textDecoration.includes('underline'))
            style.textDecoration = 'underline';
        if (s.fontSize) style.fontSize = s.fontSize;
        if (s.color) style.color = s.color;
        if (s.backgroundColor)
            style.backgroundColor = s.backgroundColor;

        return style;
    }

    return { parseLineDOM };
}
export function createDOMParseService() {

    /**
     * 라인 DOM을 분석하여 데이터 모델(Chunks)로 변환
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
             * 1. TEXT NODE (순수 텍스트)
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
             * 2. ELEMENT NODE (IMG, TABLE, SPAN 등)
             * ----------------------------- */
            if (node.nodeType !== Node.ELEMENT_NODE) continue;

            // 엘리먼트를 만나면 이전까지 쌓인 텍스트 버퍼를 먼저 처리 (Flush)
            if (textBuffer.length > 0) {
                newChunks.push({
                    type: 'text',
                    text: textBuffer,
                    style: {}
                });
                textBuffer = '';
            }

            const tagName = node.tagName.toUpperCase();
            const isTable = tagName === 'TABLE' || node.classList.contains('chunk-table') || node.classList.contains('se-table');
            
            // data-index를 기반으로 기존 모델 데이터 조회
            const oldIndexStr = node.getAttribute('data-index');
            const oldIndex = oldIndexStr !== null ? Number(oldIndexStr) : null;
            const existingChunk = oldIndex !== null ? currentLineChunks?.[oldIndex] : null;

            /* -----------------------------
             * 분기 처리: 테이블 vs 기타 기존청크 vs 신규
             * ----------------------------- */
            if (isTable) {
                hasTable = true;
                // 테이블은 기존 모델 데이터를 최우선으로 유지 (불필요한 재파싱 방지)
                if (existingChunk && existingChunk.type === 'table') {
                    newChunks.push(existingChunk);
                } else {
                    newChunks.push({
                        type: 'table',
                        rows: 0, cols: 0, data: [],
                        style: {}
                    });
                }
            } 
            // 🔥 이미지, 비디오, 가로줄 등 인덱스가 있는 모든 기존 청크 보존
            else if (existingChunk) {
                newChunks.push(existingChunk);
            } 
            // 신규로 생성된 텍스트 엘리먼트 (예: 스타일이 적용된 텍스트 붙여넣기 등)
            else if (node.classList.contains('chunk-text')) {
                newChunks.push({
                    type: 'text',
                    text: node.textContent || '',
                    style: _extractStyleFromElement(node)
                });
            }

            /* -----------------------------
             * 커서 위치(restoreData) 보정
             * ----------------------------- */
            if (node === selectionContainer || node.contains(selectionContainer)) {
                restoreData ??= {
                    lineIndex,
                    chunkIndex: newChunks.length - 1,
                    // 테이블이나 이미지 등은 오프셋 의미가 없으므로 0 혹은 전달받은 값 사용
                    offset: isTable ? 0 : cursorOffset
                };
            }
        }

        /* -----------------------------
         * 마무리: 남은 텍스트 및 예외 처리
         * ----------------------------- */
        // 루프가 끝난 뒤 남은 텍스트 처리
        if (textBuffer.length > 0) {
            newChunks.push({
                type: 'text',
                text: textBuffer,
                style: {}
            });
        }

        // 빈 라인 보호
        if (newChunks.length === 0) {
            newChunks.push({ type: 'text', text: '', style: {} });
        }

        // 커서 데이터가 여전히 없다면 첫 번째 청크로 기본값 설정
        restoreData ??= { lineIndex, chunkIndex: 0, offset: 0 };

        return {
            newChunks,
            restoreData,
            shouldSplit: hasTable && newChunks.length > 1
        };
    }

    /**
     * 스타일 추출 함수 (fontFamily 추가)
     */
    function _extractStyleFromElement(el) {
        const s = el.style;
        const style = {};

        if (s.fontWeight === 'bold' || Number(s.fontWeight) >= 700) style.fontWeight = 'bold';
        if (s.fontStyle === 'italic') style.fontStyle = 'italic';
        if (s.textDecoration.includes('underline')) style.textDecoration = 'underline';
        if (s.fontSize) style.fontSize = s.fontSize;
        if (s.color) style.color = s.color;
        if (s.backgroundColor) style.backgroundColor = s.backgroundColor;
        if (s.fontFamily) style.fontFamily = s.fontFamily; // 폰트 패밀리 보존 추가

        return style;
    }

    return { parseLineDOM };
}
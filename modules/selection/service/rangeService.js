/**
 * 활성 컨테이너(ID) 추출 및 분석 서비스
 */
export function createRangeService(root) {
    
    /**
     * 1. Dom기준으로 선택영역 range 반환
     */ 
    function getDomSelection(targetKey, activeKey) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;

        const domRange = sel.getRangeAt(0);
        const finalKey = targetKey || activeKey;
        const targetContainer = document.getElementById(finalKey) || root;
        if (!targetContainer) return null;

        // [핵심 1] 역방향 드래그 여부 확인
        const isBackwards = sel.anchorNode && sel.focusNode && 
            (sel.anchorNode.compareDocumentPosition(sel.focusNode) & Node.DOCUMENT_POSITION_PRECEDING ||
            (sel.anchorNode === sel.focusNode && sel.anchorOffset > sel.focusOffset));

        // [핵심 2] 해당 컨테이너가 'is-selected'인지 확인 (셀 단위 전체 선택 여부)
        const isFullCellSelected = targetContainer.classList.contains('is-selected');

        const lines = Array.from(targetContainer.querySelectorAll(':scope > .text-block'));
        const ranges = [];

        lines.forEach((lineEl, idx) => {

            const lineIndex = Number(lineEl.dataset.lineIndex);
            if (Number.isNaN(lineIndex)) return;

            // [핵심 3] 전체 선택된 셀이라면 계산 없이 해당 라인의 전체 길이를 반환
            if (isFullCellSelected) {
                // 해당 라인의 전체 텍스트 길이를 구함
                const lineTotalLength = lineEl.textContent.length;
                ranges.push({
                    lineIndex: lineIndex,
                    startIndex: 0,
                    endIndex: lineTotalLength
                });
                return; // 다음 라인으로
            }

            // --- 여기서부터는 기존의 일반 텍스트 드래그 분석 로직 ---
            const isStartInP = lineEl.contains(domRange.startContainer);
            const isEndInP = lineEl.contains(domRange.endContainer);
            
            let isIntersecting = isStartInP || isEndInP;
            if (!isIntersecting) {
                const pRange = document.createRange();
                pRange.selectNodeContents(lineEl);
                isIntersecting = (domRange.compareBoundaryPoints(Range.END_TO_START, pRange) <= 0 &&
                                domRange.compareBoundaryPoints(Range.START_TO_END, pRange) >= 0);
            }

            if (isIntersecting) {
                let total = 0, startOffset = -1, endOffset = -1;
                const chunks = Array.from(lineEl.childNodes);

                chunks.forEach((node, nodeIdx) => {
                    if (startOffset === -1) {
                        if (domRange.startContainer === lineEl && domRange.startOffset === nodeIdx) startOffset = total;
                        else if (domRange.startContainer === node || node.contains(domRange.startContainer)) {
                            const rel = domRange.startContainer.nodeType === Node.TEXT_NODE ? domRange.startOffset : 0;
                            startOffset = total + rel;
                        }
                    }
                    if (endOffset === -1) {
                        if (domRange.endContainer === lineEl && domRange.endOffset === nodeIdx) endOffset = total;
                        else if (domRange.endContainer === node || node.contains(domRange.endContainer)) {
                            const rel = domRange.endContainer.nodeType === Node.TEXT_NODE ? domRange.endOffset : 0;
                            endOffset = total + rel;
                        }
                    }
                    // 텍스트 노드 또는 chunk-text인 경우 길이를 더함
                    total += (node.nodeType === Node.TEXT_NODE || (node.classList && node.classList.contains('chunk-text'))) 
                            ? node.textContent.length : 1;
                });

                if (startOffset === -1) startOffset = isStartInP ? total : 0;
                if (endOffset === -1) endOffset = isEndInP ? total : total;

                ranges.push({ 
                    lineIndex: lineIndex, 
                    startIndex: Math.min(startOffset, endOffset), 
                    endIndex: Math.max(startOffset, endOffset) 
                });
            }
        });

        if (ranges.length > 0) {
            ranges.isBackwards = isBackwards;
            return ranges;
        }
        return null;
    }

    function getSelectionPosition(context) {
        const { lineIndex, dataIndex, activeNode, container, cursorOffset, activeContainer } = context;
        const targetEl = activeNode?.nodeType === Node.TEXT_NODE ? activeNode.parentElement : activeNode;
        const tableEl = targetEl?.closest('table');
        
        if (tableEl) {
            const td = container.nodeType === Node.TEXT_NODE 
                ? container.parentElement.closest('td') 
                : container.closest('td');

            if (td) {
                const tr = td.parentElement;
                const tbody = tr.closest('tbody') || tableEl;
                return {
                    containerId: activeContainer.id,
                    lineIndex,
                    anchor: {
                        chunkIndex: dataIndex,
                        type: 'table',
                        detail: {
                            rowIndex: Array.from(tbody.rows || tbody.children).indexOf(tr),
                            colIndex: Array.from(tr.cells || tr.children).indexOf(td),
                            offset: cursorOffset
                        }
                    }
                };
            }
        }

        return {
            containerId: activeContainer.id,
            lineIndex,
            anchor: {
                chunkIndex: dataIndex ?? 0,
                type: activeNode?.dataset?.type || 'text',
                offset: cursorOffset
            }
        };
    }

    function getSelectionContext(targetContainer) {

        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;

        const range = sel.getRangeAt(0);
        const container = range.startContainer;
        const el = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

        const activeContainer = el.closest('td[id], th[id]') || targetContainer;
        if (!activeContainer) return null;

        const parentDom = el.closest('.text-block');
        if (!parentDom || !activeContainer.contains(parentDom)) return null;

        const lineIndex = getLineIndex(parentDom);
        if (lineIndex < 0) return null;

        const rawActiveNode = el.closest('[data-index]');
        const activeNode = rawActiveNode && activeContainer.contains(rawActiveNode) ? rawActiveNode : null;
        const dataIndex = activeNode?.dataset.index !== undefined ? parseInt(activeNode.dataset.index, 10) : null;

        return {
            activeContainer, containerId: activeContainer.id, lineIndex,
            parentDom, container, cursorOffset: range.startOffset,
            activeNode, dataIndex, range
        };

    }    
    
    function getLineIndex(el) {
        if (!el) return -1;
        // data-line-index 값을 읽어서 숫자로 변환
        const index = el.getAttribute('data-line-index');
        return index !== null ? parseInt(index, 10) : -1;
    }          

    function getInsertionAbsolutePosition(context) {
        const { lineIndex, container, cursorOffset, parentDom } = context;
        let absoluteOffset = 0;
        const walker = document.createTreeWalker(parentDom, NodeFilter.SHOW_TEXT, null, false);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node === container) {
                absoluteOffset += cursorOffset;
                break;
            }
            absoluteOffset += node.textContent.length;
        }
        return { lineIndex, absoluteOffset };
    }    

    return { getDomSelection, getSelectionPosition, getSelectionContext, getInsertionAbsolutePosition };
}
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
            // [핵심 3] 전체 선택된 셀이라면 계산 없이 해당 라인의 전체 길이를 반환
            if (isFullCellSelected) {
                // 해당 라인의 전체 텍스트 길이를 구함
                const lineTotalLength = lineEl.textContent.length;
                ranges.push({
                    lineIndex: idx,
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
                    lineIndex: idx, 
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

    function getSelectionPosition(selectionContext) {
        const context = selectionContext; 

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
    

    return { getDomSelection, getSelectionPosition };
}
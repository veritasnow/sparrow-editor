// /module/uiModule/service/selectionService.js

export function createSelectionService({ root }) {
    let lastValidPos = null;
    let lastActiveKey = null;

    /**
     * 1. 실제로 콘텐츠(텍스트)가 선택된 모든 컨테이너 ID를 배열로 반환
     */
    function getActiveKeys() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return [lastActiveKey].filter(Boolean);

        const range = sel.getRangeAt(0);
        const fragment = range.cloneContents();
        
        const cellsWithContent = Array.from(fragment.querySelectorAll('td[id], th[id]')).filter(cell => {
            const text = cell.textContent.replace(/\u200B/g, '').trim();
            return text.length > 0;
        });

        if (cellsWithContent.length > 0) {
            const ids = cellsWithContent.map(c => c.id);
            lastActiveKey = ids[ids.length - 1];
            return ids;
        }

        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        
        const cell = node.closest('td[id], th[id]');
        if (cell) {
            lastActiveKey = cell.id;
            return [cell.id];
        }

        const container = node.closest('[contenteditable="true"]');
        if (container && container.id) {
            lastActiveKey = container.id;
            return [container.id];
        }

        return [lastActiveKey].filter(Boolean);
    }

    function getActiveKey() {
        const keys = getActiveKeys();
        return keys.length > 0 ? keys[keys.length - 1] : lastActiveKey;
    }

    function getActiveContainer() {
        const activeKey = getActiveKey();
        return (activeKey ? document.getElementById(activeKey) : null) || root;
    }

    /**
     * 4. [수정] .text-block 클래스를 기준으로 드래그 범위 추출
     */
    function getDomSelection(targetKey) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;

        const domRange = sel.getRangeAt(0);
        const finalKey = targetKey || getActiveKey();
        const targetContainer = document.getElementById(finalKey) || root;
        
        // p 태그 대신 .text-block 클래스를 가진 div들을 가져옵니다.
        const lines = Array.from(targetContainer.querySelectorAll(':scope > .text-block'));
        const ranges = [];

        lines.forEach((lineEl, idx) => {
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
                        if (domRange.startContainer === lineEl && domRange.startOffset === nodeIdx) {
                            startOffset = total;
                        } else if (domRange.startContainer === node || node.contains(domRange.startContainer)) {
                            const rel = domRange.startContainer.nodeType === Node.TEXT_NODE ? domRange.startOffset : 0;
                            startOffset = total + rel;
                        }
                    }
                    if (endOffset === -1) {
                        if (domRange.endContainer === lineEl && domRange.endOffset === nodeIdx) {
                            endOffset = total;
                        } else if (domRange.endContainer === node || node.contains(domRange.endContainer)) {
                            const rel = domRange.endContainer.nodeType === Node.TEXT_NODE ? domRange.endOffset : 0;
                            endOffset = total + rel;
                        }
                    }
                    total += (node.nodeType === Node.TEXT_NODE || node.classList?.contains('chunk-text')) 
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

        return ranges.length ? ranges : null;
    }

    /**
     * 5. [수정] 기초 컨텍스트 추출 (.text-block 기준)
     */
    function getSelectionContext() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;

        const range = sel.getRangeAt(0);
        const container = range.startContainer;
        const el = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

        const activeContainer = el.closest('td[id], th[id]') || getActiveContainer();
        if (!activeContainer) return null;

        // p 태그 대신 .text-block 클래스를 찾습니다.
        const parentP = el.closest('.text-block');
        if (!parentP || !activeContainer.contains(parentP)) return null;

        // activeContainer 직계 자식들 중 .text-block들만 추려서 인덱스를 찾습니다.
        const lines = Array.from(activeContainer.querySelectorAll(':scope > .text-block'));
        const lineIndex = lines.indexOf(parentP);
        if (lineIndex < 0) return null;

        const rawActiveNode = el.closest('[data-index]');
        const activeNode = rawActiveNode && activeContainer.contains(rawActiveNode) ? rawActiveNode : null;
        const dataIndex = activeNode?.dataset.index !== undefined ? parseInt(activeNode.dataset.index, 10) : null;

        return {
            activeContainer,
            containerId: activeContainer.id,
            lineIndex,
            parentP,
            container,
            cursorOffset: range.startOffset,
            activeNode,
            dataIndex,
            range
        };
    }

    function getSelectionPosition() {
        const context = getSelectionContext(); 
        if (!context) return null;

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

    /**
     * 7. [수정] 블록 커서 복원 (.text-block 기준)
     */
    function restoreBlockCursor(cursorData) {
        if (!cursorData) return;

        const targetContainer = cursorData.containerId 
            ? document.getElementById(cursorData.containerId) 
            : root;
        if (!targetContainer) return;

        const sel = window.getSelection();
        const range = document.createRange();
        const allLines = Array.from(targetContainer.querySelectorAll(':scope > .text-block'));

        if (cursorData.isSelection && cursorData.ranges && cursorData.ranges.length > 0) {
            try {
                const ranges = cursorData.ranges;
                const startLine = allLines[ranges[0].lineIndex];
                const endLine = allLines[ranges[ranges.length - 1].lineIndex];
                
                if (!startLine || !endLine) return;

                const startPos = findNodeAndOffset(startLine, ranges[0].startIndex);
                range.setStart(startPos.node, startPos.offset);

                const endPos = findNodeAndOffset(endLine, ranges[ranges.length - 1].endIndex);
                range.setEnd(endPos.node, endPos.offset);

                sel.removeAllRanges();
                sel.addRange(range);
            } catch (e) { console.error('Block restore failed:', e); }
            return;
        }

        if (cursorData.lineIndex === undefined) return;
        const lineEl = allLines[cursorData.lineIndex];
        if (!lineEl) return;

        try {
            const { anchor } = cursorData;
            if (anchor.type === 'table' && anchor.detail) {
                const chunkEl = Array.from(lineEl.children).find(el => parseInt(el.dataset.index, 10) === anchor.chunkIndex);
                const td = chunkEl?.querySelectorAll('tr')[anchor.detail.rowIndex]?.querySelectorAll('td')[anchor.detail.colIndex];
                if (td) {
                    let node = td.firstChild || td.appendChild(document.createTextNode(''));
                    range.setStart(node, Math.min(anchor.detail.offset, node.length));
                }
            } else if (anchor.type === 'video' || anchor.type === 'image') {
                const chunkEl = Array.from(lineEl.children).find(el => parseInt(el.dataset.index, 10) === anchor.chunkIndex);
                if (chunkEl) anchor.offset === 0 ? range.setStartBefore(chunkEl) : range.setStartAfter(chunkEl);
            } else {
                const pos = findNodeAndOffset(lineEl, anchor.offset || 0);
                range.setStart(pos.node, pos.offset);
            }
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (e) { console.warn('Cursor restore failed:', e); }
    }

    function findNodeAndOffset(lineEl, targetOffset) {
        const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT, null, false);
        let cumulativeOffset = 0;
        let lastNode = null;

        while (walker.nextNode()) {
            const node = walker.currentNode;
            const nodeLength = node.textContent.length;
            if (targetOffset >= cumulativeOffset && targetOffset <= cumulativeOffset + nodeLength) {
                return { node, offset: targetOffset - cumulativeOffset };
            }
            cumulativeOffset += nodeLength;
            lastNode = node;
        }

        if (!lastNode) {
            const textNode = document.createTextNode('');
            lineEl.appendChild(textNode);
            return { node: textNode, offset: 0 };
        }
        return { node: lastNode, offset: lastNode.textContent.length };
    }

    /**
     * 7-2. [수정] 일반 커서 복원 (.text-block 기준)
     */
    function restoreCursor(cursorData) {
        if (!cursorData) return;
        const { containerId, ranges, anchor, lineIndex } = cursorData;
        const targetContainer = containerId ? document.getElementById(containerId) : getActiveContainer();
        if (!targetContainer) return;

        const sel = window.getSelection();
        sel.removeAllRanges();
        const allLines = Array.from(targetContainer.querySelectorAll(':scope > .text-block'));

        if (ranges && ranges.length > 0) {
            ranges.forEach(rangeInfo => {
                try {
                    const lineEl = allLines[rangeInfo.lineIndex];
                    const textNode = findFirstTextNode(lineEl);
                    if (textNode) {
                        const newRange = document.createRange();
                        newRange.setStart(textNode, Math.min(rangeInfo.startIndex, textNode.length));
                        newRange.setEnd(textNode, Math.min(rangeInfo.endIndex, textNode.length));
                        sel.addRange(newRange);
                    }
                } catch (e) {}
            });
            return; 
        }

        if (lineIndex !== undefined && anchor) {
            try {
                const lineEl = allLines[lineIndex];
                const chunkEl = Array.from(lineEl.children).find(el => parseInt(el.dataset.index, 10) === anchor.chunkIndex);
                if (!chunkEl) return;

                const range = document.createRange();
                if (anchor.type === 'table' && anchor.detail) {
                    const td = chunkEl.querySelectorAll('tr')[anchor.detail.rowIndex]?.querySelectorAll('td')[anchor.detail.colIndex];
                    if (td) {
                        let node = td.firstChild || td.appendChild(document.createTextNode('\u00A0'));
                        range.setStart(node, Math.min(anchor.detail.offset, node.length));
                    }
                } else if (anchor.type === 'video' || anchor.type === 'image') {
                    anchor.offset === 0 ? range.setStartBefore(chunkEl) : range.setStartAfter(chunkEl);
                } else {
                    let node = findFirstTextNode(chunkEl) || chunkEl.appendChild(document.createTextNode(''));
                    range.setStart(node, Math.min(anchor.offset || 0, node.length));
                }
                range.collapse(true);
                sel.addRange(range);
            } catch (e) {}
        }
    }

    function findFirstTextNode(el) {
        if (!el) return null;
        if (el.nodeType === Node.TEXT_NODE) return el;
        for (let child of el.childNodes) {
            const found = findFirstTextNode(child);
            if (found) return found;
        }
        return null;
    }

    function getInsertionAbsolutePosition() {
        const context = getSelectionContext();
        if (!context) return null;
        const { lineIndex, container, cursorOffset, parentP } = context;
        let absoluteOffset = 0;
        const walker = document.createTreeWalker(parentP, NodeFilter.SHOW_TEXT, null, false);
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

    return { 
        getSelectionPosition, 
        getActiveKey,
        getActiveKeys,
        getLastActiveKey: () => lastActiveKey,
        getInsertionAbsolutePosition,
        updateLastValidPosition: () => {
            const pos = getSelectionPosition();
            if (pos) {
                lastValidPos = { 
                    lineIndex: pos.lineIndex, 
                    absoluteOffset: getInsertionAbsolutePosition()?.absoluteOffset || 0 
                };
                lastActiveKey = pos.containerId;
            }
        },
        getLastValidPosition: () => lastValidPos,
        getSelectionContext, 
        restoreCursor,
        restoreBlockCursor,
        getDomSelection,
        restoreSelectionPositionByChunk: (data) => restoreCursor({ containerId: lastActiveKey, lineIndex: data.lineIndex, anchor: data }),
        restoreTableSelection: (data) => restoreCursor({ containerId: lastActiveKey, lineIndex: data.lineIndex, anchor: { chunkIndex: data.chunkIndex, type: 'table', detail: data.cell } })
    };
}
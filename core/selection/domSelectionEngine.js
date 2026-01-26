// /module/uiModule/service/selectionService.js
export function createSelectionService({ root }) {
    let lastValidPos  = null;
    let lastActiveKey = null;

    /**
     * 헬퍼: 요소가 부모 내에서 몇 번째 .text-block인지 인덱스 계산 (O(N) 최적화)
     */
    function getLineIndex(el) {
        if (!el) return -1;
        let index = 0;
        let prev = el.previousElementSibling;
        while (prev) {
            if (prev.classList.contains('text-block')) index++;
            prev = prev.previousElementSibling;
        }
        return index;
    }


    /**
     * 1. 실제로 콘텐츠가 선택된 모든 컨테이너 ID 반환 (중복/부모 제외 최적화)
     */ 
    function getActiveKeys() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return [lastActiveKey].filter(Boolean);

        const range = sel.getRangeAt(0);
        const searchRoot = root || document.body;

        // [1] 시각적으로 선택된 셀 (테이블 셀 등)
        const visualSelectedNodes = document.getElementsByClassName('se-table-cell is-selected');
        const visualSelectedIds = [];
        for (let i = 0; i < visualSelectedNodes.length; i++) {
            const id = visualSelectedNodes[i].getAttribute('data-container-id');
            if (id) visualSelectedIds.push(id);
        }

        // [2] 논리적으로 선택된 영역 (드래그 범위)
        const allPossibleContainers = Array.from(searchRoot.querySelectorAll('[data-container-id]'));
        if (searchRoot.hasAttribute('data-container-id')) allPossibleContainers.push(searchRoot);

        const intersecting = allPossibleContainers.filter(container => 
            sel.containsNode(container, true)
        );

        const logicalActiveIds = intersecting.filter(c1 => {
            const subContainers = intersecting.filter(c2 => c1 !== c2 && c1.contains(c2));
            if (subContainers.length === 0) return true;

            const isStartInSelf = c1.contains(range.startContainer) && 
                !subContainers.some(sub => sub.contains(range.startContainer));
            
            const isEndInSelf = c1.contains(range.endContainer) && 
                !subContainers.some(sub => sub.contains(range.endContainer));

            if (isStartInSelf || isEndInSelf) return true;

            const walker = document.createTreeWalker(c1, NodeFilter.SHOW_TEXT);
            let node;
            while (node = walker.nextNode()) {
                const isDirectText = !subContainers.some(sub => sub.contains(node));
                if (isDirectText && sel.containsNode(node, true)) return true;
            }
            return false;
        }).map(container => container.getAttribute('data-container-id'));

        // [3] 모든 ID 통합 및 중복 제거
        const combinedIds = Array.from(new Set([...visualSelectedIds, ...logicalActiveIds]));

        // 🔥 [4] 계층 구조 필터링 (부모-자식 관계 정리)
        // 선택된 ID들 중에 '자식'이 포함되어 있다면, '부모'는 스타일 적용 대상에서 제외합니다.
        const finalIds = combinedIds.filter(id => {
            const el = document.getElementById(id);
            if (!el) return false;

            // 다른 선택된 ID들 중에 현재 내(el)가 포함하고 있는 요소가 있는지 확인
            const hasSelectedChild = combinedIds.some(otherId => {
                if (id === otherId) return false;
                const otherEl = document.getElementById(otherId);
                return otherEl && el.contains(otherEl);
            });

            // 자식이 이미 선택되어 있다면 부모인 나는 false를 반환하여 제거됨
            return !hasSelectedChild;
        });

        // 결과 반환 및 lastActiveKey 업데이트
        if (finalIds.length > 0) {
            lastActiveKey = finalIds[finalIds.length - 1];
            return finalIds;
        }

        // 선택 영역이 컨테이너 밖일 경우 대비 (기존 fallback)
        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        const container = node.closest('[data-container-id]');
        if (container) {
            const id = container.getAttribute('data-container-id');
            lastActiveKey = id;
            return [id];
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
     * 2. 드래그 범위 추출 최적화 (O(1)~O(N) 범위 제한)
     */
    function getDomSelection(targetKey) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;

        const domRange = sel.getRangeAt(0);
        const finalKey = targetKey || getActiveKey();
        const targetContainer = document.getElementById(finalKey) || root;
        if (!targetContainer) return null;

        const isBackwards = sel.anchorNode && sel.focusNode && 
            (sel.anchorNode.compareDocumentPosition(sel.focusNode) & Node.DOCUMENT_POSITION_PRECEDING ||
            (sel.anchorNode === sel.focusNode && sel.anchorOffset > sel.focusOffset));

        const isFullCellSelected = targetContainer.classList.contains('is-selected');
        const lines = targetContainer.children; 
        const ranges = [];

        // 시작/끝 라인 직접 찾기 (전체 쿼리 제거)
        const startLineEl = domRange.startContainer.nodeType === Node.TEXT_NODE 
                            ? domRange.startContainer.parentElement.closest('.text-block')
                            : domRange.startContainer.closest('.text-block');
        const endLineEl = domRange.endContainer.nodeType === Node.TEXT_NODE 
                          ? domRange.endContainer.parentElement.closest('.text-block')
                          : domRange.endContainer.closest('.text-block');

        const startIdx = getLineIndex(startLineEl);
        const endIdx = getLineIndex(endLineEl);

        const minIdx = isFullCellSelected ? 0 : Math.max(0, Math.min(startIdx, endIdx));
        const maxIdx = isFullCellSelected ? lines.length - 1 : Math.max(startIdx, endIdx);

        for (let i = minIdx; i <= maxIdx; i++) {
            const lineEl = lines[i];
            if (!lineEl || !lineEl.classList.contains('text-block')) continue;

            if (isFullCellSelected) {
                ranges.push({ lineIndex: i, startIndex: 0, endIndex: lineEl.textContent.length });
                continue;
            }

            const pRange = document.createRange();
            pRange.selectNodeContents(lineEl);
            const isIntersecting = (domRange.compareBoundaryPoints(Range.END_TO_START, pRange) <= 0 &&
                                    domRange.compareBoundaryPoints(Range.START_TO_END, pRange) >= 0);

            if (isIntersecting) {
                let total = 0, startOffset = -1, endOffset = -1;
                const childNodes = lineEl.childNodes;

                for (let j = 0; j < childNodes.length; j++) {
                    const node = childNodes[j];
                    if (startOffset === -1) {
                        if (domRange.startContainer === lineEl && domRange.startOffset === j) startOffset = total;
                        else if (domRange.startContainer === node || node.contains(domRange.startContainer)) {
                            startOffset = total + (domRange.startContainer.nodeType === Node.TEXT_NODE ? domRange.startOffset : 0);
                        }
                    }
                    if (endOffset === -1) {
                        if (domRange.endContainer === lineEl && domRange.endOffset === j) endOffset = total;
                        else if (domRange.endContainer === node || node.contains(domRange.endContainer)) {
                            endOffset = total + (domRange.endContainer.nodeType === Node.TEXT_NODE ? domRange.endOffset : 0);
                        }
                    }
                    total += (node.nodeType === Node.TEXT_NODE || (node.classList && node.classList.contains('chunk-text'))) 
                             ? node.textContent.length : 1;
                }

                if (startOffset === -1) startOffset = lineEl.contains(domRange.startContainer) ? total : 0;
                if (endOffset === -1) endOffset = lineEl.contains(domRange.endContainer) ? total : total;

                ranges.push({ 
                    lineIndex: i, 
                    startIndex: Math.min(startOffset, endOffset), 
                    endIndex: Math.max(startOffset, endOffset) 
                });
            }
        }

        if (ranges.length > 0) {
            ranges.isBackwards = isBackwards;
            return ranges;
        }
        return null;
    }

    /**
     * 3. 커서 컨텍스트 추출
     */
    function getSelectionContext() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;

        const range = sel.getRangeAt(0);
        const container = range.startContainer;
        const el = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

        const activeContainer = el.closest('td[id], th[id]') || getActiveContainer();
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
     * 4. 멀티 블록 커서 복원 최적화
     */
    function restoreMultiBlockCursor(positions) {
        if (!positions?.length) return;
        const sel = window.getSelection();
        sel.removeAllRanges();
        
        const isBackwards = positions.isBackwards || positions[0]?.isBackwards;
        let allPoints = [];

        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            const container = document.getElementById(pos.containerId);
            if (!container || !pos.ranges) continue;

            for (let j = 0; j < pos.ranges.length; j++) {
                const rangeInfo = pos.ranges[j];
                const lineEl = container.children[rangeInfo.lineIndex];
                if (!lineEl || !lineEl.classList.contains('text-block')) continue;

                if (lineEl.querySelector('[data-container-id]') && rangeInfo.startIndex === 0 && rangeInfo.endIndex === 1) continue;

                const sPos = findNodeAndOffset(lineEl, rangeInfo.startIndex);
                const ePos = findNodeAndOffset(lineEl, rangeInfo.endIndex);
                if (sPos) allPoints.push(sPos);
                if (ePos) allPoints.push(ePos);
            }
        }

        if (allPoints.length >= 2) {
            allPoints.sort((a, b) => {
                if (a.node === b.node) return a.offset - b.offset;
                return (a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
            });

            const start = allPoints[0];
            const end = allPoints[allPoints.length - 1];
            isBackwards 
                ? sel.setBaseAndExtent(end.node, end.offset, start.node, start.offset)
                : sel.setBaseAndExtent(start.node, start.offset, end.node, end.offset);
        }
    }

    /**
     * 5. 절대 위치 및 노드 탐색 로직 (TreeWalker 활용)
     */
    function findNodeAndOffset(lineEl, targetOffset) {
        if (!lineEl) return { node: document.body, offset: 0 };

        const walker = document.createTreeWalker(
            lineEl, 
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, 
            {
                acceptNode: (node) => {
                    if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
                    if (node.nodeName === 'IMG' || node.nodeName === 'BR') return NodeFilter.FILTER_ACCEPT;
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );

        let cumulative = 0;
        let lastNode = lineEl;

        while (walker.nextNode()) {
            const node = walker.currentNode;
            const len = (node.nodeType === Node.TEXT_NODE) ? node.textContent.length : 1;

            if (targetOffset <= cumulative + len) {
                if (node.nodeType === Node.TEXT_NODE) {
                    return { node, offset: Math.max(0, targetOffset - cumulative) };
                } else {
                    const offset = (targetOffset > cumulative) ? 1 : 0;
                    return { node: node.parentNode, offset: Array.from(node.parentNode.childNodes).indexOf(node) + offset };
                }
            }
            cumulative += len;
            lastNode = node;
        }

        if (lastNode.nodeType === Node.TEXT_NODE) return { node: lastNode, offset: lastNode.textContent.length };
        return { node: lineEl, offset: lineEl.childNodes.length };
    }

    function findFirstTextNode(el) {
        if (!el) return null;
        if (el.nodeType === Node.TEXT_NODE) return el;
        for (let i = 0; i < el.childNodes.length; i++) {
            const found = findFirstTextNode(el.childNodes[i]);
            if (found) return found;
        }
        return null;
    }

    /**
     * 6. 커서 복원
     */
    function restoreCursor(cursorData) {
        if (!cursorData) return;
        const { containerId, anchor, lineIndex } = cursorData;
        const targetContainer = containerId ? document.getElementById(containerId) : getActiveContainer();
        if (!targetContainer) return;

        const sel = window.getSelection();
        sel.removeAllRanges();

        if (lineIndex !== undefined && anchor) {
            try {
                const lineEl = targetContainer.children[lineIndex];
                if (!lineEl) return;

                const chunkEl = Array.from(lineEl.children).find(el => parseInt(el.dataset.index, 10) === anchor.chunkIndex);
                if (!chunkEl) return;

                const range = document.createRange();

                if (anchor.type === 'table' && anchor.detail) {
                    const rows = chunkEl.getElementsByTagName('tr');
                    const td = rows[anchor.detail.rowIndex]?.cells[anchor.detail.colIndex];
                    if (td) {
                        let node = td.firstChild || td.appendChild(document.createTextNode('\u00A0'));
                        range.setStart(node, Math.min(anchor.detail.offset, node.length));
                    }
                } 
                else if (chunkEl.dataset.type === 'table' || anchor.type === 'video' || anchor.type === 'image') {
                    anchor.offset === 0 ? range.setStartBefore(chunkEl) : range.setStartAfter(chunkEl);
                } 
                else {
                    let node = findFirstTextNode(chunkEl) || chunkEl.appendChild(document.createTextNode(''));
                    range.setStart(node, Math.min(anchor.offset || 0, node.length));
                }

                range.collapse(true);
                sel.addRange(range);
            } catch (e) { console.error("Cursor restoration error:", e); }
        }
    }

    function getInsertionAbsolutePosition() {
        const context = getSelectionContext();
        if (!context) return null;
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

    return { 
        getSelectionPosition, 
        restoreMultiBlockCursor,
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
        getDomSelection,
        restoreSelectionPositionByChunk: (data) => restoreCursor({ containerId: lastActiveKey, lineIndex: data.lineIndex, anchor: data }),
        restoreTableSelection: (data) => restoreCursor({ containerId: lastActiveKey, lineIndex: data.lineIndex, anchor: { chunkIndex: data.chunkIndex, type: 'table', detail: data.cell } })
    };
}
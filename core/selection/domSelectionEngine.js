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
        const searchRoot = root || document.body;

        // 1. [시각적 셀 선택] is-selected 클래스가 붙은 셀 ID 수집
        const visualSelectedIds = Array.from(document.querySelectorAll('.se-table-cell.is-selected'))
            .map(td => td.getAttribute('data-container-id'));

        // 2. [기존 영역 분석] 실제 드래그 영역에 걸쳐 있는 컨테이너 분석
        const allPossibleContainers = Array.from(searchRoot.querySelectorAll('[data-container-id]'));
        if (searchRoot.hasAttribute('data-container-id')) allPossibleContainers.push(searchRoot);

        const intersecting = allPossibleContainers.filter(container => 
            sel.containsNode(container, true)
        );

        // 계층적 필터링을 통해 실제 콘텐츠가 포함된 ID 추출
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
                if (isDirectText && sel.containsNode(node, true)) {
                    return true;
                }
            }
            return false;
        }).map(container => container.getAttribute('data-container-id'));

        // 3. [합치기] 시각적 선택 ID와 논리적 드래그 ID를 합치고 중복 제거
        const combinedIds = Array.from(new Set([...visualSelectedIds, ...logicalActiveIds]));

        if (combinedIds.length > 0) {
            lastActiveKey = combinedIds[combinedIds.length - 1];
            return combinedIds;
        }

        // 4. 커서(Collapsed) 처리 (기존과 동일)
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
        console.log('activeKey:', activeKey );
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
        const parentDom = el.closest('.text-block');
        if (!parentDom || !activeContainer.contains(parentDom)) return null;

        // activeContainer 직계 자식들 중 .text-block들만 추려서 인덱스를 찾습니다.
        const lines = Array.from(activeContainer.querySelectorAll(':scope > .text-block'));
        const lineIndex = lines.indexOf(parentDom);
        if (lineIndex < 0) return null;

        const rawActiveNode = el.closest('[data-index]');
        const activeNode = rawActiveNode && activeContainer.contains(rawActiveNode) ? rawActiveNode : null;
        const dataIndex = activeNode?.dataset.index !== undefined ? parseInt(activeNode.dataset.index, 10) : null;

        return {
            activeContainer,
            containerId: activeContainer.id,
            lineIndex,
            parentDom,
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
     * 모든 포인트를 수집하여 문서 순서대로 정렬한 뒤, 
     * 사용자의 드래그 방향(isBackwards)을 살려 복원하는 가장 안정적인 방식
     */
    function restoreMultiBlockCursor(positions) {
        if (!positions?.length) return;

        const sel = window.getSelection();
        sel.removeAllRanges();
        
        const isBackwards = positions.isBackwards || positions[0]?.isBackwards;
        let allPoints = [];

        positions.forEach((pos) => {
            const container = document.getElementById(pos.containerId);
            if (!container || !pos.ranges) return;

            const lines = Array.from(container.querySelectorAll(':scope > .text-block'));

            pos.ranges.forEach(rangeInfo => {
                const lineEl = lines[rangeInfo.lineIndex];
                if (!lineEl) return;

                // 부모-자식 간 중복 데이터 방지 (자식 컨테이너가 있다면 부모 데이터는 스킵)
                const hasSub = lineEl.querySelector('[data-container-id]');
                if (hasSub && rangeInfo.startIndex === 0 && rangeInfo.endIndex === 1) return;

                const sPos = findNodeAndOffset(lineEl, rangeInfo.startIndex);
                const ePos = findNodeAndOffset(lineEl, rangeInfo.endIndex);
                
                if (sPos) allPoints.push(sPos);
                if (ePos) allPoints.push(ePos);
            });
        });

        if (allPoints.length >= 2) {
            // 1. 실제 DOM 위치 순서로 모든 포인트를 정렬
            allPoints.sort((a, b) => {
                if (a.node === b.node) return a.offset - b.offset;
                return (a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
            });

            // 2. 최상단과 최하단 포인트 추출
            const start = allPoints[0];
            const end = allPoints[allPoints.length - 1];

            // 3. setBaseAndExtent를 사용하여 드래그 방향성까지 완벽 복원
            if (isBackwards) {
                // 역방향: Focus를 Start에, Anchor를 End에
                sel.setBaseAndExtent(end.node, end.offset, start.node, start.offset);
            } else {
                // 순방향: Anchor를 Start에, Focus를 End에
                sel.setBaseAndExtent(start.node, start.offset, end.node, end.offset);
            }
        }
    }

    /**
     * 특정 라인 내에서 절대 오프셋을 기준으로 정확한 TextNode와 Offset을 찾아냄
     */
    function findNodeAndOffset(lineEl, targetOffset) {
        if (!lineEl) return { node: document.body, offset: 0 };

        // TreeWalker를 사용하되, 텍스트 노드뿐만 아니라 엘리먼트(IMG 등)도 위치 계산에 포함
        const walker = document.createTreeWalker(
            lineEl, 
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, 
            {
                acceptNode: (node) => {
                    // 텍스트 노드이거나, 자식이 없는 단독 엘리먼트(IMG, BR 등)만 카운트
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
                    // 이미지나 BR인 경우 해당 노드의 앞 또는 뒤
                    const offset = (targetOffset > cumulative) ? 1 : 0;
                    return { node: node.parentNode, offset: Array.from(node.parentNode.childNodes).indexOf(node) + offset };
                }
            }
            cumulative += len;
            lastNode = node;
        }

        // 오프셋을 못 찾은 경우 (마지막 지점)
        if (lastNode.nodeType === Node.TEXT_NODE) {
            return { node: lastNode, offset: lastNode.textContent.length };
        }
        return { node: lineEl, offset: lineEl.childNodes.length };
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

        if (lineIndex !== undefined && anchor) {
            try {
                const lineEl = allLines[lineIndex];
                const chunkEl = Array.from(lineEl.children).find(el => parseInt(el.dataset.index, 10) === anchor.chunkIndex);
                if (!chunkEl) return;

                const range = document.createRange();

                // 1. 테이블 타입이면서 상세 셀 정보가 있는 경우 (셀 내부로 진입)
                if (anchor.type === 'table' && anchor.detail) {
                    const td = chunkEl.querySelectorAll('tr')[anchor.detail.rowIndex]?.querySelectorAll('td')[anchor.detail.colIndex];
                    if (td) {
                        let node = td.firstChild || td.appendChild(document.createTextNode('\u00A0'));
                        range.setStart(node, Math.min(anchor.detail.offset, node.length));
                    }
                } 
                // 2. 테이블 청크이지만 상세 정보가 없는 경우 (테이블 앞/뒤에 커서 위치)
                else if (chunkEl.getAttribute('data-type') === 'table') {
                    // offset이 0이면 테이블 앞, 그외엔 테이블 뒤
                    if (anchor.offset === 0) {
                        range.setStartBefore(chunkEl);
                    } else {
                        range.setStartAfter(chunkEl);
                    }
                }
                // 3. 비디오나 이미지 (기존 로직 유지)
                else if (anchor.type === 'video' || anchor.type === 'image') {
                    anchor.offset === 0 ? range.setStartBefore(chunkEl) : range.setStartAfter(chunkEl);
                } 
                // 4. 일반 텍스트 청크
                else {
                    let node = findFirstTextNode(chunkEl) || chunkEl.appendChild(document.createTextNode(''));
                    range.setStart(node, Math.min(anchor.offset || 0, node.length));
                }

                range.collapse(true);
                sel.addRange(range);
            } catch (e) {
                console.error("Cursor restoration error:", e);
            }
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
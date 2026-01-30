export function createSelectionService({ root }) {
    let lastValidPos  = null;
    let lastActiveKey = null;
    let isRestoringCursor = true; // 플래그 On
    let cacheActiveKeys = null;

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

    function getActiveKeys() {
        return cacheActiveKeys;
    }

    /**
     * 1. 실제로 콘텐츠가 선택된 모든 컨테이너 ID 반환
     */ 
    function syncActiveKeys() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return [lastActiveKey].filter(Boolean);

        const range = sel.getRangeAt(0);
        const searchRoot = root || document.body;

        // 1. 시각적으로 선택된(is-selected) 아이디 수집
        const visualSelectedNodes = document.getElementsByClassName('se-table-cell is-selected');
        const visualSelectedIds = [];
        for (let i = 0; i < visualSelectedNodes.length; i++) {
            const id = visualSelectedNodes[i].getAttribute('data-container-id');
            if (id) visualSelectedIds.push(id);
        }

        // 2. 전체 컨테이너 중 선택 영역에 걸쳐 있는 것들 수집
        const allPossibleContainers = Array.from(searchRoot.querySelectorAll('[data-container-id]'));
        if (searchRoot.hasAttribute('data-container-id')) allPossibleContainers.push(searchRoot);

        const intersecting = allPossibleContainers.filter(container => 
            sel.containsNode(container, true)
        );

        // 3. 중첩 구조 분석 및 'is-not-selected' 필터링
        const logicalActiveIds = intersecting.filter(c1 => {
            // 🔥 [핵심] 제외 클래스가 붙어 있다면 시스템은 이를 무시함
            if (c1.classList.contains('is-not-selected')) return false;

            const subContainers = intersecting.filter(c2 => c1 !== c2 && c1.contains(c2));
            
            // 하위 컨테이너가 없다면 (Leaf 노드) 선택된 것으로 간주
            if (subContainers.length === 0) return true;

            // 하위 컨테이너가 있다면, '순수하게 c1에만 속한 텍스트'가 선택되었는지 검사
            const isStartInSelf = c1.contains(range.startContainer) && 
                !subContainers.some(sub => sub.contains(range.startContainer));
            
            const isEndInSelf = c1.contains(range.endContainer) && 
                !subContainers.some(sub => sub.contains(range.endContainer));

            if (isStartInSelf || isEndInSelf) return true;

            // TreeWalker를 이용해 하위 컨테이너에 속하지 않은 직접 텍스트 노드가 선택되었는지 확인
            const walker = document.createTreeWalker(c1, NodeFilter.SHOW_TEXT);
            let node;
            while (node = walker.nextNode()) {
                const isDirectText = !subContainers.some(sub => sub.contains(node));
                if (isDirectText && sel.containsNode(node, true)) return true;
            }
            return false;
        }).map(container => container.getAttribute('data-container-id'));

        // 4. 결과 병합 (중복 제거)
        const combinedIds = Array.from(new Set([...visualSelectedIds, ...logicalActiveIds]));

        if (combinedIds.length > 0) {
            lastActiveKey = combinedIds[combinedIds.length - 1];
            return combinedIds;
        }
        
        // 선택 영역이 없을 경우 마지막 활성 키 반환
        return [lastActiveKey].filter(Boolean);
    }

    function refreshActiveKeys() {
        cacheActiveKeys = syncActiveKeys();
    }

    function ensureActiveKeys() {
        if (cacheActiveKeys === null) {
            refreshActiveKeys();
        }
        return cacheActiveKeys || [];
    }

    function getActiveKey() {
        const keys = ensureActiveKeys();
        return keys.length > 0 ? keys[keys.length - 1] : lastActiveKey;
    }

    function getActiveContainer() {
        const activeKey = ensureActiveKeys();
        return (activeKey ? document.getElementById(activeKey) : null) || root;
    }

    /**
     * 2. 셀 전체 선택 시 누락 방지 및 중첩 구조 인덱스 보정 포함
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
        isRestoringCursor = true;
        const sel = window.getSelection();
        sel.removeAllRanges();
        
        const isBackwards = positions.isBackwards || positions[0]?.isBackwards;
        let allPoints = [];

        // positions에 포함된 containerId들을 Set으로 변환 (빠른 검색용)
        const posIds = new Set(positions.map(p => p.containerId));

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

        // 비선택 영역 클래스 처리 ---
        posIds.forEach(key => {
            const el = document.getElementById(key);
            if (!el) return;
            // positions 데이터에 없는 키라면? -> 선택 영역 사이에 끼어있는 비선택 영역임
            if (!posIds.has(key)) {
                el.classList.add('is-not-selected');
                el.classList.remove('is-selected');
            } else {
                // 데이터에 있다면 is-not-selected 제거
                el.classList.remove('is-not-selected');
            }
        });
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
        // 기존의 모든 선택 영역을 지우는 것은 동일합니다.
        sel.removeAllRanges();

        if (lineIndex !== undefined && anchor) {
            try {
                const lineEl = targetContainer.children[lineIndex];
                if (!lineEl) return;

                const chunkEl = Array.from(lineEl.children).find(el => parseInt(el.dataset.index, 10) === anchor.chunkIndex);
                if (!chunkEl) return;

                let targetNode = null;
                let targetOffset = 0;

                // 1. 테이블 내부의 셀 위치 계산
                if (anchor.type === 'table' && anchor.detail) {
                    const rows = chunkEl.getElementsByTagName('tr');
                    const td = rows[anchor.detail.rowIndex]?.cells[anchor.detail.colIndex];
                    if (td) {
                        targetNode = td.firstChild || td.appendChild(document.createTextNode('\u00A0'));
                        targetOffset = Math.min(anchor.detail.offset, targetNode.length);
                    }
                } 
                // 2. 개체(이미지, 비디오, 테이블 자체)의 앞/뒤 위치 계산
                else if (chunkEl.dataset.type === 'table' || anchor.type === 'video' || anchor.type === 'image') {
                    targetNode = chunkEl.parentNode;
                    const chunkPos = Array.from(targetNode.childNodes).indexOf(chunkEl);
                    targetOffset = (anchor.offset === 0) ? chunkPos : chunkPos + 1;
                } 
                // 3. 일반 텍스트 노드 위치 계산
                else {
                    targetNode = findFirstTextNode(chunkEl) || chunkEl.appendChild(document.createTextNode(''));
                    targetOffset = Math.min(anchor.offset || 0, targetNode.length);
                }

                // 🔥 핵심: Range 객체 생성 없이 Selection에 직접 좌표를 찍습니다.
                // 시작점(Base)과 끝점(Extent)을 똑같이 주면 '커서'가 됩니다.
                if (targetNode) {
                    sel.setBaseAndExtent(targetNode, targetOffset, targetNode, targetOffset);
                }

            } catch (e) { 
                console.error("Cursor restoration error:", e); 
            }
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
        getActiveKeys,
        getSelectionPosition, 
        refreshActiveKeys,
        getIsRestoring: () => isRestoringCursor,
        setIsRestoring: (val) => { isRestoringCursor = val; },        
        restoreMultiBlockCursor,
        getActiveKey,
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
    };
}
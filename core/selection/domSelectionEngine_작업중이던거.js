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

        if (!sel.isCollapsed) {
            const searchRoot = root || document.body;
            const rootId = searchRoot.getAttribute('data-container-id');
            
            const allPossibleContainers = Array.from(searchRoot.querySelectorAll('[data-container-id]'));
            if (searchRoot.hasAttribute('data-container-id')) allPossibleContainers.push(searchRoot);

            // 1. 선택 영역에 조금이라도 걸쳐 있는 모든 컨테이너
            const intersecting = allPossibleContainers.filter(container => 
                sel.containsNode(container, true)
            );

            // 2. 계층적 필터링 로직 개선
            const activeIds = intersecting.filter(c1 => {
                const c1Id = c1.getAttribute('data-container-id');
                
                // 나(c1)를 포함하는 하위 컨테이너들이 있는지 찾음
                const subContainers = intersecting.filter(c2 => c1 !== c2 && c1.contains(c2));
                
                // 만약 하위 컨테이너가 없다면 (최하위 Leaf 노드), 무조건 포함
                if (subContainers.length === 0) return true;

                /**
                 * [핵심] 부모 컨테이너(c1)를 포함시킬지 결정하는 조건:
                 * 하위 컨테이너(subContainers)들 외에 c1 본인만의 "직계 콘텐츠"가 선택 영역에 포함되었는가?
                 */
                
                // 시작점이나 끝점이 c1 내부에 있으면서, 동시에 어떤 자식 컨테이너 내부에도 있지 않다면 c1의 직계 영역임
                const isStartInSelf = c1.contains(range.startContainer) && 
                    !subContainers.some(sub => sub.contains(range.startContainer));
                
                const isEndInSelf = c1.contains(range.endContainer) && 
                    !subContainers.some(sub => sub.contains(range.endContainer));

                // 만약 시작이나 끝이 부모 직계 영역이라면 부모는 무조건 포함
                if (isStartInSelf || isEndInSelf) return true;

                // 시작/끝은 자식 안에 있지만, 부모의 텍스트 노드가 중간에 걸쳐 있는 경우 (복잡한 드래그)
                // c1의 직계 텍스트 노드 중 하나라도 선택 영역에 포함되어 있는지 확인
                const walker = document.createTreeWalker(c1, NodeFilter.SHOW_TEXT);
                let node;
                while (node = walker.nextNode()) {
                    // 이 텍스트 노드가 자식 컨테이너에 속하지 않는 c1의 직계 노드인지 확인
                    const isDirectText = !subContainers.some(sub => sub.contains(node));
                    if (isDirectText && sel.containsNode(node, true)) {
                        return true;
                    }
                }

                // 위 조건에 해당하지 않으면 이 부모는 "자식들을 감싸고만 있을 뿐" 직접적인 선택 대상이 아님
                return false;
            }).map(container => container.getAttribute('data-container-id'));

            if (activeIds.length > 0) {
                lastActiveKey = activeIds[activeIds.length - 1];
                return activeIds;
            }
        }

        // 커서 상태 (Collapsed) 로직은 동일
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

    // [핵심] 역방향 드래그 여부 확인
    const isBackwards = sel.anchorNode && sel.focusNode && 
        (sel.anchorNode.compareDocumentPosition(sel.focusNode) & Node.DOCUMENT_POSITION_PRECEDING ||
        (sel.anchorNode === sel.focusNode && sel.anchorOffset > sel.focusOffset));

    const domRange = sel.getRangeAt(0);
    const finalKey = targetKey || getActiveKey();
    const targetContainer = document.getElementById(finalKey) || root;
    
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

    if (ranges.length > 0) {
        // [수정] 배열 자체에 속성을 부여하여 기존 forEach 루프 등을 깨뜨리지 않음
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
     * 다중 블록/셀 커서 및 시각적 선택 상태 복원
     * - block selection은 DOM Range 기반 유지
     * - table cell은 시각적 선택만
     */
/**
 * 다중 블록 및 중첩 구조를 고려한 선택 영역 복원
 */
function restoreMultiBlockCursor(positions) {
    if (!positions?.length) return;

    const sel = window.getSelection();
    sel.removeAllRanges();
    
    const isBackwards = positions.isBackwards || positions[0]?.isBackwards;
    let allExtractedPoints = [];

    positions.forEach((pos) => {
        const container = document.getElementById(pos.containerId);
        if (!container || !pos.ranges) return;

        const lines = Array.from(container.querySelectorAll(':scope > .text-block'));

        pos.ranges.forEach(rangeInfo => {
            const lineEl = lines[rangeInfo.lineIndex];
            if (!lineEl) return;

            // [수정 핵심] 중복 선택 방지 로직
            const hasSubContainer = lineEl.querySelector('[data-container-id]');
            
            if (hasSubContainer) {
                /**
                 * 케이스 1: 라인 전체가 자식 컨테이너인 경우 (예: 테이블만 있는 줄)
                 * 이 라인의 startIndex/endIndex가 자식 컨테이너 전체를 감싸는 0~1 이라면
                 * 부모의 좌표로서 추가하지 않습니다. (자식 데이터에서 이미 처리됨)
                 */
                const isOnlyContainer = lineEl.children.length === 1 && lineEl.firstElementChild.hasAttribute('data-container-id');
                if (isOnlyContainer && rangeInfo.startIndex === 0 && rangeInfo.endIndex === 1) {
                    return; // 부모 단계에서는 이 좌표를 버립니다.
                }

                /**
                 * 케이스 2: 내용 [테이블] 내용 인 경우
                 * findNodeAndOffset이 테이블(자식) 내부의 노드를 가리키지 않도록 보호해야 합니다.
                 * 여기서는 일단 좌표를 수집하되, 나중에 정렬로 해결합니다.
                 */
            }

            const sPos = findNodeAndOffset(lineEl, rangeInfo.startIndex);
            const ePos = findNodeAndOffset(lineEl, rangeInfo.endIndex);
            
            if (sPos) allExtractedPoints.push(sPos);
            if (ePos) allExtractedPoints.push(ePos);
        });
    });

    if (allExtractedPoints.length >= 2) {
        // 물리적인 DOM 순서로 정렬 (이게 핵심)
        allExtractedPoints.sort((a, b) => {
            if (a.node === b.node) return a.offset - b.offset;
            // a가 b보다 앞에 있으면 -1
            return (a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
        });

        // 가장 첫 지점과 가장 끝 지점만 연결
        const startPoint = allExtractedPoints[0];
        const endPoint = allExtractedPoints[allExtractedPoints.length - 1];

        if (isBackwards) {
            sel.setBaseAndExtent(endPoint.node, endPoint.offset, startPoint.node, startPoint.offset);
        } else {
            sel.setBaseAndExtent(startPoint.node, startPoint.offset, endPoint.node, endPoint.offset);
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
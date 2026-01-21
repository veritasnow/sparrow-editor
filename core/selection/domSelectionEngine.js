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
     * 다중 블록/셀 커서 및 시각적 선택 상태 복원
     * - block selection은 DOM Range 기반 유지
     * - table cell은 시각적 선택만
     */
    function restoreMultiBlockCursor(positions) {
        if (!positions?.length) return;

        const sel = window.getSelection();
        sel.removeAllRanges();

        // 1. 시각적 하이라이트 초기화
        document.querySelectorAll('.is-selected-range').forEach(el => el.classList.remove('is-selected-range'));
        
        try {
            let globalStart = null;
            let globalEnd = null;

            positions.forEach((pos) => {
                const container = document.getElementById(pos.containerId);
                if (!container) return;

                // 시각적 강조 클래스 추가
                container.classList.add('is-selected-range');

                if (!pos.ranges || pos.ranges.length === 0) return;

                /**
                 * 핵심 로직: 
                 * 해당 컨테이너 내에서 '직계'로 관리되는 라인들(.text-block)을 찾습니다.
                 * 만약 .text-block이 없다면 컨테이너 자체를 단일 라인으로 취급합니다.
                 */
                const lines = Array.from(container.querySelectorAll(':scope > .text-block'));
                const targetLines = lines.length > 0 ? lines : [container];

                // 현재 컨테이너의 선택 범위 추출
                const firstR = pos.ranges[0];
                const lastR = pos.ranges[pos.ranges.length - 1];

                const sPos = findNodeAndOffset(targetLines[firstR.lineIndex] || targetLines[0], firstR.startIndex);
                const ePos = findNodeAndOffset(targetLines[lastR.lineIndex] || targetLines[targetLines.length - 1], lastR.endIndex);

                // 3. 전체 문서상에서 가장 앞쪽/뒤쪽 포인트를 갱신 (Stitching)
                // compareDocumentPosition을 이용하여 물리적 순서를 비교합니다.
                if (!globalStart || (sPos.node.compareDocumentPosition(globalStart.node) & Node.DOCUMENT_POSITION_FOLLOWING)) {
                    globalStart = sPos;
                }
                // ePos가 현재의 globalEnd보다 뒤에 있다면 갱신
                if (!globalEnd || (ePos.node.compareDocumentPosition(globalEnd.node) & Node.DOCUMENT_POSITION_PRECEDING)) {
                    globalEnd = ePos;
                }
            });

            // 4. 최종적으로 단일 Range 생성 및 적용
            if (globalStart && globalEnd) {
                const range = document.createRange();
                range.setStart(globalStart.node, globalStart.offset);
                range.setEnd(globalEnd.node, globalEnd.offset);
                sel.addRange(range);
            }
            
            // 마지막으로 포커스 처리
            const lastId = positions[positions.length - 1].containerId;
            const lastEl = document.getElementById(lastId);
            if (lastEl) {
                // 포커스 시 스크롤 이동 방지 옵션을 줄 수 있음
                lastEl.focus({ preventScroll: true });
            }

        } catch (e) {
            console.error('영역 복구 중 오류:', e);
        }
    }

    /*
    function restoreMultiBlockCursor(positions) {
        if (!positions?.length) return;

        const sel = window.getSelection();
        sel.removeAllRanges();

        // 1. 시각적 하이라이트 초기화
        document.querySelectorAll('.is-selected-range').forEach(el => el.classList.remove('is-selected-range'));
        
        try {
            // 2. 단일 컨테이너 내에서의 선택인지 확인 (JSON 예시처럼 셀 하나 내부만 선택한 경우)
            const isSingleContainer = positions.length === 1;

            if (isSingleContainer) {
                const pos = positions[0];
                const container = document.getElementById(pos.containerId);
                if (!container || !pos.ranges?.length) return;

                // 셀 내부의 특정 위치 찾기
                const lines = Array.from(container.querySelectorAll(':scope > .text-block'));
                const targetLines = lines.length > 0 ? lines : [container];

                const firstR = pos.ranges[0];
                const lastR = pos.ranges[pos.ranges.length - 1];

                const sPos = findNodeAndOffset(targetLines[firstR.lineIndex] || container, firstR.startIndex);
                const ePos = findNodeAndOffset(targetLines[lastR.lineIndex] || container, lastR.endIndex);

                const range = document.createRange();
                range.setStart(sPos.node, sPos.offset);
                range.setEnd(ePos.node, ePos.offset);
                sel.addRange(range);
                
                container.focus();
            } 
            else {
                // 3. 여러 컨테이너(셀+바깥 등)에 걸친 다중 선택인 경우
                let globalStart = null;
                let globalEnd = null;

                positions.forEach((pos) => {
                    const container = document.getElementById(pos.containerId);
                    if (!container) return;

                    // 여러 셀을 넘나들 때는 시각적 클래스 부여 (통째로 선택된 느낌을 줌)
                    container.classList.add('is-selected-range');

                    const isMainEditor = pos.containerId.endsWith('-content');
                    const lines = isMainEditor 
                        ? Array.from(container.children).filter(el => el.classList.contains('text-block') || el.tagName === 'TABLE')
                        : [container]; // 다중 셀 선택시엔 셀 단위를 한 줄로 취급

                    if (pos.ranges?.length > 0) {
                        const sPos = findNodeAndOffset(lines[pos.ranges[0].lineIndex] || container, pos.ranges[0].startIndex);
                        const ePos = findNodeAndOffset(lines[pos.ranges[pos.ranges.length - 1].lineIndex] || container, pos.ranges[pos.ranges.length - 1].endIndex);

                        if (!globalStart || (sPos.node.compareDocumentPosition(globalStart.node) & Node.DOCUMENT_POSITION_FOLLOWING)) {
                            globalStart = sPos;
                        }
                        if (!globalEnd || (ePos.node.compareDocumentPosition(globalEnd.node) & Node.DOCUMENT_POSITION_PRECEDING)) {
                            globalEnd = ePos;
                        }
                    }
                });

                if (globalStart && globalEnd) {
                    const range = document.createRange();
                    range.setStart(globalStart.node, globalStart.offset);
                    range.setEnd(globalEnd.node, globalEnd.offset);
                    sel.addRange(range);
                }
                
                const lastId = positions[positions.length - 1].containerId;
                document.getElementById(lastId)?.focus();
            }

        } catch (e) {
            console.error('영역 복구 중 오류:', e);
        }
    }
    */


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
// /module/uiModule/service/selectionService.js

export function createSelectionService({ root }) {
    let lastValidPos = null;
    let lastActiveKey = null;

    /**
     * 1. 실제로 콘텐츠(텍스트)가 선택된 모든 컨테이너 ID를 배열로 반환
     */ 
    function getActiveKeys() {
        const sel = window.getSelection();
        // 선택 영역이 없으면 마지막 활성화된 키 반환
        if (!sel || sel.rangeCount === 0) return [lastActiveKey].filter(Boolean);

        const range = sel.getRangeAt(0);
        
        // 1. 드래그 영역(Selection)이 있는 경우: 범위 내의 모든 컨테이너 탐색
        // range.commonAncestorContainer는 선택 영역을 포함하는 가장 가까운 공통 부모입니다.
        const commonAncestor = range.commonAncestorContainer;
        const searchRoot = commonAncestor.nodeType === Node.ELEMENT_NODE 
            ? commonAncestor 
            : commonAncestor.parentElement;

        // 선택 영역 내에 포함된 모든 [data-container-id] 요소를 찾습니다.
        const allPossibleContainers = Array.from(searchRoot.querySelectorAll('[data-container-id]'));
        
        // 브라우저의 containsNode API를 사용하여 실제로 선택 영역과 겹치는 컨테이너만 필터링
        const activeIds = allPossibleContainers
            .filter(container => sel.containsNode(container, true)) // true: 부분적으로 겹쳐도 포함
            .map(container => container.getAttribute('data-container-id'));

        if (activeIds.length > 0) {
            lastActiveKey = activeIds[activeIds.length - 1];
            return activeIds;
        }

        // 2. 드래그 영역이 없거나 매우 좁은 경우 (단일 커서)
        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        
        // 커서가 위치한 곳에서 가장 가까운 컨테이너를 찾음
        const container = node.closest('[data-container-id]');
        if (container) {
            const id = container.getAttribute('data-container-id');
            lastActiveKey = id;
            return [id];
        }

        // 3. 컨테이너 내부가 아닌 루트 에디터 빈 공간 등에 있을 경우
        const rootEditor = node.closest('[data-editor-root]');
        if (rootEditor) {
            const rootId = rootEditor.id;
            lastActiveKey = rootId;
            return [rootId];
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

        // --- [Case 1] 다중 라인 드래그 선택 영역 복원 ---
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
            } catch (e) { 
                console.error('Block selection restore failed:', e); 
            }
            return;
        }

        // --- [Case 2] 단일 커서(Caret) 위치 복원 ---
        if (cursorData.lineIndex === undefined) return;
        const lineEl = allLines[cursorData.lineIndex];
        if (!lineEl) return;

        try {
            const { anchor } = cursorData;
            const chunkIndex = anchor.chunkIndex ?? 0;
            
            // 해당 인덱스의 청크 엘리먼트 찾기
            const chunkEl = Array.from(lineEl.children).find(el => 
                parseInt(el.dataset.index, 10) === chunkIndex
            );

            if (!chunkEl) {
                // 청크를 못 찾으면 해당 라인의 맨 앞으로 fallback
                const pos = findNodeAndOffset(lineEl, 0);
                range.setStart(pos.node, pos.offset);
            } 
            // 1. 테이블 내부 셀로 진입해야 하는 경우 (detail 정보가 명시됨)
            else if (anchor.type === 'table' && anchor.detail) {
                const trs = chunkEl.querySelectorAll('tr');
                const targetTr = trs[anchor.detail.rowIndex];
                const targetTd = targetTr?.querySelectorAll('td')[anchor.detail.colIndex];
                
                if (targetTd) {
                    // 셀 내부의 첫 번째 텍스트 노드를 찾거나 생성
                    let node = findFirstTextNode(targetTd) || targetTd.appendChild(document.createTextNode('\u200B'));
                    range.setStart(node, Math.min(anchor.detail.offset, node.length));
                } else {
                    // 셀을 못 찾으면 테이블 앞으로
                    range.setStartBefore(chunkEl);
                }
            } 
            // 2. Atomic 청크 (테이블, 비디오, 이미지)의 앞/뒤에 위치해야 하는 경우
            // (detail이 없거나 타입이 명시적으로 Atomic인 경우)
            else if (chunkEl.dataset.type === 'table' || anchor.type === 'video' || anchor.type === 'image') {
                if (anchor.offset === 0) {
                    range.setStartBefore(chunkEl);
                } else {
                    range.setStartAfter(chunkEl);
                }
            } 
            // 3. 일반 텍스트 청크 또는 기타
            else {
                const pos = findNodeAndOffset(chunkEl, anchor.offset || 0);
                range.setStart(pos.node, pos.offset);
            }

            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (e) { 
            console.warn('Block caret restore failed:', e); 
        }
    }    

    /**
     * 다중 블록/셀 커서 및 시각적 선택 상태 복원 (개선판)
     */
    function restoreMultiBlockCursor(positions) {
        if (!positions || (Array.isArray(positions) && positions.length === 0)) return;

        const posArray = Array.isArray(positions) ? positions : [positions];
        const sel = window.getSelection();
        sel.removeAllRanges();

        // 1. 시각적 초기화 및 하이라이트 부여
        document.querySelectorAll('.is-selected-range').forEach(el => el.classList.remove('is-selected-range'));
        posArray.forEach(p => {
            const el = document.getElementById(p.containerId);
            if (el) el.classList.add('is-selected-range');
        });

        try {
            const range = document.createRange();

            // --- 2. 시작 지점 설정 (배열의 첫 번째 요소) ---
            const first = posArray[0];
            const startContainer = document.getElementById(first.containerId) || root;
            
            // 핵심 수정: :scope > .text-block 을 사용하여 테이블 내부 줄 무시
            const startLines = startContainer.querySelectorAll(':scope > .text-block');
            let startNode, startOffset;
            
            if (first.isSelection && first.ranges && first.ranges.length > 0) {
                const r = first.ranges[0];
                const line = startLines[r.lineIndex] || startContainer;
                const pos = findNodeAndOffset(line, r.startIndex);
                startNode = pos.node;
                startOffset = pos.offset;
            } else {
                const line = startLines[first.lineIndex || 0] || startContainer;
                const pos = findNodeAndOffset(line, first.anchor?.offset || 0);
                startNode = pos.node;
                startOffset = pos.offset;
            }

            // --- 3. 끝 지점 설정 (배열의 마지막 요소) ---
            const last = posArray[posArray.length - 1];
            const endContainer = document.getElementById(last.containerId) || root;
            const endLines = endContainer.querySelectorAll(':scope > .text-block');
            
            let endNode, endOffset;
            if (last.isSelection && last.ranges && last.ranges.length > 0) {
                const r = last.ranges[last.ranges.length - 1];
                const line = endLines[r.lineIndex] || endContainer;
                const pos = findNodeAndOffset(line, r.endIndex);
                endNode = pos.node;
                endOffset = pos.offset;
            } else {
                const line = endLines[last.lineIndex || 0] || endContainer;
                const pos = findNodeAndOffset(line, last.anchor?.offset || 0);
                endNode = pos.node;
                endOffset = pos.offset;
            }

            // --- 4. 물리적 Range 결합 및 적용 ---
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
            sel.addRange(range);

            endContainer.focus();

        } catch (e) {
            console.error("Selection 복구 실패:", e);
        }
    }

    function findNodeAndOffset(lineEl, targetOffset) {
        // 텍스트와 엘리먼트(이미지 등)를 모두 탐색
        const walker = document.createTreeWalker(
            lineEl, 
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, 
            {
                acceptNode: (node) => {
                    // 텍스트 노드이거나 이미지/특수 청크인 경우만 수락
                    if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
                    if (node.nodeName === 'IMG' || node.classList?.contains('chunk-image')) return NodeFilter.FILTER_ACCEPT;
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );

        let cumulativeOffset = 0;
        let lastNode = null;

        while (walker.nextNode()) {
            const node = walker.currentNode;
            // 이미지 등 엘리먼트면 길이를 1로, 텍스트면 텍스트 길이로 계산
            const nodeLength = (node.nodeType === Node.TEXT_NODE) ? node.textContent.length : 1;

            if (targetOffset >= cumulativeOffset && targetOffset <= cumulativeOffset + nodeLength) {
                if (node.nodeType === Node.TEXT_NODE) {
                    return { node, offset: targetOffset - cumulativeOffset };
                } else {
                    // 노드가 이미지인 경우, 오프셋 0이면 이미지 앞, 1이면 이미지 뒤
                    const parent = node.parentNode;
                    const index = Array.from(parent.childNodes).indexOf(node);
                    return { node: parent, offset: targetOffset > cumulativeOffset ? index + 1 : index };
                }
            }
            cumulativeOffset += nodeLength;
            lastNode = node;
        }

        // 폴백 처리
        if (!lastNode) {
            const textNode = lineEl.firstChild || lineEl.appendChild(document.createTextNode(''));
            return { node: textNode, offset: 0 };
        }
        return { 
            node: lastNode.nodeType === Node.TEXT_NODE ? lastNode : lastNode.parentNode, 
            offset: lastNode.nodeType === Node.TEXT_NODE ? lastNode.textContent.length : Array.from(lastNode.parentNode.childNodes).indexOf(lastNode) + 1 
        };
    }    
    /*
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
    */

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
        restoreBlockCursor,
        getDomSelection,
        restoreSelectionPositionByChunk: (data) => restoreCursor({ containerId: lastActiveKey, lineIndex: data.lineIndex, anchor: data }),
        restoreTableSelection: (data) => restoreCursor({ containerId: lastActiveKey, lineIndex: data.lineIndex, anchor: { chunkIndex: data.chunkIndex, type: 'table', detail: data.cell } })
    };
}
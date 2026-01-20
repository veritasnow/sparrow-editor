// /module/uiModule/service/selectionService.js

export function createSelectionService({ root }) {
    let lastValidPos = null;
    let lastActiveKey = null;

    /**
     * 1. 실제로 콘텐츠(텍스트)가 선택된 모든 컨테이너 ID를 배열로 반환
     */ 
    function getActiveKeys() {
        const sel = window.getSelection();
        // 선택 정보가 아예 없으면 마지막 활성 키 반환
        if (!sel || sel.rangeCount === 0) return [lastActiveKey].filter(Boolean);

        const range = sel.getRangeAt(0);

        // 1. 드래그 영역이 있는 경우 (Selection)
        if (!sel.isCollapsed) {
            // 루트를 포함하여 모든 [data-container-id]를 검색 대상으로 잡습니다.
            // root 자체가 data-container-id를 가지고 있다면 querySelectorAll 결과에 포함됩니다.
            const searchRoot = root || document.body;
            const allPossibleContainers = Array.from(searchRoot.querySelectorAll('[data-container-id]'));
            
            // 만약 root 자기 자신도 ID를 가졌다면 배열에 추가
            if (searchRoot.hasAttribute('data-container-id')) {
                allPossibleContainers.push(searchRoot);
            }

            const activeIds = allPossibleContainers
                .filter(container => sel.containsNode(container, true))
                .map(container => container.getAttribute('data-container-id'));

            if (activeIds.length > 0) {
                lastActiveKey = activeIds[activeIds.length - 1];
                return activeIds;
            }
        }

        // 2. 단일 커서(Caret)인 경우
        // 드래그가 없더라도 현재 커서가 위치한 가장 가까운 컨테이너 하나만 찾으면 됩니다.
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
    /*
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
    */

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

        // 기존 시각적 선택 초기화
        document
            .querySelectorAll('.is-selected-range')
            .forEach(el => el.classList.remove('is-selected-range'));

        let globalStart = null;
        let globalEnd = null;

        try {
            positions.forEach(pos => {
                const container = document.getElementById(pos.containerId);
                if (!container || !pos.ranges?.length) return;

                // 🔴 table cell은 Range 계산에서 제외
                if (pos.containerId.startsWith('cell-')) {
                    container.classList.add('is-selected-range');
                    return;
                }

                container.classList.add('is-selected-range');

                // ✅ lineIndex 기준은 "직계 text-block"
                const lines = Array.from(container.children)
                    .filter(el => el.classList.contains('text-block'));

                const firstR = pos.ranges[0];
                const lastR  = pos.ranges[pos.ranges.length - 1];

                const startLine = lines[firstR.lineIndex];
                const endLine   = lines[lastR.lineIndex];

                if (!startLine || !endLine) return;

                const sPos = findNodeAndOffset(startLine, firstR.startIndex);
                const ePos = findNodeAndOffset(endLine, lastR.endIndex);

                // DOM 순서 기준으로 global start / end 계산
                if (
                    !globalStart ||
                    (sPos.node.compareDocumentPosition(globalStart.node) &
                        Node.DOCUMENT_POSITION_FOLLOWING)
                ) {
                    globalStart = sPos;
                }

                if (
                    !globalEnd ||
                    (ePos.node.compareDocumentPosition(globalEnd.node) &
                        Node.DOCUMENT_POSITION_PRECEDING)
                ) {
                    globalEnd = ePos;
                }
            });

            // ✅ 반드시 하나의 Range 생성
            if (globalStart && globalEnd) {
                const range = document.createRange();
                range.setStart(globalStart.node, globalStart.offset);
                range.setEnd(globalEnd.node, globalEnd.offset);
                sel.addRange(range);

                // 마지막 컨테이너에 포커스
                const lastId = positions[positions.length - 1].containerId;
                document.getElementById(lastId)?.focus();
            }

        } catch (e) {
            console.error('블록 복구 중 오류:', e);
        }
    }


    /**
     * 특정 라인 내에서 절대 오프셋을 기준으로 정확한 TextNode와 Offset을 찾아냄
     */
    function findNodeAndOffset(lineEl, targetOffset) {
        // 1. .chunk-text 내부의 텍스트 노드들을 우선 탐색
        const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT, null, false);
        let cumulative = 0;
        let lastNode = null;

        while (walker.nextNode()) {
            const node = walker.currentNode;
            const len = node.textContent.length;
            if (targetOffset <= cumulative + len) {
                return { node, offset: Math.max(0, targetOffset - cumulative) };
            }
            cumulative += len;
            lastNode = node;
        }

        // 2. 만약 텍스트 노드를 찾지 못했다면 (빈 줄인 경우)
        // .chunk-text 엘리먼트 자체라도 찾아서 그 안의 첫번째 자식으로 지정
        const chunkText = lineEl.querySelector('.chunk-text');
        if (chunkText) {
            const textNode = chunkText.firstChild || chunkText.appendChild(document.createTextNode(''));
            return { node: textNode, offset: 0 };
        }

        // 3. 최후의 수단: lineEl 자체의 첫번째 자식
        const fallbackNode = lineEl.firstChild || lineEl.appendChild(document.createTextNode(''));
        return { node: fallbackNode, offset: 0 };
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
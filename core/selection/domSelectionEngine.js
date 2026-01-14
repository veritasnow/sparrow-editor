// /module/uiModule/service/selectionService.js

export function createSelectionService({ root }) {
    let lastValidPos = null;
    let lastActiveKey = null;

    /**
     * 1. 실제로 콘텐츠(텍스트)가 선택된 모든 컨테이너 ID를 배열로 반환
     * 브라우저가 tr을 잡더라도 실제 텍스트가 포함되지 않은 셀은 걸러냅니다.
     */
    function getActiveKeys() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return [lastActiveKey].filter(Boolean);

        const range = sel.getRangeAt(0);
        const fragment = range.cloneContents(); // 선택된 영역의 DOM 복사본
        
        // fragment 내부에서 실제 텍스트가 존재하는 td, th 태그 추출
        const cellsWithContent = Array.from(fragment.querySelectorAll('td[id], th[id]')).filter(cell => {
            // 제로 너비 공백(\u200B)을 제외한 순수 텍스트가 있는지 확인
            const text = cell.textContent.replace(/\u200B/g, '').trim();
            return text.length > 0;
        });

        if (cellsWithContent.length > 0) {
            const ids = cellsWithContent.map(c => c.id);
            // 마지막 셀을 기준으로 lastActiveKey 갱신
            lastActiveKey = ids[ids.length - 1];
            return ids;
        }

        // fragment에 셀이 없다면 (단일 셀 내부 드래그 혹은 일반 영역)
        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        
        const cell = node.closest('td[id], th[id]');
        if (cell) {
            // 한 셀 내부에서 드래그 중인 경우
            lastActiveKey = cell.id;
            return [cell.id];
        }

        // 테이블 밖 에디터 본체 영역
        const container = node.closest('[contenteditable="true"]');
        if (container && container.id) {
            lastActiveKey = container.id;
            return [container.id];
        }

        return [lastActiveKey].filter(Boolean);
    }

    /**
     * 2. 현재 활성화된 단일 Key 반환 (구형 로직 호환용)
     */
    function getActiveKey() {
        const keys = getActiveKeys();
        return keys.length > 0 ? keys[keys.length - 1] : lastActiveKey;
    }

    /**
     * 3. 활성화된 컨테이너 DOM 객체 반환
     */
    function getActiveContainer() {
        const activeKey = getActiveKey();
        return (activeKey ? document.getElementById(activeKey) : null) || root;
    }

    /**
     * 4. 특정 컨테이너(ID)를 기준으로 해당 영역 내부의 드래그 범위 추출
     */
    function getDomSelection(targetKey) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;

        const domRange = sel.getRangeAt(0);
        // targetKey가 없으면 현재 활성 키 자동 탐색 (안전장치)
        const finalKey = targetKey || getActiveKey();
        const targetContainer = document.getElementById(finalKey) || root;
        
        const paragraphs = Array.from(targetContainer.childNodes).filter(p => p.tagName === 'P');
        const ranges = [];

        paragraphs.forEach((p, idx) => {
            const isStartInP = p.contains(domRange.startContainer);
            const isEndInP = p.contains(domRange.endContainer);
            
            let isIntersecting = isStartInP || isEndInP;
            if (!isIntersecting) {
                const pRange = document.createRange();
                pRange.selectNodeContents(p);
                isIntersecting = (domRange.compareBoundaryPoints(Range.END_TO_START, pRange) <= 0 &&
                                domRange.compareBoundaryPoints(Range.START_TO_END, pRange) >= 0);
            }

            if (isIntersecting) {
                let total = 0, startOffset = -1, endOffset = -1;
                const chunks = Array.from(p.childNodes);

                chunks.forEach((node, nodeIdx) => {
                    if (startOffset === -1) {
                        if (domRange.startContainer === p && domRange.startOffset === nodeIdx) {
                            startOffset = total;
                        } else if (domRange.startContainer === node || node.contains(domRange.startContainer)) {
                            const rel = domRange.startContainer.nodeType === Node.TEXT_NODE ? domRange.startOffset : 0;
                            startOffset = total + rel;
                        }
                    }
                    if (endOffset === -1) {
                        if (domRange.endContainer === p && domRange.endOffset === nodeIdx) {
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

                // 💡 [수정 포인트] 
                // 드래그 중이 아니더라도(start === end), 해당 문단에 커서가 있다면 정보를 포함시킨다.
                // 그래야 엔터/백스페이스 로직에서 "어느 줄, 어느 위치"인지 알 수 있습니다.
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
     * 5. 기초 컨텍스트 추출 (현재 커서 위치 중심)
     */
    function getSelectionContext() {
        const sel = window.getSelection();
        console.log('selection:', sel.rangeCount);
        if (!sel || !sel.rangeCount) return null;

        const range = sel.getRangeAt(0);
        const activeContainer = getActiveContainer();

        const container = range.startContainer;
        let el = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
        const parentP = el.closest('p');

        // P태그가 현재 활성 컨테이너 내부에 있는지 검증
        if (!parentP || !activeContainer.contains(parentP)) {
            return null;            
        }
        
        const lineIndex = Array.from(activeContainer.children).indexOf(parentP);
        const activeNode = el.closest('[data-index]');
        const dataIndex = activeNode ? parseInt(activeNode.dataset.index, 10) : null;

        return { activeContainer, lineIndex, parentP, container, cursorOffset: range.startOffset, activeNode, dataIndex };
    }

    /**
     * 6. 통합 모델 추출 (단일 지점 좌표)
     */
    function getSelectionPosition() {
        const context = getSelectionContext(); 
        console.log('context:', context);
        if (!context) return null;

        const { lineIndex, dataIndex, activeNode, container, cursorOffset, activeContainer } = context;
        //const targetEl = activeNode?.nodeType === Node.TEXT_NODE ? activeNode.parentElement : activeNode;
        /*
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
        */

        let chunkType = activeNode?.dataset?.type || 'text';
        return {
            containerId: activeContainer.id,
            lineIndex,
            anchor: {
                chunkIndex: dataIndex ?? 0,
                type: chunkType,
                offset: cursorOffset
            }
        };
    }

    /**
     * 7. 커서 복원
     */
    /**
     * 에디터의 커서 또는 선택 영역(Block)을 복원합니다.
     * @param {Object} cursorData - normalizeCursorData를 통해 정규화된 데이터
     */
    function restoreBlockCursor(cursorData) {
        if (!cursorData) return;

        // 1. 컨테이너 찾기
        const targetContainer = cursorData.containerId 
            ? document.getElementById(cursorData.containerId) 
            : document.querySelector('.sparrow-contents'); // 기본 컨테이너 클래스
        if (!targetContainer) return;

        const sel = window.getSelection();
        const range = document.createRange();

        // --- CASE A: 블록 지정 복원 (isSelection: true) ---
        if (cursorData.isSelection && cursorData.ranges && cursorData.ranges.length > 0) {
            try {
                const ranges = cursorData.ranges;
                const startData = ranges[0];
                const endData = ranges[ranges.length - 1];

                // 시작점 설정: 첫 번째 라인의 startIndex 위치 찾기
                const startLine = targetContainer.children[startData.lineIndex];
                if (!startLine) return;
                const startPos = findNodeAndOffset(startLine, startData.startIndex);
                range.setStart(startPos.node, startPos.offset);

                // 끝점 설정: 마지막 라인의 endIndex 위치 찾기
                const endLine = targetContainer.children[endData.lineIndex];
                if (!endLine) return;
                const endPos = findNodeAndOffset(endLine, endData.endIndex);
                range.setEnd(endPos.node, endPos.offset);

                sel.removeAllRanges();
                sel.addRange(range);
            } catch (e) {
                console.error('Multi-line selection restore failed:', e);
            }
            return;
        }

        // --- CASE B: 단일 커서 복원 (isSelection: false) ---
        if (cursorData.lineIndex === undefined) return;
        
        const { lineIndex, anchor } = cursorData;
        const lineEl = targetContainer.children[lineIndex];
        if (!lineEl) return;

        try {
            // 1. 테이블 내 커서 복원
            if (anchor.type === 'table' && anchor.detail) {
                const chunkEl = Array.from(lineEl.children).find(
                    el => parseInt(el.dataset.index, 10) === anchor.chunkIndex
                );
                if (!chunkEl) return;

                const { rowIndex, colIndex, offset } = anchor.detail;
                const tr = chunkEl.querySelectorAll('tr')[rowIndex];
                const td = tr?.querySelectorAll('td')[colIndex];
                if (!td) return;
                
                let targetNode = td.firstChild || td.appendChild(document.createTextNode(''));
                range.setStart(targetNode, Math.min(offset, targetNode.length));
            } 
            // 2. 미디어(비디오, 이미지) 커서 복원
            else if (anchor.type === 'video' || anchor.type === 'image') {
                const chunkEl = Array.from(lineEl.children).find(
                    el => parseInt(el.dataset.index, 10) === anchor.chunkIndex
                );
                if (!chunkEl) return;
                anchor.offset === 0 ? range.setStartBefore(chunkEl) : range.setStartAfter(chunkEl);
            } 
            // 3. 일반 텍스트 커서 복원 (쪼개진 청크 대응)
            else {
                // 단일 커서라도 스타일로 인해 청크가 나뉘어 있을 수 있으므로 findNodeAndOffset 사용
                const pos = findNodeAndOffset(lineEl, anchor.offset || 0);
                range.setStart(pos.node, pos.offset);
            }

            range.collapse(true); // 커서 형태로 합침
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (e) {
            console.warn('Single cursor restore failed:', e);
        }
    }

    /**
     * 특정 엘리먼트(Line) 내에서 논리적 오프셋(targetOffset)을 기반으로
     * 실제 DOM 텍스트 노드와 그 노드 안에서의 상대적 오프셋을 찾습니다.
     */
    function findNodeAndOffset(lineEl, targetOffset) {
        // TreeWalker를 사용하여 lineEl 내부의 모든 텍스트 노드를 순서대로 탐색
        const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT, null, false);
        let cumulativeOffset = 0;
        let lastNode = null;

        while (walker.nextNode()) {
            const node = walker.currentNode;
            const nodeLength = node.textContent.length;

            // 타겟 오프셋이 현재 노드의 범위 내에 있는지 확인
            if (targetOffset >= cumulativeOffset && targetOffset <= cumulativeOffset + nodeLength) {
                return {
                    node: node,
                    offset: targetOffset - cumulativeOffset
                };
            }
            cumulativeOffset += nodeLength;
            lastNode = node;
        }

        // 만약 오프셋을 찾지 못했다면 (줄의 끝이거나 비어있는 경우)
        if (!lastNode) {
            // 텍스트 노드가 하나도 없는 경우 빈 노드 생성 후 반환
            const textNode = document.createTextNode('');
            lineEl.appendChild(textNode);
            return { node: textNode, offset: 0 };
        }
        
        // 타겟이 전체 길이보다 크면 마지막 노드의 끝으로 설정
        return { node: lastNode, offset: lastNode.textContent.length };
    }

    function restoreCursor(cursorData) {
        if (!cursorData || cursorData.lineIndex === undefined) return;

        const { lineIndex, anchor, containerId } = cursorData;
        const targetContainer = containerId ? document.getElementById(containerId) : getActiveContainer();
        if (!targetContainer) return;

        const lineEl = targetContainer.children[lineIndex];
        if (!lineEl) return;

        const chunkEl = Array.from(lineEl.children).find(
            el => parseInt(el.dataset.index, 10) === anchor.chunkIndex
        );
        if (!chunkEl) return;

        const range = document.createRange();
        const sel = window.getSelection();

        try {
            if (anchor.type === 'table' && anchor.detail) {
                const { rowIndex, colIndex, offset } = anchor.detail;
                const tr = chunkEl.querySelectorAll('tr')[rowIndex];
                const td = tr?.querySelectorAll('td')[colIndex];
                if (!td) return;
                let targetNode = td.firstChild || td.appendChild(document.createTextNode('\u00A0'));
                range.setStart(targetNode, Math.min(offset, targetNode.length));
            } 
            else if (anchor.type === 'video' || anchor.type === 'image') {
                anchor.offset === 0 ? range.setStartBefore(chunkEl) : range.setStartAfter(chunkEl);
            } 
            else {
                let targetNode = Array.from(chunkEl.childNodes).find(n => n.nodeType === Node.TEXT_NODE) 
                                 || chunkEl.appendChild(document.createTextNode(''));
                range.setStart(targetNode, Math.min(anchor.offset || 0, targetNode.length));
            }

            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (e) { console.warn('Restore failed:', e); }
    }

    /**
     * 8. 삽입을 위한 절대 위치 추출
     */
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
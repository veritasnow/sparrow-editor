/**
 * 활성 컨테이너(ID) 추출 및 분석 서비스
 */
export function createRestoreCursorService(getActiveContainer) {
    
    let isRestoringCursor = true;

    /**
     * 1. 멀티 블록 커서 복원 최적화
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
                const lineEl = container.querySelector(
                    `.text-block[data-line-index="${rangeInfo.lineIndex}"]`
                );
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
     * 2. 커서 복원
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
                const lineEl = targetContainer.querySelector(
                    `.text-block[data-line-index="${lineIndex}"]`
                );
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

    function getIsRestoring() {
        return isRestoringCursor;
    }

    function setIsRestoring(val) {
        isRestoringCursor = val; 
    }


    // 첫 번째 텍스트 노드 찾기 (기존 findFirstTextNode)
    function findFirstTextNode(el) {
        if (!el) return null;
        if (el.nodeType === Node.TEXT_NODE) return el;
        for (let i = 0; i < el.childNodes.length; i++) {
            const found = findFirstTextNode(el.childNodes[i]);
            if (found) return found;
        }
        return null;
    }

    // 절대 위치 기반 노드 탐색 (기존 findNodeAndOffset)
    function findNodeAndOffset(lineEl, targetOffset) {
        if (!lineEl) return { node: document.body, offset: 0 };
        const walker = document.createTreeWalker(
            lineEl, 
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, 
            {
                acceptNode: (node) => {
                    if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
                    if (['IMG', 'BR'].includes(node.nodeName)) return NodeFilter.FILTER_ACCEPT;
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
                }
                const offset = (targetOffset > cumulative) ? 1 : 0;
                return { node: node.parentNode, offset: Array.from(node.parentNode.childNodes).indexOf(node) + offset };
            }
            cumulative += len;
            lastNode = node;
        }
        return { node: lastNode, offset: (lastNode.nodeType === Node.TEXT_NODE) ? lastNode.textContent.length : 0 };
    }


    return { 
        restoreMultiBlockCursor,  
        getIsRestoring,
        setIsRestoring,
        restoreCursor
    };
}
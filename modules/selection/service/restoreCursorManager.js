/**
 * 가상 스크롤 및 중첩 컨테이너(테이블 등) 대응 커서 복원 서비스
 */
export function RestoreCursorManager(root) {
    
    let isRestoringCursor = false;

    /**
     * 1. 멀티 블록(드래그 영역) 복원
     */
    function restoreMultiBlockCursor(positions) {
        if (!positions.length) return;
        isRestoringCursor = true;
        const sel = window.getSelection();
        sel.removeAllRanges();
        
        const isBackwards = positions.isBackwards || positions[0]?.isBackwards;
        let allPoints     = [];
        const posIds      = new Set(positions.map(p => p.containerId));

        for (const pos of positions) {
            const container = document.getElementById(pos.containerId);
            if (!container || !pos.ranges) continue;

            for (const rangeInfo of pos.ranges) {
                // [보정] :scope > 를 사용하여 해당 컨테이너의 직계 자식 라인만 탐색
                const lineEl = container.querySelector(
                    `:scope > .text-block[data-line-index="${rangeInfo.lineIndex}"]`
                );
                
                if (!lineEl) continue;

                // 중첩 컨테이너(테이블 등) 자체를 선택하는 경우 제외 로직
                // TODO 스킵 추가해야할지 고민 필요...!!
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
            const end   = allPoints[allPoints.length - 1];
            
            try {
                isBackwards 
                    ? sel.setBaseAndExtent(end.node, end.offset, start.node, start.offset)
                    : sel.setBaseAndExtent(start.node, start.offset, end.node, end.offset);
            } catch (e) {
                console.warn("Multi-block selection failed:", e);
            }
        }

        // 비선택 영역 스타일 처리
        posIds.forEach(key => {
            const el = document.getElementById(key);
            if (el) el.classList.remove('is-not-selected');
        });
    }
    
    /**
     * 2. 단일 커서 복원 (핵심 수정됨)
     */
    function restoreCursor(cursorData, activeContainer) {
        if (!cursorData) return;
        const { containerId, anchor, lineIndex } = cursorData;
        const targetContainer = containerId ? document.getElementById(containerId) : activeContainer;
        if (!targetContainer) return;

        if (document.activeElement !== targetContainer) {
            targetContainer.focus({ preventScroll: true });
        }

        const sel = window.getSelection();
        sel.removeAllRanges();

        if (lineIndex !== undefined && anchor) {
            try {
                // 🔥 [수정] :scope > 적용
                const lineEl = targetContainer.querySelector(
                    `:scope > .text-block[data-line-index="${lineIndex}"]`
                );
                if (!lineEl) return;

                // 🔥 [수정] 라인의 직계 자식 청크만 탐색 (Array.from 없이 querySelector로 최적화)
                const chunkEl = lineEl.querySelector(`:scope > [data-index="${anchor.chunkIndex}"]`);
                if (!chunkEl) return;

                let targetNode = null;
                let targetOffset = 0;

                // Case 1: 테이블 셀 내부 (td)
                if (anchor.type === 'table' && anchor.detail) {
                    const table = chunkEl.querySelector(':scope > table, :scope > .se-table');
                    const rows  = table.rows;
                    const td    = rows[anchor.detail.rowIndex].cells[anchor.detail.colIndex];
                    if (td) {
                        targetNode = findFirstTextNode(td) || td.appendChild(document.createTextNode(''));
                        targetOffset = Math.min(anchor.detail.offset, targetNode.length);
                    }
                } 
                // Case 2: 개체(테이블 자체, 이미지, 비디오)의 앞/뒤
                else if (chunkEl.getAttribute('data-type') === 'table' || anchor.type === 'video' || anchor.type === 'image') {
                    targetNode = lineEl; 
                    const chunkPos = Array.from(lineEl.childNodes).indexOf(chunkEl);
                    targetOffset = (anchor.offset === 0) ? chunkPos : chunkPos + 1;
                } 
                // Case 3: 일반 텍스트
                else {
                    targetNode = findFirstTextNode(chunkEl) || chunkEl.appendChild(document.createTextNode(''));
                    targetOffset = Math.min(anchor.offset || 0, targetNode.length);
                }

                if (targetNode) {
                    sel.setBaseAndExtent(targetNode, targetOffset, targetNode, targetOffset);

                    // 스크롤바 복구 이벤트 추가
                    // 5. 커서 위치로 스크롤 동기화
                    const range         = sel.getRangeAt(0);
                    const rect          = range.getBoundingClientRect(); // 커서의 화면상 좌표
                    const containerRect = root.getBoundingClientRect();

                    // 커서가 컨테이너 하단보다 아래에 있을 때
                    if (rect.bottom > containerRect.bottom) {
                        root.scrollTop += (rect.bottom - containerRect.bottom) + 20; // 20px 여유
                    } 
                    // 커서가 컨테이너 상단보다 위에 있을 때 (역방향 스크롤 대비)
                    else if (rect.top < containerRect.top) {
                        root.scrollTop -= (containerRect.top - rect.top) + 20;
                    }                        
                }

            } catch (e) { 
                console.error("Cursor restoration error:", e); 
            }
        }
    }

    /**
     * 3. 도우미 함수들
     */
    function findFirstTextNode(el) {
        if (!el) return null;
        if (el.nodeType === Node.TEXT_NODE) return el;
        // input이나 button 등은 무시하고 깊은 탐색
        for (const child of el.childNodes) {
            const found = findFirstTextNode(child);
            if (found) return found;
        }
        return null;
    }

    function findNodeAndOffset(lineEl, targetOffset) {
        if (!lineEl) return null;
        
        // 테이블 같은 복합 요소 안을 훑지 않도록 범위 제한 필요
        const walker = document.createTreeWalker(
            lineEl, 
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, 
            {
                acceptNode: (node) => {
                    // 텍스트 노드나 줄바꿈, 이미지 등만 취급
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
        
        // 끝점 폴백
        const lastText = findFirstTextNode(lastNode) || lastNode;
        return { 
            node: lastText, 
            offset: lastText.nodeType === Node.TEXT_NODE ? lastText.textContent.length : 0 
        };
    }

    return { 
        restoreMultiBlockCursor,  
        getIsRestoring: () => isRestoringCursor,
        setIsRestoring: (val) => { isRestoringCursor = val; },
        restoreCursor
    };
}
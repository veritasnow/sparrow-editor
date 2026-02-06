/**
 * 가상 스크롤 및 중첩 컨테이너(테이블 등) 대응 커서 복원 서비스
 */
export function createRestoreCursorService(getActiveContainer, root) {
    
    let isRestoringCursor = false;

    /**
     * 1. 멀티 블록(드래그 영역) 복원
     */
    function restoreMultiBlockCursor(positions) {
        if (!positions?.length) return;
        isRestoringCursor = true;
        const sel = window.getSelection();
        sel.removeAllRanges();
        
        const isBackwards = positions.isBackwards || positions[0]?.isBackwards;
        let allPoints = [];
        const posIds = new Set(positions.map(p => p.containerId));

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
    function restoreCursor(cursorData) {
        if (!cursorData) return;
        const { containerId, anchor, lineIndex } = cursorData;
        
        // 1. 컨테이너 확정 (테이블 TD ID일 수도 있고, 메인 에디터 ID일 수도 있음)
        const targetContainer = containerId ? document.getElementById(containerId) : getActiveContainer();
        if (!targetContainer) return;

        const sel = window.getSelection();
        sel.removeAllRanges();

        if (lineIndex !== undefined && anchor) {
            try {
                // 2. 🔥 [중요] 중첩 인덱스 충돌 방지
                // :scope > 를 사용하여 targetContainer 바로 아래의 text-block만 찾습니다.
                // 이로써 에디터 0번 라인과 테이블 내부 0번 라인이 섞이지 않습니다.
                const lineEl = targetContainer.querySelector(
                    `:scope > .text-block[data-line-index="${lineIndex}"]`
                );

                if (!lineEl) {
                    console.warn(`Line ${lineIndex} not found in container ${containerId}`);
                    return;
                }

                // 3. 청크 탐색
                const chunkEl = Array.from(lineEl.children).find(
                    el => parseInt(el.dataset.chunkIndex, 10) === anchor.chunkIndex
                );
                
                if (!chunkEl) return;

                let targetNode = null;
                let targetOffset = 0;

                // 케이스별 노드 결정
                if (anchor.type === 'table' && anchor.detail) {
                    // 테이블 내부 셀 위치 계산
                    const rows = chunkEl.getElementsByTagName('tr');
                    const td = rows[anchor.detail.rowIndex]?.cells[anchor.detail.colIndex];
                    if (td) {
                        targetNode = findFirstTextNode(td) || td.appendChild(document.createTextNode('\u200B'));
                        targetOffset = Math.min(anchor.detail.offset, targetNode.length);
                    }
                } 
                else if (['table', 'video', 'image'].includes(anchor.type)) {
                    // 개체 앞/뒤 (Node Selection)
                    targetNode = chunkEl.parentNode;
                    const chunkPos = Array.from(targetNode.childNodes).indexOf(chunkEl);
                    targetOffset = (anchor.offset === 0) ? chunkPos : chunkPos + 1;
                } 
                else {
                    // 일반 텍스트
                    targetNode = findFirstTextNode(chunkEl) || chunkEl.appendChild(document.createTextNode('\u200B'));
                    targetOffset = Math.min(anchor.offset || 0, targetNode.length);
                }

                // 4. 커서 찍기
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
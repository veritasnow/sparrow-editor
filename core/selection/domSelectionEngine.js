// /module/uiModule/service/selectionService.js

export function createSelectionService({ root }) {
    let lastValidPos = null;
    // 💡 팝업 대응을 위해 마지막 활성 키를 저장할 변수 추가
    let lastActiveKey = null;

    /**
     * [Helper] 현재 커서가 속한 편집 영역(본문 또는 TD)의 DOM 객체를 가져옵니다.
     */
    function getActiveContainer() {
        const activeKey = getActiveKey();
        if (!activeKey) return root;
        
        // ID로 엘리먼트를 찾되, 없으면 root를 반환
        return document.getElementById(activeKey) || root;
    }

    /**
     * 0. 현재 커서 위치의 고유 Key(ID) 반환
     */
    function getActiveKey() {
        const sel = window.getSelection();
        
        // 커서가 유효할 때만 실시간 키를 업데이트
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            let node = range.startContainer;

            if (node.nodeType === Node.TEXT_NODE) {
                node = node.parentElement;
            }

            const container = node.closest('[contenteditable="true"], td[id], th[id]');
            
            if (container && container.id) {
                // 💡 유효한 편집 영역이면 lastActiveKey를 갱신
                lastActiveKey = container.id;
                return container.id;
            }
        }

        // 💡 팝업창 클릭 등으로 포커스를 잃었을 경우, 마지막으로 기억된 키를 반환
        return lastActiveKey;
    }

    // 💡 외부에서 강제로 마지막 키를 가져오고 싶을 때 사용
    function getLastActiveKey() {
        return lastActiveKey;
    }

    function updateLastValidPosition() {
        // 절대 위치를 저장하면서 동시에 activeKey도 스냅샷 찍음
        const pos = getInsertionAbsolutePosition();
        if (pos) {
            lastValidPos = pos;
            getActiveKey(); // lastActiveKey 갱신 유도
        }
    }

    function getLastValidPosition() {
        return lastValidPos;
    }

    /**
     * 1. 통합 모델 추출 (Container 기준 보정)
     */
    function getSelectionPosition() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;

        const context = getSelectionContext(); 
        if (!context) return null;

        const { lineIndex, dataIndex, activeNode, container, cursorOffset } = context;
        const targetEl = activeNode?.nodeType === Node.TEXT_NODE ? activeNode.parentElement : activeNode;
        
        // 테이블 내부 감지
        const tableEl = targetEl?.closest('table');
        if (tableEl) {
            const td = container.nodeType === Node.TEXT_NODE 
                ? container.parentElement.closest('td') 
                : container.closest('td');

            if (td) {
                const tr = td.parentElement;
                const tbody = tr.closest('tbody') || tableEl;
                
                return {
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

        // 일반 청크 처리
        let chunkType = 'text';
        if (targetEl) {
            if (targetEl.classList.contains('chunk-video') || targetEl.querySelector('iframe, video')) chunkType = 'video';
            else if (targetEl.classList.contains('chunk-image') || targetEl.querySelector('img')) chunkType = 'image';
            else if (targetEl.dataset.type) chunkType = targetEl.dataset.type;
        }

        return {
            lineIndex,
            anchor: {
                chunkIndex: dataIndex ?? 0,
                type: chunkType,
                offset: cursorOffset
            }
        };
    }

    /**
     * 2. 커서 복원 (Container 기준 보정)
     */
    function restoreCursor(cursorData) {
        if (!cursorData || cursorData.lineIndex === undefined) return;

        const { lineIndex, anchor, containerId } = cursorData;
        
        // 💡 중요: 전달받은 containerId가 있으면 해당 영역을 찾고, 
        // 없으면 getActiveKey()(즉, lastActiveKey 포함)를 통해 영역 탐색
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
     * 3. 기초 컨텍스트 추출 (기준점 보정)
     */
    function getSelectionContext() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return null;

        const range = sel.getRangeAt(0);
        const container = range.startContainer;
        const cursorOffset = range.startOffset;

        // 현재 속한 컨테이너(Root 혹은 TD)를 동적으로 파악
        const activeContainer = getActiveContainer();

        let el = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
        const parentP = el.closest('p');

        // 찾은 P태그가 현재 활성화된 영역 내부에 있는지 검증
        if (!parentP || !activeContainer.contains(parentP)) return null;
        
        // Index를 activeContainer 기준으로 추출
        const lineIndex = Array.from(activeContainer.children).indexOf(parentP);

        const activeNode = el.closest('[data-index]');
        const dataIndex = activeNode ? parseInt(activeNode.dataset.index, 10) : null;

        return { 
            activeContainer,
            lineIndex, 
            parentP, 
            container, 
            cursorOffset,
            activeNode, 
            dataIndex 
        };
    }

    /**
     * 4. 멀티 라인 선택 (기준점 보정)
     */
    function getDomSelection() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;

        const domRange = sel.getRangeAt(0);
        const activeContainer = getActiveContainer();

        const paragraphs = Array.from(activeContainer.children).filter(p => p.tagName === 'P');
        const ranges = [];

        paragraphs.forEach((p, idx) => {
            let isIntersecting = p.contains(domRange.startContainer) || p.contains(domRange.endContainer);

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
                        if (domRange.startContainer === p && domRange.startOffset === nodeIdx) startOffset = total;
                        else if (domRange.startContainer === node || node.contains(domRange.startContainer)) {
                            startOffset = total + (domRange.startContainer.nodeType === Node.TEXT_NODE ? domRange.startOffset : 0);
                        }
                    }
                    if (endOffset === -1) {
                        if (domRange.endContainer === p && domRange.endOffset === nodeIdx) endOffset = total;
                        else if (domRange.endContainer === node || node.contains(domRange.endContainer)) {
                            endOffset = total + (domRange.endContainer.nodeType === Node.TEXT_NODE ? domRange.endOffset : 0);
                        }
                    }
                    total += (node.nodeType === Node.TEXT_NODE || node.classList?.contains('chunk-text')) ? node.textContent.length : 1;
                });

                if (startOffset === -1) startOffset = 0;
                if (endOffset === -1) endOffset = total;
                ranges.push({ lineIndex: idx, startIndex: startOffset, endIndex: endOffset });
            }
        });

        return ranges.length ? ranges : null;
    }

    /**
     * 5. 절대 위치 추출 (기준점 보정)
     */
    function getInsertionAbsolutePosition() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return null;

        const range = sel.getRangeAt(0);
        const container = range.startContainer;
        const offsetInNode = range.startOffset;
        const activeContainer = getActiveContainer();

        const parentP = container.nodeType === Node.TEXT_NODE 
            ? container.parentElement.closest('p') 
            : container.closest('p');

        if (!parentP || !activeContainer.contains(parentP)) return null;
        
        const lineIndex = Array.from(activeContainer.children).indexOf(parentP);

        let absoluteOffset = 0;
        const walker = document.createTreeWalker(parentP, NodeFilter.SHOW_TEXT, null, false);

        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node === container) {
                absoluteOffset += offsetInNode;
                break;
            }
            absoluteOffset += node.textContent.length;
        }

        return { lineIndex, absoluteOffset };
    }

    return { 
        getSelectionPosition, 
        getActiveKey,
        getLastActiveKey, // 💡 추가된 반환 함수
        getInsertionAbsolutePosition,
        updateLastValidPosition,
        getLastValidPosition,
        getSelectionContext, 
        restoreCursor,
        getDomSelection,
        // 구형 함수 호환성 유지
        restoreSelectionPositionByChunk: (data) => restoreCursor({ lineIndex: data.lineIndex, anchor: data }),
        restoreTableSelection: (data) => restoreCursor({ lineIndex: data.lineIndex, anchor: { chunkIndex: data.chunkIndex, type: 'table', detail: data.cell } })
    };
}
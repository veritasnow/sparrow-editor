// /module/uiModule/service/selectionService.js

export function createSelectionService({ root }) {
    let lastValidPos = null;
    let lastActiveKey = null;

    /**
     * 0. 현재 커서 위치의 고유 Key(ID) 반환 및 갱신
     */
    function getActiveKey() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return lastActiveKey;

        const range = sel.getRangeAt(0);
        
        // 1. 공통 조상(Common Ancestor) 확보 
        // 마우스가 밖으로 나가거나 블록을 위로 잡으면 startContainer가 튀지만, 
        // commonAncestorContainer는 선택된 영역 전체를 감싸는 최소 단위를 잡습니다.
        let node = range.commonAncestorContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

        // 🔍 로그로 확인해봅시다
        console.log("📍 Common Ancestor Node:", node);

        // 2. [우선순위 1] 현재 노드 혹은 그 상위로 올라가며 셀(TD)이 있는지 확인
        const cell = node.closest('td[id], th[id]');
        if (cell) {
            lastActiveKey = cell.id;
            return cell.id;
        }

        // 3. [우선순위 2] 만약 내가 셀 밖으로 나갔다면, 선택 영역 내부에 셀이 포함되어 있는지 확인
        // (드래그로 셀 전체를 긁었을 때 브라우저가 조상을 TABLE이나 P로 잡아버리는 경우 대비)
        if (node.querySelector) {
            const internalCell = node.querySelector('td[id], th[id]');
            if (internalCell) {
                lastActiveKey = internalCell.id;
                return internalCell.id;
            }
        }

        // 4. [우선순위 3] 셀이 전혀 연관되지 않았을 때만 에디터 본체(Root)를 잡음
        const container = node.closest('[contenteditable="true"]');
        if (container && container.id) {
            // 방어 로직: 에디터 본체가 잡혔는데, 드래그 범위(Range) 안에 테이블 요소가 있다면
            // 함부로 본체 ID로 갱신하지 않고 직전 셀 ID를 유지하는 것이 안전합니다.
            if (range.cloneContents().querySelector('table')) {
                return lastActiveKey;
            }

            lastActiveKey = container.id;
            return container.id;
        }

        return lastActiveKey;
    }
    /*
    function getActiveKey() {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            
            // 💡 핵심: startContainer 대신 commonAncestorContainer를 사용
            // 선택 영역 전체를 아우르는 가장 깊은 부모 노드를 찾습니다.
            let node = range.commonAncestorContainer;

            // 텍스트 노드라면 부모 엘리먼트로 이동
            if (node.nodeType === Node.TEXT_NODE) {
                node = node.parentElement;
            }

            // 여기서부터 위로 올라가며 ID를 찾음
            const container = node.closest('td[id], th[id], [contenteditable="true"]');
            
            if (container && container.id) {
                // 💡 추가 로직: 만약 찾은 컨테이너가 최상위 root라면, 
                // 혹시 선택 영역 안에 TD가 포함되어 있는지 한 번 더 검사할 수 있습니다.
                lastActiveKey = container.id;
                return container.id;
            }
        }
        return lastActiveKey;
    }
    */
    /*
    function getActiveKey() {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            let node = range.startContainer;
            if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

            // ID가 있는 가장 가까운 편집 영역(Root 혹은 TD/TH) 탐색
            const container = node.closest('[contenteditable="true"], td[id], th[id]');
            if (container && container.id) {
                lastActiveKey = container.id;
                return container.id;
            }
        }
        return lastActiveKey;
    }
    */

    /**
     * 활성화된 컨테이너 DOM 객체 반환
     */
    function getActiveContainer() {
        const activeKey = getActiveKey();
        return (activeKey ? document.getElementById(activeKey) : null) || root;
    }

    /**
     * 1. 통합 모델 추출 (Container ID 및 테이블 정밀 좌표 포함)
     */
    function getSelectionPosition() {
        const context = getSelectionContext(); 
        if (!context) return null;

        const { lineIndex, dataIndex, activeNode, container, cursorOffset, activeContainer } = context;
        const targetEl = activeNode?.nodeType === Node.TEXT_NODE ? activeNode.parentElement : activeNode;
        
        // 테이블 내부 감지 및 상세 좌표(rowIndex, colIndex) 추출
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

        // 일반 청크(텍스트, 이미지, 비디오) 처리
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
     * 2. 커서 복원 (Container ID 기반 영역 타겟팅)
     */
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
            // 테이블 전용 복원
            if (anchor.type === 'table' && anchor.detail) {
                const { rowIndex, colIndex, offset } = anchor.detail;
                const tr = chunkEl.querySelectorAll('tr')[rowIndex];
                const td = tr?.querySelectorAll('td')[colIndex];
                if (!td) return;

                let targetNode = td.firstChild || td.appendChild(document.createTextNode('\u00A0'));
                range.setStart(targetNode, Math.min(offset, targetNode.length));
            } 
            // 이미지/비디오 복원 (청크 뛰어넘기 방지)
            else if (anchor.type === 'video' || anchor.type === 'image') {
                anchor.offset === 0 ? range.setStartBefore(chunkEl) : range.setStartAfter(chunkEl);
            } 
            // 일반 텍스트 복원
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
     * 3. 기초 컨텍스트 추출 (활성 컨테이너 기준)
     */
    function getSelectionContext() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;

        const range = sel.getRangeAt(0);
        const container = range.startContainer;
        const cursorOffset = range.startOffset;
        const activeContainer = getActiveContainer();

        let el = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
        const parentP = el.closest('p');

        // 찾은 P태그가 현재 활성화된 영역(root 혹은 특정 TD) 내부에 있는지 검증
        if (!parentP || !activeContainer.contains(parentP)) return null;
        
        const lineIndex = Array.from(activeContainer.children).indexOf(parentP);
        const activeNode = el.closest('[data-index]');
        const dataIndex = activeNode ? parseInt(activeNode.dataset.index, 10) : null;

        return { activeContainer, lineIndex, parentP, container, cursorOffset, activeNode, dataIndex };
    }

    /**
     * 4. 멀티 라인 드래그 선택 영역 추출
     */
    function getDomSelection() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;

        const domRange = sel.getRangeAt(0);
        const activeContainer = getActiveContainer(); // root 대신 activeContainer 사용
        
        // childNodes를 써야 텍스트와 요소를 모두 정확히 계산함
        const paragraphs = Array.from(activeContainer.childNodes).filter(p => p.tagName === 'P');
        const ranges = [];

        paragraphs.forEach((p, idx) => {
            // 1. 현재 문단이 선택 영역에 포함되는지 확인
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
                    // 시작점 계산
                    if (startOffset === -1) {
                        if (domRange.startContainer === p && domRange.startOffset === nodeIdx) startOffset = total;
                        else if (domRange.startContainer === node || node.contains(domRange.startContainer)) {
                            startOffset = total + (domRange.startContainer.nodeType === Node.TEXT_NODE ? domRange.startOffset : 0);
                        }
                    }
                    // 끝점 계산
                    if (endOffset === -1) {
                        if (domRange.endContainer === p && domRange.endOffset === nodeIdx) endOffset = total;
                        else if (domRange.endContainer === node || node.contains(domRange.endContainer)) {
                            endOffset = total + (domRange.endContainer.nodeType === Node.TEXT_NODE ? domRange.endOffset : 0);
                        }
                    }
                    // 길이 합산
                    total += (node.nodeType === Node.TEXT_NODE || node.classList?.contains('chunk-text')) ? node.textContent.length : 1;
                });

                // 2. 최종 보정 로직 (기존 코드의 핵심을 가독성 있게 정리)
                if (startOffset === -1) {
                    // 이 문단 내부에 커서가 있다면? (루프에서 못찾은 경우 = 보통 문단 끝)
                    if (isStartInP) startOffset = (domRange.startOffset >= chunks.length) ? total : 0;
                    // 문단 외부에 있다면? (위에서 아래로 선택 중인 경우)
                    else startOffset = 0;
                }
                
                if (endOffset === -1) {
                    if (isEndInP) endOffset = (domRange.endOffset >= chunks.length) ? total : total;
                    else endOffset = total;
                }

                ranges.push({ lineIndex: idx, startIndex: startOffset, endIndex: endOffset });
            }
        });

        return ranges.length ? ranges : null;
    }
    /*
    기존 보정로직
    function getDomSelection() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) {
            console.warn("🚩 [Selection] No range count");
            return null;
        }

        const domRange = sel.getRangeAt(0);
        // 현재 Range의 원시 정보 출력
        console.log("📍 [Range Raw Data]", {
            startContainer: domRange.startContainer,
            startOffset: domRange.startOffset,
            endContainer: domRange.endContainer,
            endOffset: domRange.endOffset,
            collapsed: domRange.collapsed
        });

        const paragraphs = Array.from(root.childNodes).filter(p => p.tagName === 'P');
        const ranges = [];

        paragraphs.forEach((p, idx) => {
            const isStartInP = p.contains(domRange.startContainer);
            const isEndInP   = p.contains(domRange.endContainer);
            
            // 시작점이나 끝점 중 하나라도 P 안에 있거나, 
            // 반대로 P가 선택 영역(Range)에 포함되는지 확인
            let isIntersecting = isStartInP || isEndInP;

            // 만약 여전히 false라면 Range가 P를 통째로 감쌌는지 체크
            if (!isIntersecting) {
                const pRange = document.createRange();
                pRange.selectNodeContents(p);
                isIntersecting = (domRange.compareBoundaryPoints(Range.END_TO_START, pRange) <= 0 &&
                                domRange.compareBoundaryPoints(Range.START_TO_END, pRange) >= 0);
            }

            if (isIntersecting) {
                let total = 0;
                let startOffset = -1;
                let endOffset = -1;

                const chunks = Array.from(p.childNodes);
                const isStartInP = domRange.startContainer === p;
                const isEndInP = domRange.endContainer === p;

                chunks.forEach((node, nodeIdx) => {
                    // 시작점 매칭 로그
                    if (startOffset === -1) {
                        if (isStartInP && domRange.startOffset === nodeIdx) {
                            startOffset = total;
                        } else if (domRange.startContainer === node || node.contains(domRange.startContainer)) {
                            const relativeOffset = domRange.startContainer.nodeType === Node.TEXT_NODE ? domRange.startOffset : 0;
                            startOffset = total + relativeOffset;
                        }
                    }

                    // 끝점 매칭 로그
                    if (endOffset === -1) {
                        if (isEndInP && domRange.endOffset === nodeIdx) {
                            endOffset = total;
                        } else if (domRange.endContainer === node || node.contains(domRange.endContainer)) {
                            const relativeOffset = domRange.endContainer.nodeType === Node.TEXT_NODE ? domRange.endOffset : 0;
                            endOffset = total + relativeOffset;
                        }
                    }

                    // 길이 합산 규칙
                    if (node.nodeType === Node.TEXT_NODE || (node.classList && node.classList.contains('chunk-text'))) {
                        total += node.textContent.length;
                    } else {
                        total += 1; // Video, Image 등
                    }
                });
                // 보정 로직 실행
                if (startOffset === -1) {
                    startOffset = isStartInP ? (domRange.startOffset >= chunks.length ? total : 0) : 0;
                }
                if (endOffset === -1) {
                    endOffset = isEndInP ? (domRange.endOffset >= chunks.length ? total : total) : total;
                }
                ranges.push({ lineIndex: idx, startIndex: startOffset, endIndex: endOffset });
            }
        });

        return ranges.length ? ranges : null;
    }
    */

    /**
     * 5. 삽입을 위한 절대 위치 추출
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
        // 구형 호환성 메서드
        restoreSelectionPositionByChunk: (data) => restoreCursor({ containerId: lastActiveKey, lineIndex: data.lineIndex, anchor: data }),
        restoreTableSelection: (data) => restoreCursor({ containerId: lastActiveKey, lineIndex: data.lineIndex, anchor: { chunkIndex: data.chunkIndex, type: 'table', detail: data.cell } })
    };
}
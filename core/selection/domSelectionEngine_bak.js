// /module/uiModule/service/selectionService.js

export function createSelectionService({ root }) {

    let lastValidPos = null;

    // 에디터 본문(root)에 mousedown이나 keyup 이벤트가 발생할 때마다 호출
    function updateLastValidPosition() {
        const pos = getInsertionAbsolutePosition(); // 본문에 있을 때만 위치를 가져옴
        if (pos) {
            lastValidPos = pos;
        }
    }

    // 외부에서 가져갈 수 있게 노출
    function getLastValidPosition() {
        return lastValidPos;
    }


    /**
     * 1. 현재 DOM 선택 영역의 상세 정보를 통합 모델로 추출
     * (텍스트 오프셋뿐만 아니라 테이블의 행/열 인덱스까지 포함)
     */
    function getSelectionPosition() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;

        const context = getSelectionContext(); 
        if (!context) return null;

        const { lineIndex, dataIndex, activeNode, container, cursorOffset } = context;

        // 🚀 개선된 테이블 감지 로직
        // activeNode가 텍스트 노드일 수 있으므로, 실제 엘리먼트를 먼저 찾습니다.
        const targetEl = activeNode?.nodeType === Node.TEXT_NODE ? activeNode.parentElement : activeNode;
        const tableEl = targetEl?.closest('table');

        if (tableEl) {
            // container(실제 커서가 있는 위치)를 기준으로 TD를 찾습니다.
            const td = container.nodeType === Node.TEXT_NODE 
                ? container.parentElement.closest('td') 
                : container.closest('td');

            if (td) {
                const tr = td.parentElement;
                const tbody = tr.closest('tbody') || tableEl; // tbody가 없을 수도 있으므로 안전하게 처리
                
                return {
                    lineIndex,
                    anchor: {
                        chunkIndex: dataIndex,
                        type: 'table',
                        detail: {
                            rowIndex: Array.from(tbody.rows || tbody.children).indexOf(tr),
                            colIndex: Array.from(tr.cells || tr.children).indexOf(td),
                            offset: cursorOffset // 👈 이제 'ㅁㄴㅇ' 중 'ㄴ' 뒤에 있으면 2가 들어옵니다.
                        }
                    }
                };
            }
        }

        // 2. 비디오/이미지 등 Atomic Chunk (기존 유지)
        let chunkType = 'text';
        if (targetEl) {
            if (targetEl.classList.contains('chunk-video') || targetEl.querySelector('iframe, video')) {
                chunkType = 'video';
            } else if (targetEl.classList.contains('chunk-image') || targetEl.querySelector('img')) {
                chunkType = 'image';
            } else if (targetEl.dataset.type) {
                chunkType = targetEl.dataset.type;
            }
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
     * 2. 통합 커서 복원 함수
     * getSelectionPosition에서 반환한 객체를 그대로 넣어주면 타입에 맞춰 복원합니다.
     */
    function restoreCursor(cursorData) {
    if (!cursorData || cursorData.lineIndex === undefined) return;

    const { lineIndex, anchor } = cursorData;
    const lineEl = root.children[lineIndex];
    if (!lineEl) return;

    const chunkEl = Array.from(lineEl.children).find(
        el => parseInt(el.dataset.index, 10) === anchor.chunkIndex
    );
    if (!chunkEl) return;

    const range = document.createRange();
    const sel = window.getSelection();

    try {
        if (anchor.type === 'table' && anchor.detail) {
        // 1. 테이블 복원 로직
        const { rowIndex, colIndex, offset } = anchor.detail;
        const tr = chunkEl.querySelectorAll('tr')[rowIndex];
        const td = tr?.querySelectorAll('td')[colIndex];
        if (!td) return;

        let targetNode = td.firstChild;
        if (!targetNode || targetNode.nodeType !== Node.TEXT_NODE) {
            targetNode = td.appendChild(document.createTextNode('\u00A0'));
        }
        range.setStart(targetNode, Math.min(offset, targetNode.length));
        } 
        else if (anchor.type === 'video' || anchor.type === 'image') {
        // ✅ 2. 비디오/이미지 복원 로직 (Atomic Block)
        // offset이 0이면 노드 앞, 1이면 노드 뒤로 설정
        if (anchor.offset === 0) {
            range.setStartBefore(chunkEl);
        } else {
            range.setStartAfter(chunkEl);
        }
        } 
        else {
        // 3. 일반 텍스트 청크 복원 로직
        let targetNode = null;
        chunkEl.childNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) targetNode = node;
        });

        if (!targetNode) {
            // 텍스트가 없는 경우에만 임시 노드 생성 (비디오 등에는 생성 안 함)
            targetNode = chunkEl.appendChild(document.createTextNode(''));
        }
        range.setStart(targetNode, Math.min(anchor.offset || 0, targetNode.length));
        }

        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    } catch (e) {
        console.warn('Failed to restore cursor:', e);
    }
    }

    /**
     * 3. 현재 포커스된 줄과 노드의 기초 컨텍스트 추출 (내부용)
     */
    function getSelectionContext() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;

    const range = sel.getRangeAt(0);
    const container = range.startContainer;
    const cursorOffset = range.startOffset;

    // 1. P 엘리먼트(라인) 탐색
    let el = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
    const parentP = el.closest('p');

    if (!parentP || parentP.parentElement !== root) return null;
    const lineIndex = Array.from(root.childNodes).indexOf(parentP);

    // 2. [data-index]를 가진 청크 노드 탐색
    const activeNode = el.closest('[data-index]');
    const dataIndex = activeNode ? parseInt(activeNode.dataset.index, 10) : null;

    return { 
        lineIndex, 
        parentP, 
        container, 
        cursorOffset,
        activeNode, 
        dataIndex 
    };
    }

    /**
     * DOM 전체 텍스트 기반 선택 영역 (멀티 라인 선택 시 사용)
     */
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

    /**
     * 블록/이미지 삽입을 위한 절대 오프셋 추출 전용 함수
     */
    function getInsertionAbsolutePosition() {
        const sel = window.getSelection();

        if (!sel.rangeCount) return null;

        const range     = sel.getRangeAt(0);
        const container = range.startContainer;
        const offsetInNode = range.startOffset;

        // 1. 현재 라인(P 태그) 찾기
        const parentP = container.nodeType === Node.TEXT_NODE 
            ? container.parentElement.closest('p') 
            : container.closest('p');

        console.log(  "parentP sel:", parentP);          

        if (!parentP || parentP.parentElement !== root) {
        console.log("parentP is null or not a child of root");
        return null;        
        }
        const lineIndex = Array.from(root.childNodes).indexOf(parentP);

        // 2. 라인 시작부터 현재 커서 위치까지의 모든 텍스트 길이 합산 (절대 위치 계산)
        let absoluteOffset = 0;
        const walker = document.createTreeWalker(parentP, NodeFilter.SHOW_TEXT, null, false);
        console.log("walker sel:", walker);

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


    /**
     * 현재 커서가 위치한 편집 영역의 고유 Key(ID)를 반환합니다.
     * 본문이면 'myEditor-content', 테이블 셀이면 해당 TD의 ID를 반환합니다.
     */
    function getActiveKey() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;

        const range = sel.getRangeAt(0);
        let node = range.startContainer;

        // 텍스트 노드면 부모 엘리먼트부터 탐색 시작
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }

        // 💡 핵심: id를 가지고 있으면서 편집 가능한 가장 가까운 조상을 찾음
        // 본문 DIV(#myEditor-content)나 각 TD들을 찾게 됩니다.
        const container = node.closest('[contenteditable="true"], td[id], th[id]');
        
        return container ? container.id : null;
    }  

  return { 
    getSelectionPosition, 
    getActiveKey,
    getInsertionAbsolutePosition,
    updateLastValidPosition,
    getLastValidPosition,
    getSelectionContext, 
    restoreCursor, // 통합된 복원 함수
    getDomSelection,
    // 아래 구형 함수들은 호환성을 위해 유지하거나 restoreCursor로 브릿지
    restoreSelectionPositionByChunk: (data) => restoreCursor({ lineIndex: data.lineIndex, anchor: data }),
    restoreTableSelection: (data) => restoreCursor({ lineIndex: data.lineIndex, anchor: { chunkIndex: data.chunkIndex, type: 'table', detail: data.cell } })
  };
}
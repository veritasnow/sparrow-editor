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
    if (!sel.rangeCount) return null;

    const context = getSelectionContext(); 
    if (!context) return null;

    const { lineIndex, dataIndex, activeNode, container, cursorOffset } = context;

    // [Case A] 테이블 내부인 경우 상세 좌표 추출
    // activeNode 자체가 TABLE이거나 TABLE의 자식인 경우
    const tableEl = activeNode?.closest('table');
    if (tableEl) {
      const td = container.nodeType === Node.TEXT_NODE ? container.parentElement.closest('td') : container.closest('td');
      if (td) {
        const tr = td.parentElement;
        const tbody = tr.parentElement; // 보통 tbody가 존재함
        
        return {
          lineIndex,
          anchor: {
            chunkIndex: dataIndex,
            type: 'table',
            detail: {
              rowIndex: Array.from(tbody.children).indexOf(tr),
              colIndex: Array.from(tr.children).indexOf(td),
              offset: cursorOffset
            }
          }
        };
      }
    }

    // [Case B] 일반 텍스트 또는 기타 청크인 경우
    return {
      lineIndex,
      anchor: {
        chunkIndex: dataIndex ?? 0,
        type: 'text',
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

    // chunkIndex를 통해 DOM 엘리먼트 탐색
    const chunkEl = Array.from(lineEl.children).find(
      el => parseInt(el.dataset.index, 10) === anchor.chunkIndex
    );
    if (!chunkEl) return;

    let targetNode = null;
    let finalOffset = 0;

    if (anchor.type === 'table' && anchor.detail) {
      // 테이블 복원 로직
      const { rowIndex, colIndex, offset } = anchor.detail;
      const tr = chunkEl.querySelectorAll('tr')[rowIndex];
      const td = tr?.querySelectorAll('td')[colIndex];
      if (!td) return;

      // 셀 내부의 텍스트 노드 탐색 (없으면 생성)
      targetNode = td.firstChild;
      if (!targetNode || targetNode.nodeType !== Node.TEXT_NODE) {
        targetNode = td.appendChild(document.createTextNode('\u00A0'));
      }
      finalOffset = Math.min(offset, targetNode.length);
    } else {
      // 일반 텍스트 청크 복원 로직
      // 청크 내의 첫 번째 텍스트 노드 찾기
      chunkEl.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) targetNode = node;
      });

      if (!targetNode) {
        targetNode = chunkEl.appendChild(document.createTextNode('\u00A0'));
      }
      finalOffset = Math.min(anchor.offset || 0, targetNode.length);
    }

    // DOM Range 설정
    try {
      const range = document.createRange();
      const sel = window.getSelection();
      range.setStart(targetNode, finalOffset);
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

  // 기존 레거시 함수들 (필요시 유지하되 내부적으로 restoreCursor를 쓰도록 리팩토링 가능)
  function getCurrentLineIndex() {
    const context = getSelectionContext();
    return context ? context.lineIndex : 0;
  }

  /**
   * DOM 전체 텍스트 기반 선택 영역 (멀티 라인 선택 시 사용)
   */
  function getDomSelection() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;

    const domRange = sel.getRangeAt(0);
    const paragraphs = Array.from(root.childNodes).filter(p => p.tagName === 'P');
    const ranges = [];

    paragraphs.forEach((p, idx) => {
      const pRange = document.createRange();
      pRange.selectNodeContents(p);

      if (domRange.compareBoundaryPoints(Range.END_TO_START, pRange) < 0 &&
          domRange.compareBoundaryPoints(Range.START_TO_END, pRange) > 0) {
        
        const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
        let started = false, total = 0;
        let startOffset = 0, endOffset = 0;

        while (walker.nextNode()) {
          const node = walker.currentNode;
          const len = node.textContent.length;

          if (!started && domRange.startContainer === node) {
            startOffset = total + domRange.startOffset;
            started = true;
          }
          if (domRange.endContainer === node) {
            endOffset = total + domRange.endOffset;
            break;
          }
          total += len;
        }

        if (!started) startOffset = 0;
        if (endOffset === 0) endOffset = total;
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

      console.log("getInsertionAbsolutePosition sel:", sel);

      if (!sel.rangeCount) return null;

      const range     = sel.getRangeAt(0);
      const container = range.startContainer;
      const offsetInNode = range.startOffset;

      console.log("range sel:", range);
      console.log("container sel:", container);
      console.log("offsetInNode sel:", offsetInNode);


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

  return { 
    getCurrentLineIndex, 
    getSelectionPosition, 
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
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

      // 1. 테이블 내부인 경우 (기존 로직 유지 및 보강)
      const tableEl = activeNode?.closest('table');
      if (tableEl) {
        const td = container.nodeType === Node.TEXT_NODE ? container.parentElement.closest('td') : container.closest('td');
        if (td) {
          const tr = td.parentElement;
          const tbody = tr.parentElement;
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

      // ✨ 2. 비디오/이미지 등 Atomic Chunk인 경우 감지
      // activeNode의 classList나 data-type 속성 등을 활용합니다.
      let chunkType = 'text'; // 기본값
      if (activeNode) {
          if (activeNode.classList.contains('chunk-video') || activeNode.querySelector('iframe, video')) {
              chunkType = 'video';
          } else if (activeNode.classList.contains('chunk-image') || activeNode.querySelector('img')) {
              chunkType = 'image';
          } else if (activeNode.dataset.type) {
              // 만약 청크 생성 시 data-type="video" 식의 속성을 넣어두었다면 가장 정확합니다.
              chunkType = activeNode.dataset.type;
          }
      }

      // 3. 통합 반환
      return {
        lineIndex,
        anchor: {
          chunkIndex: dataIndex ?? 0,
          type: chunkType, // 추출된 실제 타입 (text, video, image 등)
          offset: cursorOffset
        }
      };
    }
  /*
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
  */


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
  /*
  function getDomSelection() {
      const sel = window.getSelection();
      if (!sel.rangeCount) return null;

      const domRange = sel.getRangeAt(0);
      const paragraphs = Array.from(root.childNodes).filter(p => p.tagName === 'P');
      const ranges = [];

      paragraphs.forEach((p, idx) => {
          const pRange = document.createRange();
          pRange.selectNodeContents(p);

          // 해당 P태그가 선택 영역에 걸쳐있는지 확인
          if (domRange.compareBoundaryPoints(Range.END_TO_START, pRange) < 0 &&
              domRange.compareBoundaryPoints(Range.START_TO_END, pRange) > 0) {
              
              let total = 0;
              let startOffset = -1;
              let endOffset = -1;

              // TreeWalker 대신 자식 노드(Chunk)들을 직접 순회
              const chunks = Array.from(p.childNodes);
              
              for (const node of chunks) {
                  // 1. 시작점(Start) 계산
                  if (startOffset === -1) {
                      if (domRange.startContainer === node) {
                          // 노드 자체가 선택된 경우 (보통 Atomic Node 앞/뒤)
                          startOffset = total + domRange.startOffset;
                      } else if (node.contains(domRange.startContainer)) {
                          // 텍스트 노드 등 내부 요소가 선택된 경우
                          startOffset = total + domRange.startOffset;
                      }
                  }

                  // 2. 끝점(End) 계산
                  if (endOffset === -1) {
                      if (domRange.endContainer === node) {
                          endOffset = total + domRange.endOffset;
                      } else if (node.contains(domRange.endContainer)) {
                          endOffset = total + domRange.endOffset;
                      }
                  }

                  // 3. 길이 합산 (모델과 동일한 규칙)
                  if (node.nodeType === Node.TEXT_NODE) {
                      total += node.textContent.length;
                  } else if (node.classList && node.classList.contains('chunk-text')) {
                      // Span으로 감싸진 텍스트 청크
                      total += node.textContent.length;
                  } else {
                      // 비디오, 이미지 등 (Atomic Block)
                      total += 1;
                  }
              }

              // Fallback: 컨테이너가 P 자체일 경우 처리
              if (startOffset === -1) startOffset = (domRange.startContainer === p) ? domRange.startOffset : 0;
              if (endOffset === -1) endOffset = (domRange.endContainer === p) ? domRange.endOffset : total;

              ranges.push({ lineIndex: idx, startIndex: startOffset, endIndex: endOffset });
          }
      });

      return ranges.length ? ranges : null;
  }
  */


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

  return { 
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
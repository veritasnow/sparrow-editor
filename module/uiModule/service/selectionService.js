// /module/uiModule/service/selectionService.js

export function createSelectionService({ root }) {
  
  // 현재 커서가 위치한 줄의 index를 반환
  function getCurrentLineIndex() {
    // ... (로직 동일)
    const sel = window.getSelection();
    if (!sel.rangeCount) return 0;

    let el = sel.anchorNode.nodeType === Node.TEXT_NODE
      ? sel.anchorNode.parentElement
      : sel.anchorNode;

    while (el && el !== root) {
      if (el.tagName === 'P') return Array.from(root.childNodes).indexOf(el);
      el = el.parentElement;
    }

    return 0;
  }

  // 현재 커서 위치를 lineIndex + offset 형태로 반환
  function getSelectionPosition() {
    // ... (로직 동일)
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;

    const range = sel.getRangeAt(0);
    const idx = getCurrentLineIndex();
    const p = root.childNodes[idx];
    if (!p) return null;

    let offset = 0;
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node === range.startContainer) {
        offset += range.startOffset;
        break;
      }
      offset += node.textContent.length;
    }

    return { lineIndex: idx, offset };
  }

  // 💡 인자를 객체 하나로 받도록 통일 ({ lineIndex, chunkIndex, offset })
  function restoreSelectionPositionByChunk({ lineIndex, chunkIndex, offset }) { 
    // 💡 개선: 하드코딩된 ID 대신 root 객체 사용
    const editorEl = root; 
    const lineEl = editorEl.children[lineIndex];
    if (!lineEl) return;

    // chunk 찾기
    const chunkEl = Array.from(lineEl.children).find(
      (el) => parseInt(el.dataset.index, 10) === chunkIndex
    );
    if (!chunkEl) return;

    const textLength = chunkEl.textContent.length;
    const safeOffset = Math.min(offset, textLength); // offset clamp

    const range = document.createRange();
    const sel = window.getSelection();

    // chunk 안의 텍스트 노드 찾기
    let textNode = null;
    chunkEl.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) textNode = node;
    });

    if (!textNode) return;

    range.setStart(textNode, safeOffset);
    range.collapse(true);

    sel.removeAllRanges();
    sel.addRange(range);
  }

  // lineIndex + offset 기준으로 커서 복원
  function restoreSelectionPosition(pos) {
    // ... (로직 동일)
    if (!pos) return;
    const p = root.childNodes[pos.lineIndex];
    if (!p) return;

    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
    let acc = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const len = node.textContent.length;
      if (acc + len >= pos.offset) {
        const range = document.createRange();
        range.setStart(node, pos.offset - acc);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      acc += len;
    }

    // 텍스트 노드 없으면 span이나 p 자체에 커서 지정
    const firstChild = p.querySelector('span');
    const targetNode = firstChild || p;
    const range = document.createRange();
    range.setStart(targetNode, 0);
    range.collapse(true);

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // 현재 선택 영역을 chunk 배열 기반으로 반환
  function getSelectionRangesInState(getEditorState) {
    // ... (로직 동일)
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;

    const domRange = sel.getRangeAt(0);
    const paragraphs = Array.from(root.childNodes).filter(p => p.tagName === 'P');
    const ranges = [];
    const state = typeof getEditorState === 'function' ? getEditorState() : null;

    paragraphs.forEach((p, idx) => {
      const pRange = document.createRange();
      pRange.selectNodeContents(p);

      if (
        domRange.compareBoundaryPoints(Range.END_TO_START, pRange) < 0 &&
        domRange.compareBoundaryPoints(Range.START_TO_END, pRange) > 0
      ) {
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

        // chunk 배열 기반으로 offset 클램프
        if (state && state[idx]) {
          const lineChunks = state[idx];
          const lineLen = lineChunks.reduce((sum, chunk) => sum + (chunk.text?.length || 0), 0);
          startOffset = Math.max(0, Math.min(startOffset, lineLen));
          endOffset = Math.max(0, Math.min(endOffset, lineLen));
        }

        ranges.push({ lineIndex: idx, startIndex: startOffset, endIndex: endOffset });
      }
    });

    return ranges.length ? ranges : null;
  }

  function getSelectionContext() {
    // ... (로직 동일)
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;

    const range = sel.getRangeAt(0);
    const container = range.startContainer;
    const cursorOffset = range.startOffset;
    
    // 1. P 엘리먼트 탐색
    const parentP = container.nodeType === Node.TEXT_NODE
      ? container.parentElement.closest('p')
      : container.closest('p');
    
    if (!parentP || parentP.parentElement !== root) return null;

    const lineIndex = Array.from(root.childNodes).indexOf(parentP);

    // 2. 💡 [data-index]를 가진 Active Node 탐색 (추가 로직)
    const activeNode = container.nodeType === Node.TEXT_NODE
      ? container.parentElement.closest('[data-index]')
      : container.closest('[data-index]');
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

  return { getCurrentLineIndex, getSelectionPosition, getSelectionContext, restoreSelectionPosition, getSelectionRangesInState, restoreSelectionPositionByChunk };
}
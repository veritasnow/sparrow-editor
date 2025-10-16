// /module/uiModule/service/selectionService.js
export function createSelectionService({ root }) {
  
  // 현재 커서가 위치한 줄의 index를 반환
  function getCurrentLineIndex() {
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
  /*
  function getCurrentLineIndex() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return 0;

    let el = sel.anchorNode;
    if (el.nodeType === Node.TEXT_NODE) el = el.parentElement;

    // 부모 P 탐색
    while (el && el !== root) {
      if (el.tagName === 'P') return Array.from(root.childNodes).indexOf(el);
      el = el.parentElement;
    }

    // 첫 P가 존재하면 첫 줄 반환
    const firstP = root.querySelector('p.text-block');
    if (firstP) return Array.from(root.childNodes).indexOf(firstP);

    return 0;
  }
  */

  // 현재 커서 위치를 lineIndex + offset 형태로 반환
  function getSelectionPosition() {
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

  // lineIndex + offset 기준으로 커서 복원
  function restoreSelectionPosition(pos) {
      if (!pos) return;
      const p = root.childNodes[pos.lineIndex];
      if (!p) return;

      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
      let acc = 0;

      // 텍스트 노드가 있으면 offset 계산
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

  return { getCurrentLineIndex, getSelectionPosition, restoreSelectionPosition, getSelectionRangesInState };
}

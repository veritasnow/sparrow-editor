// core/scroll/scrollRenderService.js

export function createScrollRenderService({
  rootEl,
  stateAPI,
  uiAPI,
  contentKey,
  getEditorContext
}) {
  let enabled = true;
  let lastRange = { start: -1, end: -1 };
  let isTicking = false; // rAF 플래그

  const BUFFER = 10; // 유동적인 높이에 대응하기 위해 버퍼 상향 조정
  const APPROX_LINE_HEIGHT = 24;

  function calculateRenderRange() {
    const viewportHeight = rootEl.clientHeight;
    const scrollTop = Math.max(0, rootEl.scrollTop);
    const state = stateAPI.get(contentKey);
    const totalCount = state.length;

    if (totalCount === 0) return { start: 0, end: 0 };

    const startLine = Math.floor(scrollTop / APPROX_LINE_HEIGHT);
    const visibleCount = Math.ceil(viewportHeight / APPROX_LINE_HEIGHT);

    let start = Math.max(0, startLine - BUFFER);
    let end = Math.min(totalCount - 1, startLine + visibleCount + BUFFER);

    return { start, end };
  }

  function handleScroll() {
    if (!enabled || isTicking) return;

    // requestAnimationFrame으로 쓰로틀링 처리
    isTicking = true;
    window.requestAnimationFrame(() => {
      const editorContext = getEditorContext();
      
      // 잠금 상태 확인
      if (editorContext.selectionMode === 'range' || editorContext.selectionMode === 'cell') {
        isTicking = false;
        return;
      }

      const range = calculateRenderRange();

      // 범위가 변했을 때만 UI 업데이트 요청
      if (range.start !== lastRange.start || range.end !== lastRange.end) {
        lastRange = range;
        uiAPI.partialRenderOnScroll({
          editorState: stateAPI.get(contentKey),
          range,
          editorContext,
        });
      }
      
      isTicking = false;
    });
  }

  return { handleScroll, enable: () => { enabled = true; }, disable: () => { enabled = false; } };
}
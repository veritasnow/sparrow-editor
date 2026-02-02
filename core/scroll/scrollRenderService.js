// core/scroll/scrollRenderService.js
export function createScrollRenderService({
  rootEl,
  stateAPI,
  uiAPI,
  contentKey,
  getEditorContext
}) {
  let enabled = true;
  let lastSentRange = { start: -1, end: -1 };
  const BUFFER = 10; 
  const LINE_HEIGHT = 24;

  function calculateRenderRange() {
    const scrollTop = Math.max(0, rootEl.scrollTop);
    const viewportHeight = rootEl.clientHeight;
    const state = stateAPI.get(contentKey);
    const totalCount = state.length;

    if (totalCount === 0) return { start: 0, end: 0 };

    // 현재 스크롤 위치 기준 첫 번째 라인 계산
    const currentStartLine = Math.floor(scrollTop / LINE_HEIGHT);
    const visibleCount = Math.ceil(viewportHeight / LINE_HEIGHT);

    let start = Math.max(0, currentStartLine - BUFFER);
    let end = Math.min(totalCount - 1, currentStartLine + visibleCount + BUFFER);

    return { start, end };
  }

  function handleScroll() {
    if (!enabled) return;

    window.requestAnimationFrame(() => {
      const editorContext = getEditorContext();
      
      // 드래그나 범위 선택 중에는 렌더링 스킵
      if (editorContext.selectionMode === 'range' || editorContext.selectionMode === 'cell') {
        return;
      }

      const range = calculateRenderRange();

      // [핵심] 계산된 범위가 이전과 다를 때만 UI 업데이트 호출
      if (range.start !== lastSentRange.start || range.end !== lastSentRange.end) {
        lastSentRange = range;
        uiAPI.partialRenderOnScroll({
          editorState: stateAPI.get(contentKey),
          range,
          editorContext,
        });
      }
    });
  }

  return {
    handleScroll,
    enable: () => { enabled = true; },
    disable: () => { enabled = false; }
  };
}
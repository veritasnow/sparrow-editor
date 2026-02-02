// service/partialRenderService.js
export function createPartialRenderService({
  rootId,
  renderService,
}) {
  let renderedRange = { start: 0, end: -1 };

  const VIEW_COUNT = 20;
  const BUFFER = 20;

  function isRenderLocked(editorContext) {
    return (
      editorContext.selectionMode !== "none" ||
      editorContext.renderingLock === true
    );
  }

  function calculateVisibleLineRange(scrollTop) {
    const approxLineHeight = 24;

    const startLine = Math.floor(scrollTop / approxLineHeight);
    const endLine = startLine + VIEW_COUNT;

    return {
      start: Math.max(0, startLine - BUFFER),
      end: endLine + BUFFER,
    };
  }

  function applyPartialRender(nextRange, editorState) {
    // 제거
    for (let i = renderedRange.start; i <= renderedRange.end; i++) {
      if (i < nextRange.start || i > nextRange.end) {
        renderService.removeLine(i, rootId);
      }
    }

    // 추가
    for (let i = nextRange.start; i <= nextRange.end; i++) {
      if (i < renderedRange.start || i > renderedRange.end) {
        const line = editorState[i];
        if (!line) continue;

        renderService.insertLine(i, line.align, rootId);
        renderService.renderLine(i, line, rootId);
      }
    }

    renderedRange = nextRange;
  }


  /**
 * editorContext
 * ----------------------------------------
 * 에디터의 "데이터 상태(editorState)"와 분리된
 * 실행 중 UI / 인터랙션 컨텍스트 정보.
 *
 * - 저장 대상 ❌
 * - 모델 ❌
 * - UI 동작 제어용 메타 상태
 *
 * 주 용도:
 * - 선택 중(selectionMode !== 'none')에는 DOM 구조 변경 금지
 * - IME 입력 중(composing)에는 렌더링/라인 조작 금지
 * - 드래그 중(dragging)에는 부분 렌더링 금지
 * - 일시적인 렌더링 차단(renderingLock)
 *
 * ⚠️ 주의
 * - editorContext는 서비스가 소유하지 않는다
 * - 생성자에 주입하지 않는다
 * - 필요 시 호출 시점에 인자로 전달한다
 *
 * 예:
 * onScroll(scrollTop, editorState, editorContext)
 */
  function onScroll({
    scrollTop,
    editorState,
    editorContext,
  }) {
    if (isRenderLocked(editorContext)) return;

    const nextRange = calculateVisibleLineRange(scrollTop);

    if (
      nextRange.start === renderedRange.start &&
      nextRange.end === renderedRange.end
    ) return;

    applyPartialRender(nextRange, editorState);
  }

  function forceFullRender(editorState) {
    renderService.render(editorState, rootId);
    renderedRange = { start: 0, end: editorState.length - 1 };
  }

  function reset() {
    renderedRange = { start: 0, end: -1 };
  }

  return {
    onScroll,
    forceFullRender,
    reset,
    getRenderedRange: () => ({ ...renderedRange }),
  };
}

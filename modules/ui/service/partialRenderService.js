// core/scroll/partialRenderService.js
export function createPartialRenderService({ rootId, renderService }) {
  const LINE_HEIGHT = 24;

  function applyPartialRender(range, editorState) {
    const container = document.getElementById(rootId);
    if (!container) return;

    // 1️⃣ 전체 가상 높이 설정 (스크롤 영역 확보)
    const totalHeight = editorState.length * LINE_HEIGHT;
    //container.style.height = `${totalHeight}px`;

    // 2️⃣ 내용 렌더링
    // container 내부를 비우고 현재 범위의 p 태그들을 직접 삽입
    container.innerHTML = ""; 
    const linesToRender = editorState.slice(range.start, range.end + 1);
    linesToRender.forEach((lineData, idx) => {
      const lineIndex = range.start + idx;
      // container에 직접 렌더링
      renderService.renderLine(lineIndex, lineData, container.id); 
    });

    // 3️⃣ 핵심: container에 직접 translate 적용
    const offset = range.start * LINE_HEIGHT;
    container.style.transform = `translate3d(0, ${offset}px, 0)`;
    container.style.top = `-${offset}px`;
    
    // 💡 [참고] 이 방식이 작동하려면 부모 요소(editor-container)가 
    // container가 도망가도 스크롤 길이를 인지할 수 있는 별도의 Spacer를 갖거나,
    // 부모의 height가 고정되어 있어야 합니다.
  }

  return {
    onScroll: ({ range, editorState, editorContext }) => {
      if (editorContext.renderingLock) return;
      applyPartialRender(range, editorState);
    },
    reset: () => {}
  };
}
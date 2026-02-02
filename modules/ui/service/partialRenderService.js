// service/partialRenderService.js

export function createPartialRenderService({ rootId, renderService }) {
  let renderedRange = { start: 0, end: -1 };

  function isRenderLocked(editorContext) {
    return (
      editorContext.selectionMode === "range" || 
      editorContext.renderingLock === true ||
      editorContext.dragging === true ||
      editorContext.composing === true
    );
  }
function applyPartialRender(nextRange, editorState) {
    const container = document.getElementById(rootId);
    if (!container) return;

    const approxLineHeight = 24;

    // 1. 현재 노드 매핑 (삭제 및 위치 확인용)
    const currentNodes = Array.from(container.querySelectorAll('.text-block'));
    const nodeMap = new Map();
    currentNodes.forEach(node => {
        const idx = parseInt(node.dataset.lineIndex);
        // 범위 밖이면 제거, 안쪽이면 맵에 저장
        if (idx < nextRange.start || idx > nextRange.end) {
            node.remove();
        } else {
            nodeMap.set(idx, node);
        }
    });

    // 2. [핵심] nextRange 시작부터 끝까지 루프를 돌며 순서대로 배치
    for (let i = nextRange.start; i <= nextRange.end; i++) {
        const lineData = editorState[i];
        if (!lineData) continue;

        if (!nodeMap.has(i)) {
            // DOM에 없으면 생성 (이때 renderLine은 container 맨 뒤에 붙일 것임)
            renderService.renderLine(i, lineData, rootId);
            
            // 방금 생성되어 맨 뒤에 붙은 노드를 찾아서 가져옴
            const newNode = container.lastElementChild;
            
            // [포인트] 생성된 놈을 '현재 순서'에 맞게 맨 뒤로 다시 보냄
            // 루프가 i 순서대로 돌기 때문에 appendChild만 계속 해줘도 결국 정렬됨
            container.appendChild(newNode);
        } else {
            // 이미 있는 노드도 순서 유지를 위해 맨 뒤로 다시 보냄
            container.appendChild(nodeMap.get(i));
        }
    }

    // 3. 패딩 보정
    container.style.paddingTop = `${nextRange.start * approxLineHeight}px`;
    const bottomCount = editorState.length - 1 - nextRange.end;
    container.style.paddingBottom = `${Math.max(0, bottomCount * approxLineHeight)}px`;

    renderedRange = { ...nextRange };
}

  function onScroll({ range, editorState, editorContext }) {
    if (isRenderLocked(editorContext)) return;
    if (range.start === renderedRange.start && range.end === renderedRange.end) return;

    applyPartialRender(range, editorState);
  }

  return { onScroll, reset: () => { renderedRange = { start: 0, end: -1 }; } };
}
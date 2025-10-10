import { createRenderService    } from "../service/renderService.js";
import { createSelectionService } from "../service/selectionService.js";

export function createUiApplication({ rootId, rendererRegistry }) {
  const renderService = createRenderService(rendererRegistry);
  const selectionService = createSelectionService({ root: document.getElementById(rootId) });

  return {
    // 렌더링    
    render: (editorState) => renderService.render(editorState, rootId),
    ensureFirstLine: () => renderService.ensureFirstLineP(rootId),

    // 선택 영역
    getSelectionRangesInState: (editorState) => selectionService.getSelectionRangesInState(editorState),
    getSelectionPosition: () => selectionService.getSelectionPosition(),
    restoreSelectionPosition: (pos) => selectionService.restoreSelectionPosition(pos),
  };
}

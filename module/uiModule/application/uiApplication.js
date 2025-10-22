import { createRenderService    } from "../service/renderService.js";
import { createSelectionService } from "../service/selectionService.js";

export function createUiApplication({ rootId, rendererRegistry }) {
  const renderService = createRenderService(rendererRegistry);
  const selectionService = createSelectionService({ root: document.getElementById(rootId) });

  return {
    // 기존
    render: (editorState) => renderService.render(editorState, rootId),
    renderLine: (rootId, lineIndex, lineData) => renderService.renderLine(rootId, lineIndex, lineData),
    ensureFirstLine: () => renderService.ensureFirstLineP(rootId),

    // 새로 추가
    shiftLinesDown: (fromIndex) => renderService.shiftLinesDown(rootId, fromIndex),

    renderChunk: (rootId, lineIndex, chunkIndex, chunkData) => renderService.renderChunk(rootId, lineIndex, chunkIndex, chunkData),

    // 선택 영역
    getSelectionRangesInState: (editorState) => selectionService.getSelectionRangesInState(editorState),
    getSelectionPosition: () => selectionService.getSelectionPosition(),
    restoreSelectionPosition: (pos) => selectionService.restoreSelectionPosition(pos),


    

    restoreSelectionPosition2222: (lineIndex, chunkIndex, offset) => selectionService.restoreSelectionPosition2222(lineIndex, chunkIndex, offset),

  };
}

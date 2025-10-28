import { createRenderService    } from "../service/renderService.js";
import { createSelectionService } from "../service/selectionService.js";
import { createDomService       } from "../service/domService.js";

export function createUiApplication({ rootId, rendererRegistry }) {
  const renderService    = createRenderService(rendererRegistry);
  const selectionService = createSelectionService({ root: document.getElementById(rootId) });
  const domService       = createDomService();

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
    getSelectionContext : () => selectionService.getSelectionContext(),
    restoreSelectionPosition: (pos) => selectionService.restoreSelectionPosition(pos),
    parseParentPToChunks : (parentP, currentLineChunks, selectionContainer, cursorOffset, lineIndex) => 
        domService.parseParentPToChunks(parentP, currentLineChunks, selectionContainer, cursorOffset, lineIndex),

    restoreSelectionPositionByChunk: (lineIndex, chunkIndex, offset) => selectionService.restoreSelectionPositionByChunk(lineIndex, chunkIndex, offset),

  };
}

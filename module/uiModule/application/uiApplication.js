import { createRenderService    } from "../service/renderService.js";
import { createSelectionService } from "../service/selectionService.js";
import { createDomService       } from "../service/domService.js";

export function createUiApplication({ rootId, rendererRegistry }) {
  
  // renderService에 rootId를 전달하여 내부 상태로 관리하게 함
  const renderService    = createRenderService({ rootId, rendererRegistry }); 
  const selectionService = createSelectionService({ root: document.getElementById(rootId) });
  
  // domService는 DOM 조작 유틸리티이므로 인자 없이 생성
  const domService       = createDomService(); 

  return {
    // 💡 추가: rootId를 외부에 노출하여 프로세서 서비스들이 DOM 엘리먼트를 획득할 수 있도록 합니다.
    rootId: rootId,
    
    // ───────── 렌더링 ─────────
    render         : (editorState) => renderService.render(editorState), 
    renderLine     : (lineIndex, lineData) => renderService.renderLine(lineIndex, lineData),
    ensureFirstLine: () => renderService.ensureFirstLineP(),
    shiftLinesDown : (fromIndex) => renderService.shiftLinesDown(fromIndex),
    renderChunk:    (lineIndex, chunkIndex, chunkData) => renderService.renderChunk(lineIndex, chunkIndex, chunkData),

    // ───────── 선택 영역 ─────────
    getSelectionRangesInState: (editorState) => selectionService.getSelectionRangesInState(editorState),
    getSelectionPosition: () => selectionService.getSelectionPosition(),
    getSelectionContext : () => selectionService.getSelectionContext(),
    restoreSelectionPosition: (pos) => selectionService.restoreSelectionPosition(pos),
    
    // 인자를 객체로 통일하여 전달 
    restoreSelectionPositionByChunk: (pos) => selectionService.restoreSelectionPositionByChunk(pos), 

    // ───────── DOM 처리 ─────────
    parseParentPToChunks : (parentP, currentLineChunks, selectionContainer, cursorOffset, lineIndex) => 
        domService.parseParentPToChunks(parentP, currentLineChunks, selectionContainer, cursorOffset, lineIndex),
    insertNewLineElement : (lineIndex, align) => renderService.insertNewLineElement(lineIndex, align),
    removeLineElement : (lineIndex) => renderService.removeLineElement(lineIndex),

  };
}

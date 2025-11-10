import { createRenderService    } from "../service/renderService.js";
import { createSelectionService } from "../service/selectionService.js";
import { createDOMParseService } from "../service/domParserService.js";

/**
 * UI 애플리케이션을 생성합니다.
 * 이 모듈은 UI 관련 핵심 서비스들을 초기화하고 통합하여 상위 레이어(core, features)에 노출합니다.
 * UI 레이어는 Model <-> View 간의 모든 변환을 담당하는 경계층입니다.
 * @param {Object} config - { rootId: string, rendererRegistry: Object }
 * @returns {Object} UI 관련 통합 함수들
 */
export function createUiApplication({ rootId, rendererRegistry }) {
  
  // 1. 서비스 초기화
  // renderService에 rootId를 전달하여 내부 상태로 관리하게 함
  const renderService    = createRenderService({ rootId, rendererRegistry }); 
  const selectionService = createSelectionService({ root: document.getElementById(rootId) });
  // DOM 파싱 서비스 초기화
  const domParserService = createDOMParseService(); 

  
  return {
    // 💡 추가: rootId를 외부에 노출하여 프로세서 서비스들이 DOM 엘리먼트를 획득할 수 있도록 합니다.
    rootId: rootId,
    
    // ───────── 렌더링 (Model -> View) ─────────
    render         : (editorState) => renderService.render(editorState), 
    renderLine     : (lineIndex, lineData) => renderService.renderLine(lineIndex, lineData),
    ensureFirstLine: () => renderService.ensureFirstLineP(),
    shiftLinesDown : (fromIndex) => renderService.shiftLinesDown(fromIndex),
    renderChunk    : (lineIndex, chunkIndex, chunkData) => renderService.renderChunk(lineIndex, chunkIndex, chunkData),

    // ───────── 선택 영역 (View 정보 추출) ─────────
    getSelectionRangesInDOM: () => selectionService.getSelectionRangesInDOM(),
    getSelectionPosition: () => selectionService.getSelectionPosition(),
    getSelectionContext : () => selectionService.getSelectionContext(),
    restoreSelectionPosition: (pos) => selectionService.restoreSelectionPosition(pos),
    
    // 인자를 객체로 통일하여 전달 
    restoreSelectionPositionByChunk: (pos) => selectionService.restoreSelectionPositionByChunk(pos), 

    // ───────── DOM 구조 조작 (핵심 입력 로직 지원) ─────────
    insertNewLineElement : (lineIndex, align) => renderService.insertNewLineElement(lineIndex, align),
    removeLineElement : (lineIndex) => renderService.removeLineElement(lineIndex),


    // ───────── DOM 파싱 (View -> Model) ─────────
    /**
     * DOM 엘리먼트에서 청크 배열과 커서 복원 데이터를 파싱하여 반환합니다.
     * @param {HTMLElement} parentP - 현재 라인의 <p> 엘리먼트
     * @param {Array<Object>} currentLineChunks - 현재 상태의 청크 배열 (비텍스트 청크 참조용)
     * @param {Node} selectionContainer - 커서가 위치한 DOM 노드
     * @param {number} cursorOffset - 커서가 위치한 DOM 노드 내의 오프셋
     * @param {number} lineIndex - 현재 라인 인덱스
     * @returns {{ newChunks: Array, restoreData: Object }}
     */
    parseLineDOM: (parentP, currentLineChunks, selectionContainer, cursorOffset, lineIndex) => 
        domParserService.parseLineDOM(parentP, currentLineChunks, selectionContainer, cursorOffset, lineIndex),
  };
}
// application/uiApplication.js
import { createRenderService } from "../service/renderService.js";
import { createSelectionService } from "../service/selectionService.js";
import { createDOMParseService } from "../service/domParserService.js";

/**
 * UI 애플리케이션을 생성합니다.
 * UI 레이어는 Model <-> View 변환의 경계층이며
 * DOM의 생명주기를 단일 책임으로 관리합니다.
 */
export function createUiApplication({ rootId, rendererRegistry }) {

  // ----------------------------
  // [1] Root & Service 초기화
  // ----------------------------
  const rootEl = document.getElementById(rootId);
  if (!rootEl) {
    throw new Error(`❌ UI root element not found: ${rootId}`);
  }

  const renderService    = createRenderService({ rootId, rendererRegistry });
  const selectionService = createSelectionService({ root: rootEl });
  const domParserService = createDOMParseService();

  let destroyed = false;

  function assertAlive() {
    if (destroyed) {
      throw new Error("❌ UiApplication has been destroyed");
    }
  }

  // ----------------------------
  // [2] destroy (UI 생명주기 종료)
  // ----------------------------
  function destroy() {
    if (destroyed) return;
    destroyed = true;

    // 1. Selection 해제
    const sel = window.getSelection();
    sel?.removeAllRanges();

    // 2. root 내부 DOM 정리
    rootEl.innerHTML = "";

    console.log("🗑️ UiApplication destroyed : ", rootEl);
  }

  // ----------------------------
  // [3] 외부 노출 API
  // ----------------------------
  return {
    // 💡 rootId 노출 (상위 레이어 연계용)
    rootId,

    // ───────── 렌더링 (Model → View) ─────────
    render(editorState) {
      assertAlive();
      renderService.render(editorState);
    },

    renderLine(lineIndex, lineData) {
      assertAlive();
      renderService.renderLine(lineIndex, lineData);
    },

    renderChunk(lineIndex, chunkIndex, chunkData) {
      assertAlive();
      renderService.renderChunk(lineIndex, chunkIndex, chunkData);
    },

    ensureFirstLine() {
      assertAlive();
      renderService.ensureFirstLineP();
    },

    shiftLinesDown(fromIndex) {
      assertAlive();
      renderService.shiftLinesDown(fromIndex);
    },

    // ───────── DOM 구조 조작 ─────────
    insertNewLineElement(lineIndex, align) {
      assertAlive();
      renderService.insertNewLineElement(lineIndex, align);
    },

    removeLineElement(lineIndex) {
      assertAlive();
      renderService.removeLineElement(lineIndex);
    },

    // ───────── Selection (View 정보) ─────────
    getSelectionRangesInDOM() {
      assertAlive();
      return selectionService.getSelectionRangesInDOM();
    },

    getSelectionPosition() {
      assertAlive();
      return selectionService.getSelectionPosition();
    },

    getSelectionContext() {
      assertAlive();
      return selectionService.getSelectionContext();
    },

    restoreSelectionPosition(pos) {
      assertAlive();
      selectionService.restoreSelectionPosition(pos);
    },

    restoreSelectionPositionByChunk(pos) {
      assertAlive();
      selectionService.restoreSelectionPositionByChunk(pos);
    },

    restoreTableSelection(pos) {
      assertAlive();
      selectionService.restoreTableSelection(pos);
    },


    // ───────── DOM → Model 파싱 ─────────
    parseLineDOM(
      parentP,
      currentLineChunks,
      selectionContainer,
      cursorOffset,
      lineIndex
    ) {
      assertAlive();
      return domParserService.parseLineDOM(
        parentP,
        currentLineChunks,
        selectionContainer,
        cursorOffset,
        lineIndex
      );
    },

    /**
     * 📌 Table DOM → table chunk data 변환
     *    table chunk 업데이트 시 사용
     */
    extractTableDataFromDOM(tableElement) {
      assertAlive();
      return domParserService.extractTableDataFromDOM(tableElement);
    },

    // ───────── Lifecycle ─────────
    destroy,
  };
}

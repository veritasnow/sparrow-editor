// application/uiApplication.js
import { createRenderer } from "../service/render.js";
import { domParse } from "../service/domParse.js";

/**
 * UI 애플리케이션을 생성합니다.
 * UI 레이어는 Model <-> View 변환의 경계층이며
 * targetKey(activeKey)를 통해 본문 및 테이블 셀 등 특정 영역의 DOM 생명주기를 관리합니다.
 */
export function createUiApplication({ rootId, rendererRegistry }) {

  // ----------------------------
  // [1] Root & Service 초기화
  // ----------------------------
  const rootEl = document.getElementById(rootId);
  if (!rootEl) {
    throw new Error(`❌ UI root element not found: ${rootId}`);
  }

  // 💡 renderer 생성 시 rootId 전달 (기본 컨테이너로 설정)
  const renderer  = createRenderer({ rootId, rendererRegistry });
  const domParser = domParse();

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

    // Selection 해제
    const sel = window.getSelection();
    sel?.removeAllRanges();

    // root 내부 DOM 정리
    rootEl.innerHTML = "";

    console.log("🗑️ UiApplication destroyed : ", rootId);
  }

  // ----------------------------
  // [3] 외부 노출 API (targetKey 지원)
  // ----------------------------
  return {
    rootId,

    // ───────── 렌더링 (Model → View) ─────────
    
    /**
     * @param {Array} editorState - 라인 모델 배열
     * @param {string} targetKey - 렌더링할 대상 ID (기본값: 메인 rootId)
     */
    render(editorState, targetKey = rootId) {
      assertAlive();
      renderer.render(editorState, targetKey);
    },

    renderLine(lineIndex, lineData, targetKey = rootId, externalPool = null, skipSync, options) {
      assertAlive();
      renderer.renderLine(lineIndex, lineData, targetKey, externalPool, skipSync, options);
    },

    renderChunk(lineIndex, chunkIndex, chunkData, targetKey = rootId) {
      assertAlive();
      renderer.renderChunk(lineIndex, chunkIndex, chunkData, targetKey);
    },

    ensureFirstLine(targetKey = rootId) {
      assertAlive();
      renderer.ensureFirstLine(targetKey);
    },

    shiftLinesDown(fromIndex, targetKey = rootId) {
      assertAlive();
      renderer.shiftLinesDown(fromIndex, targetKey);
    },

    // ───────── DOM 구조 조작 ─────────

    insertLine(lineIndex, align, targetKey = rootId) {
      assertAlive();
      renderer.insertLine(lineIndex, align, targetKey);
    },

    insertLineAfter(refEl, newIndex, align, targetKey) {
      assertAlive();
      renderer.insertLineAfter(refEl, newIndex, align, targetKey);
    },

    removeLine(lineIndex, targetKey = rootId) {
      assertAlive();
      renderer.removeLine(lineIndex, targetKey);
    },

    // ───────── DOM → Model 파싱 ─────────
    
    parseLineDOM(
      parentDom,
      currentLineChunks,
      selectionContainer,
      cursorOffset,
      lineIndex
    ) {
      assertAlive();
      return domParser.parseLineDOM(
        parentDom,
        currentLineChunks,
        selectionContainer,
        cursorOffset,
        lineIndex
      );
    },

    // ───────── Lifecycle ─────────
    destroy,
  };
}
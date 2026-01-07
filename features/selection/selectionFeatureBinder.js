import { createSelectionAnalyzeService } from './selectionAnalyzeService.js';
import { createSelectionUIService } from './selectionUiService.js';

export function bindSelectionFeature(stateAPI, uiAPI, editorEl, toolbarElements) {
  const selectionService = createSelectionAnalyzeService(stateAPI, uiAPI);
  const uiService        = createSelectionUIService(toolbarElements);

  // ---------------------------------------------------------
  // 🚫 드래그 앤 드롭 차단 (상태 오염 방지)
  // ---------------------------------------------------------
  
  // 1. 에디터 내부의 텍스트나 요소를 드래그해서 옮기는 행위 차단
  editorEl.addEventListener('dragstart', (e) => {
    // 텍스트 이동 시 발생하는 브라우저 기본 동작 차단
    e.preventDefault();
  });

  // 2. 외부 텍스트나 파일을 에디터 내부로 떨어뜨리는 행위 차단
  editorEl.addEventListener('drop', (e) => {
    // 모델을 거치지 않은 직접적인 DOM 삽입 차단
    e.preventDefault();
  });

  // ---------------------------------------------------------
  // 🔍 선택 영역 변경 감지
  // ---------------------------------------------------------
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!editorEl.contains(range.startContainer)) {
      // 에디터 밖 선택이면 UI 초기화
      uiService.clearAll();
      return;
    }

    const result = selectionService.analyzeSelection();
    uiService.updateUI(result);
  });

  return {
    // 테스트용/외부 호출용 API
    analyzeNow: () => {
      const result = selectionService.analyzeSelection();
      uiService.updateUI(result);
      return result;
    }
  };
}

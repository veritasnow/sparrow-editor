import { createSelectionAnalyzeService } from './selectionAnalyzeService.js';
import { createSelectionUIService } from './selectionUiService.js';

export function bindSelectionFeature(stateAPI, uiAPI, editorEl, toolbarElements) {
  const selectionService = createSelectionAnalyzeService(stateAPI, uiAPI);
  const uiService        = createSelectionUIService(toolbarElements);

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

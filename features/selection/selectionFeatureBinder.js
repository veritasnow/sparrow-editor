import { createSelectionAnalyzeService } from './selectionAnalyzeService.js';
import { createSelectionUIService } from './selectionUiService.js';

export function bindSelectionFeature(stateAPI, uiAPI, editorEl, toolbarElements) {
  const selectionService = createSelectionAnalyzeService(stateAPI, uiAPI);
  const uiService        = createSelectionUIService(toolbarElements);

  let isDragging = false;
  let startTD = null;

  // [도우미] 모든 셀 선택 해제
  const clearCellSelection = () => {
    editorEl.querySelectorAll('.se-table-cell.is-selected').forEach(td => {
      td.classList.remove('is-selected');
    });
  };

  // [도우미] 시각적 클래스 부여 및 브라우저 Range 강제 설정
  function applyVisualAndRangeSelection(selectedCells) {
    if (selectedCells.length === 0) return;
    
    clearCellSelection();
    selectedCells.forEach(td => td.classList.add('is-selected'));

    const sel = window.getSelection();
    const range = document.createRange();
    
    range.setStartBefore(selectedCells[0]);
    range.setEndAfter(selectedCells[selectedCells.length - 1]);
    
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // 1. 전역 마우스 다운 (에디터 밖이나 툴바 클릭 대응)
  document.addEventListener('mousedown', (e) => {
    const isInsideEditor = editorEl.contains(e.target);
    const isInsideToolbar = e.target.closest('.sparrow-toolbar');

    // 에디터 밖을 클릭했고, 툴바를 클릭한 것도 아니라면 셀 선택 해제
    if (!isInsideEditor && !isInsideToolbar) {
      clearCellSelection();
    }
  });

  // 2. 에디터 내부 마우스 다운
  editorEl.addEventListener('mousedown', (e) => {
    const td = e.target.closest('.se-table-cell');
    
    // 클릭한 곳이 TD가 아니거나, Shift 없이 클릭했다면 일단 기존 선택 초기화
    if (!td || !e.shiftKey) {
      clearCellSelection();
    }

    if (td) {
      isDragging = true;
      startTD = td;
    }
  });

  // 3. 드래그 중 (이동)
  editorEl.addEventListener('mousemove', (e) => {
    if (!isDragging || !startTD) return;

    const currentTD = e.target.closest('.se-table-cell');
    const startTable = startTD.closest('.se-table');
    
    if (!startTable) return;

    const isOverTable = startTable.contains(e.target);

    if (isOverTable) {
      if (currentTD && currentTD !== startTD) {
        // 다중 셀 범위 선택
        const cells = Array.from(startTable.querySelectorAll('.se-table-cell'));
        const startIndex = cells.indexOf(startTD);
        const endIndex = cells.indexOf(currentTD);
        const rangeIndices = [startIndex, endIndex].sort((a, b) => a - b);
        
        const selectedCells = cells.slice(rangeIndices[0], rangeIndices[1] + 1);
        applyVisualAndRangeSelection(selectedCells);
      } else if (!currentTD) {
        // 테이블 내부 여백/경계 드래그 시 테이블 전체 선택
        const allCells = Array.from(startTable.querySelectorAll('.se-table-cell'));
        applyVisualAndRangeSelection(allCells);
      }
    } else {
      // 테이블 영역 밖으로 나갈 시 테이블 전체 선택 유지
      const allCells = Array.from(startTable.querySelectorAll('.se-table-cell'));
      applyVisualAndRangeSelection(allCells);
    }
  });

  // 4. 드래그 종료
  window.addEventListener('mouseup', () => {
    if (isDragging) {
      const result = selectionService.analyzeSelection();
      uiService.updateUI(result);
    }
    isDragging = false;
    startTD = null;
  });

  // ---------------------------------------------------------
  // 🚫 브라우저 기본 동작 차단 및 감지
  // ---------------------------------------------------------
  
  editorEl.addEventListener('dragstart', (e) => e.preventDefault());
  editorEl.addEventListener('drop', (e) => e.preventDefault());

  document.addEventListener('selectionchange', () => {
    if (isDragging) return;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    if (editorEl.contains(range.startContainer)) {
      const result = selectionService.analyzeSelection();
      uiService.updateUI(result);
    } else {
      // 에디터 외부를 클릭했을 때 UI 초기화 (셀 선택이 해제된 경우)
      if (document.querySelectorAll('.se-table-cell.is-selected').length === 0) {
        uiService.clearAll();
      }
    }
  });

  return {
    analyzeNow: () => {
      const result = selectionService.analyzeSelection();
      uiService.updateUI(result);
      return result;
    },
    clearTableSelection: clearCellSelection
  };
}
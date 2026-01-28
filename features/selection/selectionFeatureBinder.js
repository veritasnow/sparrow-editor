import { createSelectionAnalyzeService } from './selectionAnalyzeService.js';
import { createSelectionUIService } from './selectionUiService.js';

export function bindSelectionFeature(stateAPI, uiAPI, editorEl, toolbarElements) {
  const selectionService = createSelectionAnalyzeService(stateAPI, uiAPI);
  const uiService = createSelectionUIService(toolbarElements);

  let isDragging = false;
  let startTD = null;
  let rafId = null;

  const scheduleUpdate = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const result = selectionService.analyzeSelection();
      uiService.updateUI(result);
    });
  };

  // 2. 선택 해제 시 is-not-selected 클래스도 함께 제거하도록 수정
  const clearCellSelection = () => {
    editorEl.querySelectorAll('.se-table-cell').forEach(td => {
      td.classList.remove('is-selected', 'is-not-selected');
    });
  };

  // 1. 드래그 시 선택된 셀 외에 is-not-selected 추가하는 로직
  function applyVisualAndRangeSelection(selectedCells) {
    if (selectedCells.length === 0) return;

    // 현재 드래그 중인 테이블 내의 모든 셀을 가져옴
    const table = selectedCells[0].closest('.se-table');
    if (!table) return;

    const allCellsInTable = table.querySelectorAll('.se-table-cell');

    allCellsInTable.forEach(td => {
      if (selectedCells.includes(td)) {
        td.classList.add('is-selected');
        td.classList.remove('is-not-selected');
      } else {
        td.classList.remove('is-selected');
        td.classList.add('is-not-selected'); // 선택되지 않은 셀에 클래스 부여
      }
    });

    const sel = window.getSelection();
    const range = document.createRange();
    range.setStartBefore(selectedCells[0]);
    range.setEndAfter(selectedCells[selectedCells.length - 1]);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // [이하 이벤트 리스너 로직은 동일하게 유지됩니다]
  
  document.addEventListener('mousedown', (e) => {
    const isInsideEditor = editorEl.contains(e.target);
    const isInsideToolbar = e.target.closest('.sparrow-toolbar');
    if (!isInsideEditor && !isInsideToolbar) {
      clearCellSelection();
    }
  });

  editorEl.addEventListener('mousedown', (e) => {
    const td = e.target.closest('.se-table-cell');
    if (!td || !e.shiftKey) {
      clearCellSelection();
    }
    if (td) {
      isDragging = true;
      startTD = td;
    }
  });

  editorEl.addEventListener('mousemove', (e) => {
    if (!isDragging || !startTD) return;
    const currentTD = e.target.closest('.se-table-cell');
    const startTable = startTD.closest('.se-table');
    if (!startTable) return;

    if (startTable.contains(e.target)) {
      if (currentTD && currentTD !== startTD) {
        const cells = Array.from(startTable.querySelectorAll('.se-table-cell'));
        const startIndex = cells.indexOf(startTD);
        const endIndex = cells.indexOf(currentTD);
        const rangeIndices = [startIndex, endIndex].sort((a, b) => a - b);
        const selectedCells = cells.slice(rangeIndices[0], rangeIndices[1] + 1);
        applyVisualAndRangeSelection(selectedCells);
      } else if (!currentTD) {
        const allCells = Array.from(startTable.querySelectorAll('.se-table-cell'));
        applyVisualAndRangeSelection(allCells);
      }
    } else {
      const allCells = Array.from(startTable.querySelectorAll('.se-table-cell'));
      applyVisualAndRangeSelection(allCells);
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      scheduleUpdate();
    }
    isDragging = false;
    startTD = null;
  });

  editorEl.addEventListener('dragstart', (e) => e.preventDefault());
  editorEl.addEventListener('drop', (e) => e.preventDefault());

  document.addEventListener('selectionchange', () => {
    if (isDragging) return;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);

    if (editorEl.contains(range.startContainer)) {
      const containerCell = range.commonAncestorContainer.nodeType === 3 
        ? range.commonAncestorContainer.parentElement.closest('.se-table-cell')
        : range.commonAncestorContainer.closest?.('.se-table-cell');

      if (!containerCell) {
        const allTDs = editorEl.querySelectorAll('.se-table-cell');
        let hasCellInRange = false;

        for(let td of allTDs) {
          if (sel.containsNode(td, true)) {
            hasCellInRange = true;
            break;
          }
        }

        if (hasCellInRange) {
          allTDs.forEach(td => {
            if (sel.containsNode(td, true)) {
              td.classList.add('is-selected');
              td.classList.remove('is-not-selected');
            } else {
              td.classList.remove('is-selected');
              td.classList.add('is-not-selected');
            }
          });
        }
      }
      scheduleUpdate();
    } else {
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
import { createSelectionAnalyzeService } from './selectionAnalyzeService.js';
import { createSelectionUIService } from './selectionUiService.js';

export function bindSelectionFeature(stateAPI, uiAPI, editorEl, toolbarElements) {
  const selectionService = createSelectionAnalyzeService(stateAPI, uiAPI);
  const uiService         = createSelectionUIService(toolbarElements);

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

  // 1. 전역 마우스 다운
  document.addEventListener('mousedown', (e) => {
    const isInsideEditor = editorEl.contains(e.target);
    const isInsideToolbar = e.target.closest('.sparrow-toolbar');
    if (!isInsideEditor && !isInsideToolbar) {
      clearCellSelection();
    }
  });

  // 2. 에디터 내부 마우스 다운
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

  // 3. 드래그 중
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

  // 4. 드래그 종료
  window.addEventListener('mouseup', () => {
    if (isDragging) {
      const result = selectionService.analyzeSelection();
      uiService.updateUI(result);
    }
    isDragging = false;
    startTD = null;
  });

  editorEl.addEventListener('dragstart', (e) => e.preventDefault());
  editorEl.addEventListener('drop', (e) => e.preventDefault());

  // 5. 선택 변경 감지 (스타일 유지 + 메인 드래그 지원)
  document.addEventListener('selectionchange', () => {
    if (isDragging) return;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);

    if (editorEl.contains(range.startContainer)) {
      // [개선 핵심]
      // 1. 현재 텍스트 선택이 셀 하나 내부에서만 일어나는지 확인
      const containerCell = range.commonAncestorContainer.nodeType === 3 
        ? range.commonAncestorContainer.parentElement.closest('.se-table-cell')
        : range.commonAncestorContainer.closest?.('.se-table-cell');

      if (containerCell) {
        // 셀 내부 텍스트 선택 중이라면 클래스를 건드리지 않음 (스타일 변경 시 클래스 보존)
        // 단, 이미 선택된 다른 셀이 있다면 그건 유지함
      } else {
        // 2. 메인 영역 드래그 중인 경우 (셀 덩어리가 선택 범위에 들어왔을 때만 클래스 입힘)
        const frag = range.cloneContents();
        if (frag.querySelector('.se-table-cell')) {
          const allTDs = editorEl.querySelectorAll('.se-table-cell');
          allTDs.forEach(td => {
            if (sel.containsNode(td, true)) {
              td.classList.add('is-selected');
            } else {
              td.classList.remove('is-selected');
            }
          });
        }
      }

      // 공통: 툴바 UI 업데이트
      const result = selectionService.analyzeSelection();
      uiService.updateUI(result);
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
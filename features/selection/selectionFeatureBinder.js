import { createSelectionAnalyzeService } from './selectionAnalyzeService.js';
import { createSelectionUIService } from './selectionUiService.js';

export function bindSelectionFeature(stateAPI, uiAPI, editorEl, toolbarElements) {
  const selectionService = createSelectionAnalyzeService(stateAPI, uiAPI);
  const uiService = createSelectionUIService(toolbarElements);

  let isDragging = false;
  let startTD = null;
  let rafId = null; // 성능 최적화용

  // [성능 보완] 분석 로직을 브라우저 프레임에 맞춰 조절
  const scheduleUpdate = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const result = selectionService.analyzeSelection();
      uiService.updateUI(result);
    });
  };

  const clearCellSelection = () => {
    editorEl.querySelectorAll('.se-table-cell.is-selected').forEach(td => {
      td.classList.remove('is-selected');
    });
  };

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
      scheduleUpdate();
    }
    isDragging = false;
    startTD = null;
  });

  editorEl.addEventListener('dragstart', (e) => e.preventDefault());
  editorEl.addEventListener('drop', (e) => e.preventDefault());

  // 5. 선택 변경 감지 (기존 정확도 로직 유지 + 성능 보완)
  document.addEventListener('selectionchange', () => {
    if (isDragging) return;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);

    if (editorEl.contains(range.startContainer)) {
      // [작성하신 정확도 로직 그대로 유지]
      const containerCell = range.commonAncestorContainer.nodeType === 3 
        ? range.commonAncestorContainer.parentElement.closest('.se-table-cell')
        : range.commonAncestorContainer.closest?.('.se-table-cell');

      if (!containerCell) {
        // [성능 보완] cloneContents() 대신 containsNode를 사용하여 
        // 하위 셀이 선택 영역에 포함되었는지 훨씬 가볍게 체크합니다.
        const allTDs = editorEl.querySelectorAll('.se-table-cell');
        let hasCellInRange = false;

        // 먼저 전체 영역에 셀이 하나라도 걸쳐있는지 빠르게 확인
        for(let td of allTDs) {
          if (sel.containsNode(td, true)) {
            hasCellInRange = true;
            break;
          }
        }

        // 셀이 걸쳐있다면 클래스 부여/해제 로직 실행
        if (hasCellInRange) {
          allTDs.forEach(td => {
            if (sel.containsNode(td, true)) {
              td.classList.add('is-selected');
            } else {
              td.classList.remove('is-selected');
            }
          });
        }
      }

      // [성능 보완] 분석 실행 시 RAF 적용
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
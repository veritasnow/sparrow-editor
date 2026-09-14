/**
 * 툴바 위치 업데이트 함수 (셀 기준)
 * @param {HTMLElement} rootEl - 에디터 컨테이너
 * @param {HTMLElement} cellEl - 클릭된 TD 요소
 * @param {HTMLElement} cellToolbar - 툴바 요소
 */
/**
 * 툴바 위치 업데이트 함수 (반응형 대응 및 화면 이탈 방지)
 * @param {HTMLElement} rootEl - 에디터 컨테이너
 * @param {HTMLElement} cellEl - 클릭된 TD 요소
 * @param {HTMLElement} cellToolbar - 툴바 요소
 */
export function showTableCellToolbar (rootEl, cellEl, cellToolbar) {
    // 1. 위치 계산을 위한 기본 좌표 획득
    const rect     = cellEl.getBoundingClientRect();
    const rootRect = rootEl.getBoundingClientRect();
    
    // 툴바를 먼저 보이게 해야 offsetWidth/Height 계산이 가능합니다.
    cellToolbar.style.display = "flex";
    cellToolbar.classList.add("active");

    // 툴바의 실제 크기 측정 (CSS가 적용된 후의 크기)
    const toolbarWidth  = cellToolbar.offsetWidth;
    const toolbarHeight = cellToolbar.offsetHeight;

    // 2. 기본 위치 설정 (셀의 중앙 상단)
    // top: 셀 상단 - 툴바 높이 - 화살표 여백(약 10px)
    let top  = (rect.top - rootRect.top) + rootEl.scrollTop - toolbarHeight + 10;
    
    // left: 셀의 왼쪽 끝 기준
    let left = (rect.left - rootRect.left) + rootEl.scrollLeft;

    // ----------------------------------------------------
    // 🔥 [반응형 보정 1] 상단 공간 부족 시 셀 아래로 배치
    // ----------------------------------------------------
    if (top < rootEl.scrollTop) {
        // 셀 아래쪽으로 위치 변경
        top = (rect.bottom - rootRect.top) + rootEl.scrollTop + 10;
        cellToolbar.classList.add("is-bottom"); // 화살표 방향 변경용 클래스
    } else {
        cellToolbar.classList.remove("is-bottom");
    }

    // ----------------------------------------------------
    // 🔥 [반응형 보정 2] 오른쪽 화면 이탈 방지
    // ----------------------------------------------------
    const maxLeft = rootRect.width - toolbarWidth - 10; // 오른쪽 여백 10px 확보
    if (left > maxLeft) {
        left = maxLeft;
    }

    // ----------------------------------------------------
    // 🔥 [반응형 보정 3] 왼쪽 화면 이탈 방지
    // ----------------------------------------------------
    if (left < 10) {
        left = 10;
    }

    // 최종 좌표 적용
    cellToolbar.style.top  = `${top}px`;
    cellToolbar.style.left = `${left}px`;

    // 3. 데이터 저장 (기존 로직 유지)
    const tableEl = cellEl.closest("table");
    cellToolbar.dataset.targetTableId = tableEl ? tableEl.id : "";
    cellToolbar.dataset.targetRow     = cellEl.dataset.row || "";
    cellToolbar.dataset.targetCol     = cellEl.dataset.col || "";
    cellToolbar.dataset.targetCellId  = cellEl.id || "";
};
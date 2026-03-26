export function createTableCellToolbarView(rootEl, actionHandlers) {
    let toolbar = rootEl.querySelector(".sparrow-table-toolbar");
    if (toolbar) return toolbar;

    toolbar = document.createElement("div");
    toolbar.className      = "sparrow-table-toolbar";
    toolbar.style.position = "absolute";
    toolbar.style.display  = "none";
    toolbar.style.zIndex   = "9999";

    const menuItems = [
        { title: "아래에 행 추가", action: "add-row", icon: "⊞↓" },
        { title: "오른쪽에 열 추가", action: "add-col", icon: "⊞→" },
        { title: "셀 병합", action: "merge", icon: "⊞+⊞" },
        // 삭제 관련 아이콘 개선
        { title: "행 삭제", action: "delete-row", icon: "▤⊖" }, // 가로줄(행)을 뺀다
        { title: "열 삭제", action: "delete-col", icon: "▥⊖" }, // 세로줄(열)을 뺀다
        { title: "테이블 삭제", action: "delete", icon: "⊞x" }
    ];

    menuItems.forEach(item => {
        const btn = document.createElement("button");
        btn.type           = "button";
        btn.className      = "table-tool-btn";
        btn.title          = item.title;
        btn.dataset.action = item.action;

        const icon       = document.createElement("span");
        icon.className   = "table-icon";
        icon.textContent = item.icon; // 🔥 핵심: 실제 문자 아이콘

        btn.appendChild(icon);

        // 🔥 핵심: 서비스 주입 기반 이벤트 연결
        btn.addEventListener("click", (e) => {
            e.stopPropagation();

            const handler = actionHandlers[item.action];
            if (typeof handler !== "function") return;

            const tableId = toolbar.dataset.targetTableId;
            console.log("tableId : ", tableId);

            // 🔥 여기만 수정하면 에러 100% 해결
            const tableEl = tableId
                ? document.getElementById(tableId)
                : null;

            handler({
                action  : item.action,
                toolbar,
                rootEl,
                tableId,
                tableEl,
                event   : e
            });
        });
        toolbar.appendChild(btn);
    });

    rootEl.appendChild(toolbar);
    return toolbar;
}

/**
 * 툴바 위치 업데이트 함수 (셀 기준)
 * @param {HTMLElement} rootEl - 에디터 컨테이너
 * @param {HTMLElement} cellEl - 클릭된 TD 요소
 * @param {HTMLElement} cellToolbar - 툴바 요소
 */
export const showToolbar = (rootEl, cellEl, cellToolbar) => {
    // 1. 셀과 루트(에디터)의 절대 위치 정보를 가져옵니다.
    const rect = cellEl.getBoundingClientRect();
    const rootRect = rootEl.getBoundingClientRect();

    cellToolbar.classList.add("active");
    cellToolbar.style.display = "block"; // 숨겨져 있을 수 있으므로 명시

    // 2. 위치 계산식
    // top: 셀의 top - 루트의 top + 에디터 스크롤 - 툴바 높이(약 38px)
    // left: 셀의 left - 루트의 left + 에디터 스크롤
    const top = (rect.top - rootRect.top) + rootEl.scrollTop - 40; // 여백을 위해 40px 정도로 조정
    const left = (rect.left - rootRect.left) + rootEl.scrollLeft;

    cellToolbar.style.top = `${top}px`;
    cellToolbar.style.left = `${left}px`;

    console.log("toptop : ", top);
    console.log("leftleft : ", left);

    // 3. (중요) 행/열 삭제 시 어떤 셀을 기준으로 할지 알기 위해 데이터 저장
    const tableEl = cellEl.closest("table");
    cellToolbar.dataset.targetTableId = tableEl ? tableEl.id : "";
    cellToolbar.dataset.targetRow = cellEl.dataset.row;
    cellToolbar.dataset.targetCol = cellEl.dataset.col;
    cellToolbar.dataset.targetCellId = cellEl.id;
};
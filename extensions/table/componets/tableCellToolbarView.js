export function createTableCellToolbarView(rootEl, actionHandlers) {
    let toolbar = rootEl.querySelector(".sparrow-table-toolbar");
    if (toolbar) return toolbar;

    toolbar = document.createElement("div");
    toolbar.className      = "sparrow-table-toolbar";
    toolbar.style.position = "absolute";
    toolbar.style.display  = "none";
    toolbar.style.zIndex   = "9999";

    const menuItems = [
        { title: "아래에 행 추가", action: "add-row", icon: "▦+" },
        { title: "오른쪽에 열 추가", action: "add-col", icon: "+▦" },
        { title: "셀 병합", action: "merge", icon: "◫+◫" }, // ← 여기만 변경
        { title: "테이블 삭제", action: "delete", icon: "×" }
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
            const tableEl = tableId
                ? rootEl.querySelector(`#${tableId}`)
                : null;

            handler({
                action   : item.action,
                toolbar,
                rootEl,
                tableId,   // ⭐ 중요
                tableEl,   // ⭐ 서비스에서 바로 사용 가능
                event    : e
            });
        });
        toolbar.appendChild(btn);
    });

    rootEl.appendChild(toolbar);
    return toolbar;
}

/**
 * 툴바 위치 업데이트 함수
 */
export const showToolbar = (rootEl, tableEl, cellToolbar) => {
    const rect     = tableEl.getBoundingClientRect();
    const rootRect = rootEl.getBoundingClientRect();

    cellToolbar.classList.add("active");
    
    // 계산식: (현재 테이블의 화면상 top - 에디터의 화면상 top) + 에디터의 스크롤 위치
    const top  = (rect.top - rootRect.top) + rootEl.scrollTop - 38;
    const left = (rect.left - rootRect.left) + rootEl.scrollLeft;

    cellToolbar.style.top             = `${top}px`; 
    cellToolbar.style.left            = `${left}px`;
    cellToolbar.dataset.targetTableId = tableEl.id;
};
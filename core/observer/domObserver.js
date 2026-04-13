// domObserver.js
export function createDomObserver(targetElement, { onTableAdded }) {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // 1. 추가된 노드 검사 (기존 로직 유지)
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType !== 1) return; // Element 노드만 처리
                const tables = node.classList.contains('chunk-table') ? [node] : node.querySelectorAll('.chunk-table');
                tables.forEach(table => onTableAdded(table));
            });

            // 2. 변경된 노드 검사 (target이 텍스트 노드일 경우 처리)
            // mutation.target이 텍스트 노드(nodeType 3)라면, 
            // closest를 호출하기 위해 parentElement를 사용합니다.
            let target = mutation.target;
            if (target.nodeType !== 1) { 
                target = target.parentElement;
            }

            if (target) {
                const targetTable = target.closest('.chunk-table');
                if (targetTable) {
                    onTableAdded(targetTable);
                }
            }
        });
    });

    observer.observe(targetElement, { 
        childList: true, 
        subtree: true,
        characterData: true,
        characterDataOldValue: true // 성능상 필요 없으면 제거 가능
    });
    return () => observer.disconnect();
}
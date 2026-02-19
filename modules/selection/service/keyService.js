/**
 * 활성 컨테이너(ID) 추출 및 분석 서비스
 */
export function createKeyService(root) {
    
    /**
     * 1. 실제로 콘텐츠가 선택된 모든 컨테이너 ID 반환
     */ 
    function syncActiveKeys(lastActiveKey) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return [lastActiveKey].filter(Boolean);

        const range = sel.getRangeAt(0);
        const searchRoot = root || document.body;

        // 1. 시각적으로 선택된(is-selected) 아이디 수집
        const visualSelectedNodes = document.getElementsByClassName('se-table-cell is-selected');
        const visualSelectedIds = [];
        for (let i = 0; i < visualSelectedNodes.length; i++) {
            const id = visualSelectedNodes[i].getAttribute('data-container-id');
            if (id) visualSelectedIds.push(id);
        }

        // 2. 전체 컨테이너 중 선택 영역에 걸쳐 있는 것들 수집
        const allPossibleContainers = Array.from(searchRoot.querySelectorAll('[data-container-id]'));
        if (searchRoot.hasAttribute('data-container-id')) allPossibleContainers.push(searchRoot);

        const intersecting = allPossibleContainers.filter(container => 
            sel.containsNode(container, true)
        );

        // 3. 중첩 구조 분석 및 'is-not-selected' 필터링
        const logicalActiveIds = intersecting.filter(c1 => {
            // 🔥 [핵심] 제외 클래스가 붙어 있다면 시스템은 이를 무시함
            if (c1.classList.contains('is-not-selected')) return false;

            const subContainers = intersecting.filter(c2 => c1 !== c2 && c1.contains(c2));
            
            // 하위 컨테이너가 없다면 (Leaf 노드) 선택된 것으로 간주
            if (subContainers.length === 0) return true;

            // 하위 컨테이너가 있다면, '순수하게 c1에만 속한 텍스트'가 선택되었는지 검사
            const isStartInSelf = c1.contains(range.startContainer) && 
                !subContainers.some(sub => sub.contains(range.startContainer));
            
            const isEndInSelf = c1.contains(range.endContainer) && 
                !subContainers.some(sub => sub.contains(range.endContainer));

            if (isStartInSelf || isEndInSelf) return true;

            // TreeWalker를 이용해 하위 컨테이너에 속하지 않은 직접 텍스트 노드가 선택되었는지 확인
            const walker = document.createTreeWalker(c1, NodeFilter.SHOW_TEXT);
            let node;
            while (node = walker.nextNode()) {
                const isDirectText = !subContainers.some(sub => sub.contains(node));
                if (isDirectText && sel.containsNode(node, true)) return true;
            }
            return false;
        }).map(container => container.getAttribute('data-container-id'));

        // 4. 결과 병합 (중복 제거)
        const combinedIds = Array.from(new Set([...visualSelectedIds, ...logicalActiveIds]));

        if (combinedIds.length > 0) {
            lastActiveKey = combinedIds[combinedIds.length - 1];
            return combinedIds;
        }
        
        // 선택 영역이 없을 경우 마지막 활성 키 반환
        return [lastActiveKey].filter(Boolean);
    }

    function findParentContainerId(containerId) {
        const currentEl = document.getElementById(containerId);
        if (!currentEl) return null;
        const parentContainer = currentEl.parentElement?.closest('[data-container-id]');
        return parentContainer ? parentContainer.getAttribute('data-container-id') : null;
    }    

    return { syncActiveKeys, findParentContainerId };
}
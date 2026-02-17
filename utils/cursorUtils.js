// sparrow-editor/utils/cursorUtils.js

/**
 * 에디터의 다양한 위치 정보를 시스템 표준 커서 복원 포맷으로 정규화합니다.
 */
export function normalizeCursorData(restoreData, defaultContainerId) {
    if (!restoreData) return null;

    // 1. 다중 라인 블록 선택 영역인 경우 (배열로 들어옴)
    if (Array.isArray(restoreData)) {
        const container = document.getElementById(defaultContainerId);
        
        return {
            containerId: defaultContainerId,
            isSelection: true,
            source: 'dom',
            ranges: restoreData.map(r => {
                let isTableLine = false;
                if (container) {
                    // 🔥 [핵심 수정] :scope > 를 사용하여 현재 컨테이너의 직계 라인만 확인
                    const lineEl = container.querySelector(`:scope > [data-line-index="${r.lineIndex}"]`);
                    
                    if (lineEl) {
                        // 라인 자체가 테이블이거나, '직계' 자식으로 테이블을 가지고 있는지 확인
                        const isTable = lineEl.matches('.se-table') || lineEl.querySelector(':scope > .se-table');
                        if (isTable) {
                            isTableLine = true;
                        }
                    }
                }

                return {
                    lineIndex: r.lineIndex,
                    startIndex: r.startIndex,
                    endIndex: r.endIndex,
                    selectedLength: r.endIndex - r.startIndex,
                    isTableLine: isTableLine
                };
            })
        };
    }

    // 2. 단일 커서 위치인 경우 (객체로 들어옴)
    const containerId = restoreData.containerId || defaultContainerId;
    const lineIndex   = restoreData.lineIndex;
    const anchor      = restoreData.anchor || restoreData;

    return {
        containerId,
        lineIndex,
        isSelection: false,
        anchor: {
            chunkIndex: anchor.chunkIndex ?? 0,
            type: anchor.type || 'text',
            offset: anchor.offset ?? 0,
            detail: anchor.detail || null
        }
    };
}
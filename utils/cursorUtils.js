// sparrow-editor/utils/cursorUtils.js

/**
 * 에디터의 다양한 위치 정보(평면 구조 또는 anchor 구조)를 
 * 시스템 표준 커서 복원 포맷으로 정규화합니다.
 * * @param {Object} restoreData - 원본 위치 데이터
 * @param {string} defaultContainerId - 데이터에 ID가 없을 경우 사용할 기본 컨테이너 ID
 */
export function normalizeCursorData(restoreData, defaultContainerId) {
    if (!restoreData) return null;

    console.log("restoreData : ", restoreData);
    console.log("defaultContainerId : ", defaultContainerId);
    // 1. 다중 라인 블록 선택 영역인 경우 (배열로 들어옴)
    if (Array.isArray(restoreData)) {
        // containerId(셀)를 찾아서 실제 라인 엘리먼트들을 가져옵니다.
        const container = document.getElementById(defaultContainerId);
        
        return {
            containerId: defaultContainerId,
            isSelection: true,
            source: 'dom',
            ranges: restoreData.map(r => {
                // 해당 라인이 테이블을 포함하고 있는지 체크
                let isTableLine = false;
                if (container) {
                    const lineEl = container.querySelector(`[data-line-index="${r.lineIndex}"]`);
                    if (lineEl) {
                        const isTable = lineEl.matches('.se-table') || lineEl.querySelector('.se-table');
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
                    isTableLine: isTableLine // ✅ 타입 정보 추가
                };
            })
        };
    }

    // 2. 단일 커서 위치인 경우 (객체로 들어옴)
    const containerId = restoreData.containerId || defaultContainerId;
    const lineIndex = restoreData.lineIndex;
    const anchor = restoreData.anchor || restoreData; // 구조 유연성 대응

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
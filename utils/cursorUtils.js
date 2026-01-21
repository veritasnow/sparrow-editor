// sparrow-editor/utils/cursorUtils.js

/**
 * 에디터의 다양한 위치 정보(평면 구조 또는 anchor 구조)를 
 * 시스템 표준 커서 복원 포맷으로 정규화합니다.
 * * @param {Object} restoreData - 원본 위치 데이터
 * @param {string} defaultContainerId - 데이터에 ID가 없을 경우 사용할 기본 컨테이너 ID
 */
export function normalizeCursorData(restoreData, defaultContainerId) {
    if (!restoreData) return null;

    // 1. 다중 라인 블록 선택 영역인 경우 (배열로 들어옴)
    if (Array.isArray(restoreData)) {
        return {
            containerId: defaultContainerId,
            isSelection: true,
            source: 'dom', // ✅ 추가
            ranges: restoreData.map(r => ({
                lineIndex: r.lineIndex,
                startIndex: r.startIndex,
                endIndex: r.endIndex
            }))
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
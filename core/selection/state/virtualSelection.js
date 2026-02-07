export const virtualSelection = {
    isActive    : false,      // 드래그 중 여부
    isBackwards : false,   // 역방향 드래그 여부

    // 드래그가 시작된 지점의 '맥락'을 고정합니다.
    anchor: {
        containerId : "myEditor-content", // 루트 또는 특정 td의 ID
        lineIndex   : 0,                    // 해당 컨테이너 내에서의 줄 번호
        offset      : 0,                       // 글자 수 기준 오프셋
        type        : 'text',                    // 'text' | 'table' | 'image'
        path        : []                         // [Optional] 중첩 구조 추적용 계층 정보
    },

    // 현재 마우스가 머물고 있는 지점 (실시간 업데이트)
    focus: {
        containerId : "myEditor-content",
        lineIndex   : 0,
        offset      : 0,
        type        : 'text'
    },

    // [중요] 가상 스크롤에서 '실제로 렌더링해야 할' 줄 범위 (Index 기반)
    // 이 범위가 DOM에 그려지도록 명령을 내리는 기준이 됩니다.
    renderRange: {
        start: 0,
        end  : 0
    }
};
// utils/rangeUtils.js
import { getLineLengthFromState } from "./editorStateUtils.js"; // 경로가 맞다고 가정

/**
 * DOM Selection Range (lineIndex, startIndex, endIndex)를 
 * 현재 에디터 상태(currentState)를 기반으로 검증 및 보정한 
 * 순수 상태 Range 객체 배열로 변환합니다.
 * * @param {Array<Object>} currentState - 에디터 상태 배열
 * @param {Array<Object>} domRanges - DOM에서 읽어온 선택 범위 (lineIndex, startIndex, endIndex 포함)
 * @returns {Array<Object>} 보정된 순수 상태 기반의 Range 객체 배열
 */
export function getRanges(currentState, domRanges, currentPos = null) {
    return domRanges.map(domRange => {
        const lineState = currentState[domRange.lineIndex];
        const lineLen = getLineLengthFromState(lineState);

        let startIndex = domRange.startIndex;
        let endIndex = domRange.endIndex;

        // ✨ 테이블 정밀 보정 로직 추가
        if (currentPos && currentPos.anchor.type === 'table') {
            // 브라우저가 준 0, 1 같은 값 대신, 
            // 우리가 Selection API(window.getSelection())를 통해 직접 계산한 상세 위치를 사용합니다.
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                // 테이블 안에서는 startIndex와 endIndex를 셀 내부의 offset으로 덮어씁니다.
                startIndex = range.startOffset; 
                endIndex = range.endOffset;
            }
        }

        return {
            lineIndex: domRange.lineIndex,
            startIndex: Math.max(0, startIndex),
            endIndex: Math.max(0, endIndex),
            detail: currentPos && currentPos.anchor.type === 'table' ? {
                ...currentPos.anchor.detail,
                cellOffset: startIndex // applyStylePatch에서 쓸 시작점
            } : null
        };
    });
}

/*
export function getRanges(currentState, domRanges) {
    return domRanges.map(domRange => {
        const lineState = currentState[domRange.lineIndex];
        const lineLen = getLineLengthFromState(lineState); // 상태 기반의 실제 라인 길이

        // startIndex와 endIndex를 0과 lineLen 사이로 보정
        return {
            lineIndex: domRange.lineIndex,
            // Math.max(0, ...) : 시작점이 0보다 작아지지 않도록 보정
            // Math.min(..., lineLen) : 시작점/끝점이 라인 길이보다 커지지 않도록 보정 (이탈 방지)
            startIndex: Math.max(0, Math.min(domRange.startIndex, lineLen)),
            endIndex: Math.max(0, Math.min(domRange.endIndex, lineLen))
        };
    });
}
*/
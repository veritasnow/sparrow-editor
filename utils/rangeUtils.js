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
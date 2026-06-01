// /core/keyInput/services/backspace/backspaceGuardService.js
export function shouldPreventDeletion(activeKey, firstDomRange, isSelection, e) {
    if (isSelection) return false;

    const activeContainer = document.getElementById(activeKey);
    const isCell          = activeContainer?.tagName === 'TD' || activeContainer?.tagName === 'TH';
    
    // 테이블 셀 내부의 맨 첫 칸(0행 0열)에서 밖으로 나가는 삭제 방지
    if (isCell && firstDomRange.lineIndex === 0 && firstDomRange.endIndex === 0) {
        e.preventDefault();
        return true;
    }
    return false;
}
// /core/keyInput/services/common/shouldPreventDeletion.js

import { getLineLengthFromState } from '../../../../../utils/editorStateUtils.js';

export function shouldPreventDeletion(
    currentState,
    activeKey,
    firstDomRange,
    isSelection,
    direction,
    e
) {
    if (isSelection) return false;

    const { lineIndex, startIndex: offset } = firstDomRange;

    const activeContainer = document.getElementById(activeKey);

    const isCell = activeContainer?.tagName === 'TD' || activeContainer?.tagName === 'TH';

    if (!isCell) {
        return false;
    }

    // Backspace
    if (direction === 'backspace') {
        const isFirstPosition = lineIndex === 0 && offset === 0;
        if (isFirstPosition) {
            e.preventDefault();
            return true;
        }
    }

    // Delete
    if (direction === 'delete') {

        const currentLine    = currentState[lineIndex];
        const lineLen        = getLineLengthFromState(currentLine);
        const isLastPosition = lineIndex === currentState.length - 1 && offset === lineLen;

        if (isLastPosition) {
            e.preventDefault();
            return true;
        }
    }

    return false;
}
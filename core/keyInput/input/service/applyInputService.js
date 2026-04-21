// /core/input/service/applyInputService.js
import { normalizeCursorData } from '../../../../utils/cursorUtils.js';

export function applyInputState({
    stateAPI,
    key,
    lineIndex,
    updatedLine,
    restoreData,
    skipHistory
}) {
    const currentState = stateAPI.get(key);
    const nextState    = [...currentState];

    nextState[lineIndex] = updatedLine;

    stateAPI.save(key, nextState, {
        saveHistory: skipHistory
    });

    const normalized = normalizeCursorData(restoreData, key);
    if (normalized) {
        stateAPI.saveCursor(normalized);
    }
}
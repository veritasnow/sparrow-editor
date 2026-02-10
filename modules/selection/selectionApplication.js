import { createKeyService } from "./service/keyService.js";
import { createRangeService } from "./service/rangeService.js";
import { createRestoreCursorService } from "./service/restoreCursorService.js";


export function createSelectionApplication({ root }) {
    let lastValidPos    = null;
    let lastActiveKey   = null;
    let cacheActiveKeys = null;

    // 외부 서비스 주입
    const keyService     = createKeyService(root);
    const rangeService   = createRangeService(root);

    function getActiveKeys() {
        return cacheActiveKeys;
    }

    function refreshActiveKeys() {
        cacheActiveKeys = keyService.syncActiveKeys(lastActiveKey);
    }

    function ensureActiveKeys() {
        if (cacheActiveKeys === null) {
            refreshActiveKeys();
        }
        return cacheActiveKeys || [];
    }

    function getActiveKey() {
        const keys = ensureActiveKeys();
        return keys.length > 0 ? keys[keys.length - 1] : lastActiveKey;
    }

    function getActiveContainer() {
        const activeKey = ensureActiveKeys();
        return (activeKey ? document.getElementById(activeKey) : null) || root;
    }

    function getDomSelection(targetKey) {
        return rangeService.getDomSelection(targetKey, getActiveKey());
    }

    function getSelectionContext() {
        return rangeService.getSelectionContext(getActiveContainer());
    }

    function getSelectionPosition() {
        const context = getSelectionContext(); 
        if (!context) return null;
        return rangeService.getSelectionPosition(context);
    }

    function getInsertionAbsolutePosition() {
        const context = getSelectionContext();
        if (!context) return null;        
        return rangeService.getInsertionAbsolutePosition(context);
    }

    function getSelectionMode() {
        const activeKey = getActiveKey();
        if (!activeKey) {
            return 'none';
        }

        const ranges = getDomSelection(activeKey);
        if (!ranges || ranges.length === 0) {
            return 'none';
        }

        // 1️⃣ 커서만 있는 상태
        if (ranges.length === 1 && ranges[0].startIndex === ranges[0].endIndex) {
            return 'cursor';
        }

        // 2️⃣ 셀(블록) 전체 선택
        const container = document.getElementById(activeKey);
        if (
            container &&
            container.classList.contains('is-selected') &&
            ranges.every(r => r.startIndex === 0)
        ) {
            return 'cell';
        }
        return 'range';
    }

    const restoreService = createRestoreCursorService(getActiveContainer, root);    
    
    return { 
        getActiveKeys,
        getSelectionPosition, 
        refreshActiveKeys,
        getIsRestoring: () => restoreService.getIsRestoring(),
        setIsRestoring: (val) => restoreService.setIsRestoring(val), 
        restoreMultiBlockCursor: (positions) => restoreService.restoreMultiBlockCursor(positions),
        getActiveKey,
        getLastActiveKey: () => lastActiveKey,
        getInsertionAbsolutePosition,
        updateLastValidPosition: () => {
            const context = getSelectionContext(); 
            if (!context) return;

            const pos = rangeService.getSelectionPosition(context);
            if (pos) {
                lastValidPos = { 
                    lineIndex     : pos.lineIndex, 
                    absoluteOffset: rangeService.getInsertionAbsolutePosition(context).absoluteOffset || 0 
                };
                lastActiveKey = pos.containerId;
            }
        },
        getLastValidPosition: () => lastValidPos,
        getSelectionContext, 
        restoreCursor: (cursorData) => restoreService.restoreCursor(cursorData),
        getDomSelection,
        getSelectionMode,
    };
}
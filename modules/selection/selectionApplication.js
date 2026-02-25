import { createKeyService } from "./service/keyService.js";
import { createRangeService } from "./service/rangeService.js";
import { createRestoreCursorService } from "./service/restoreCursorService.js";

export function createSelectionApplication({ rootId }) {
    let lastValidPos      = null;
    let lastActiveKey     = null;
    let cacheActiveKeys   = null;
    let cacheSelectedKeys = null;
    
    const root           = document.getElementById(rootId);
    // 외부 서비스 주입
    const keyService     = createKeyService(root);
    const rangeService   = createRangeService(root);

    function getMainKey() {
        return `${rootId}-content`;
    }

    function getActiveKeys() {
        return cacheActiveKeys;
    }

    /*
    function refreshActiveKeys() {
        cacheActiveKeys = keyService.syncActiveKeys(lastActiveKey);
    }
    */
    function refreshActiveKeys() {
        const prev = cacheActiveKeys;
        cacheActiveKeys = keyService.syncActiveKeys(lastActiveKey);

        // ActiveKey 바뀌면 selected도 같이 갱신 (테이블 드래그 대응 핵심)
        const changed =
            !prev ||
            prev.length !== cacheActiveKeys?.length ||
            prev?.some((k, i) => k !== cacheActiveKeys[i]);

        if (changed) {
            refreshSelectedKeys(); // 🔥 자동 동기화
        }
    }   

    function ensureActiveKeys() {
        if (cacheActiveKeys === null) {
            refreshActiveKeys();
        }
        return cacheActiveKeys || [];
    }

    function setCachedActiveKey(key) {
        cacheActiveKeys = [key];
        refreshSelectedKeys(); // ⭐ 수동 포커스 변경 대응
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

    function getLineIndex(el) {
        return rangeService.getLineIndex(el);
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

    const restoreService = createRestoreCursorService(root);    

    function restoreCursor(cursorData) {
        restoreService.restoreCursor(cursorData, getActiveContainer());
        if(cursorData && cursorData.containerId !== null && cursorData.containerId !== '') {
            setCachedActiveKey(cursorData.containerId);
        }
    }

    function findParentContainerId(containerId) {
        return keyService.findParentContainerId(containerId);
    }

    function getSelectedKeys() {
        return cacheSelectedKeys ? [...cacheSelectedKeys] : [];
    }

    /**
     * ⭐ 핵심: ActiveContainer 기준으로 .is-selected 셀만 추출
     * (tableEl 필요 없음)
     */
    function refreshSelectedKeys() {
        const activeContainer = getActiveContainer();
        if (!activeContainer) {
            return cacheSelectedKeys || [];
        }

        const ids = keyService.getSelectedCellIdsByActive(activeContainer);

        // DOM class가 순간적으로 풀리는 경우 대비 (렌더 직후)
        if (!ids || ids.length === 0) {
            return cacheSelectedKeys || [];
        }

        // 중복 제거 + 안정 캐싱
        const unique = [];
        const seen = new Set();

        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            if (!id || seen.has(id)) continue;
            seen.add(id);
            unique.push(id);
        }

        cacheSelectedKeys = unique;
        return cacheSelectedKeys;
    }    

    function clearSelectedKeys() {
        cacheSelectedKeys = null;
    }    
    
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
        restoreCursor,
        getDomSelection,
        getSelectionMode,
        getMainKey,
        findParentContainerId,
        getLineIndex,
        getSelectedKeys,        // ⭐ 추가 (mergeCells는 이거 써야 함)
    };
}
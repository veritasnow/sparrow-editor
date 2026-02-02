import { createKeyService } from "./service/keyService.js";
import { createRangeService } from "./service/rangeService.js";
import { createRestoreCursorService } from "./service/restoreCursorService.js";


export function createSelectionService({ root }) {
    let lastValidPos  = null;
    let lastActiveKey = null;
    let cacheActiveKeys = null;

    // 외부 서비스 주입
    const keyService     = createKeyService(root);
    const rangeService   = createRangeService(root);
    const restoreService = createRestoreCursorService();    

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

    /**
     * 2. 셀 전체 선택 시 누락 방지 및 중첩 구조 인덱스 보정 포함
     */
    function getDomSelection(targetKey) {
        return rangeService.getDomSelection(targetKey, getActiveKey());
    }

    /**
     * 3. 커서 컨텍스트 추출
     */
    function getSelectionContext() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;

        const range = sel.getRangeAt(0);
        const container = range.startContainer;
        const el = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

        const activeContainer = el.closest('td[id], th[id]') || getActiveContainer();
        if (!activeContainer) return null;

        const parentDom = el.closest('.text-block');
        if (!parentDom || !activeContainer.contains(parentDom)) return null;

        const lineIndex = getLineIndex(parentDom);
        if (lineIndex < 0) return null;

        const rawActiveNode = el.closest('[data-index]');
        const activeNode = rawActiveNode && activeContainer.contains(rawActiveNode) ? rawActiveNode : null;
        const dataIndex = activeNode?.dataset.index !== undefined ? parseInt(activeNode.dataset.index, 10) : null;

        return {
            activeContainer, containerId: activeContainer.id, lineIndex,
            parentDom, container, cursorOffset: range.startOffset,
            activeNode, dataIndex, range
        };
    }

    function getLineIndex(el) {
        if (!el) return -1;
        let index = 0;
        let prev = el.previousElementSibling;
        while (prev) {
            if (prev.classList.contains('text-block')) index++;
            prev = prev.previousElementSibling;
        }
        return index;
    }

    function getSelectionPosition() {
        const context = getSelectionContext(); 
        if (!context) return null;
        return rangeService.getSelectionPosition(context);
    }

    function getInsertionAbsolutePosition() {
        const context = getSelectionContext();
        if (!context) return null;
        const { lineIndex, container, cursorOffset, parentDom } = context;
        let absoluteOffset = 0;
        const walker = document.createTreeWalker(parentDom, NodeFilter.SHOW_TEXT, null, false);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node === container) {
                absoluteOffset += cursorOffset;
                break;
            }
            absoluteOffset += node.textContent.length;
        }
        return { lineIndex, absoluteOffset };
    }

    function getSelectionMode() {
        const activeKey = getActiveKey();
        //console.log('[SelectionMode] activeKey =', activeKey);
        if (!activeKey) {
            //console.log('[SelectionMode] no active key → none');
            return 'none';
        }

        const ranges = getDomSelection(activeKey);
        //console.log('[SelectionMode] ranges =', ranges);
        if (!ranges || ranges.length === 0) {
            //console.log('[SelectionMode] no ranges → none');
            return 'none';
        }

        // 1️⃣ 커서만 있는 상태
        if (ranges.length === 1 && ranges[0].startIndex === ranges[0].endIndex) {
            //console.log('[SelectionMode] cursor only → cursor');
            return 'cursor';
        }

        // 2️⃣ 셀(블록) 전체 선택
        const container = document.getElementById(activeKey);
        if (
            container &&
            container.classList.contains('is-selected') &&
            ranges.every(r => r.startIndex === 0)
        ) {
            //console.log('[SelectionMode] cell selected → cell');
            return 'cell';
        }

        // 3️⃣ 텍스트 범위 선택
        //console.log('[SelectionMode] text range → range');
        return 'range';
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
            const pos = getSelectionPosition();
            if (pos) {
                lastValidPos = { 
                    lineIndex: pos.lineIndex, 
                    absoluteOffset: getInsertionAbsolutePosition().absoluteOffset || 0 
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
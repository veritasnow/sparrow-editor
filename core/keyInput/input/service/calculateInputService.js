// /core/keyInput/input/service/calculateInputService.js
import { EditorLineModel } from '../../../../model/editorLineModel.js';
import { inputModelService } from './inputModelService.js';
import { splitChunksByTable } from './splitInputService.js';

export function calculateInputUpdate({ currentLine, selection, activeKey, uiAPI }) {

    const { dataIndex, activeNode, cursorOffset, lineIndex, container, range, parentDom } = selection;
    let result = null;
    let flags  = { isNewChunk: false, isChunkRendering: false };

    if (activeNode && activeNode.nodeType === Node.TEXT_NODE) {
        if (currentLine.chunks[dataIndex]?.text === activeNode.textContent) {
            return { flags: { hasChange: false } };
        }
    }

    const targetChunk = currentLine.chunks[dataIndex];

    // Case 1: 텍스트 업데이트
    if (dataIndex !== null && activeNode && targetChunk && targetChunk.type === 'text') {
        const safeText  = getSafeTextFromRange(range);
        const cleanText = safeText.replace(/\u200B/g, '');

        result = inputModelService.updateTextChunk(
            currentLine,
            dataIndex,
            cleanText,
            cursorOffset,
            lineIndex,
            activeKey
        );

        if (result) flags.isChunkRendering = true;
    }

    // Case 2: DOM rebuild
    if (!result) {
        const rebuild = uiAPI.parseLineDOM(
            parentDom,
            currentLine.chunks,
            container,
            cursorOffset,
            lineIndex
        );

        if (rebuild.shouldSplit) {
            const separatedLines   = splitChunksByTable(rebuild.newChunks, currentLine.align);
            const tableIndex       = rebuild.newChunks.findIndex(chunk => chunk.type === 'table');
            const cursorChunkIndex = rebuild.restoreData.chunkIndex;

            // 🔥 누락되면 안되는 핵심 로직
            if (tableIndex !== -1 && cursorChunkIndex > tableIndex) {
                rebuild.restoreData.lineIndex  = rebuild.restoreData.lineIndex + 1;
                rebuild.restoreData.chunkIndex = 0;
            }

            return {
                isSplit: true,
                separatedLines,
                restoreData: {
                    ...rebuild.restoreData,
                    containerId: selection.containerId || activeKey
                },
                flags: { hasChange: true }
            };
        }

        if (rebuild.newChunks !== currentLine.chunks) {
            result = {
                updatedLine: EditorLineModel(currentLine.align, rebuild.newChunks),
                restoreData: {
                    ...rebuild.restoreData,
                    containerId: selection.containerId || activeKey
                }
            };
            flags.isNewChunk = true;
        }
    }

    if (!result) return { flags: { hasChange: false } };

    return {
        ...result,
        flags: { ...flags, hasChange: true }
    };
}

function getSafeTextFromRange(range) {
    if (!range) return '';
    const node = range.startContainer;
    return node.nodeType === Node.TEXT_NODE ? (node.nodeValue ?? '') : '';
}
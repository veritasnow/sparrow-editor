import { EditorLineModel } from '../../model/editorLineModel.js';
import { chunkRegistry } from '../chunk/chunkRegistry.js';

export const inputModelService = {
    /**
     * 일반 텍스트 청크 업데이트 계산
     */
    updateTextChunk(updatedLine, dataIndex, activeNode, cursorOffset, lineIndex) {
        const oldChunk = updatedLine.chunks[dataIndex];
        const newText = activeNode.textContent;

        if (oldChunk.text === newText) return null;

        const handler = chunkRegistry.get(oldChunk.type);
        const newChunk = handler.create(newText, oldChunk.style);
        const newChunks = [...updatedLine.chunks];
        newChunks[dataIndex] = newChunk;

        return {
            updatedLine: EditorLineModel(updatedLine.align, newChunks),
            restoreData: {
                lineIndex,
                anchor: { chunkIndex: dataIndex, type: 'text', offset: cursorOffset }
            }
        };
    },

    /**
     * 기본 커서 복원 데이터 생성
     */
    createDefaultRestoreData(updatedLine, lineIndex) {
        const lastIdx = updatedLine.chunks.length - 1;
        const lastChunk = updatedLine.chunks[lastIdx];
        if (!lastChunk) return null;

        return {
            lineIndex,
            anchor: {
                chunkIndex: lastIdx,
                type: lastChunk.type,
                offset: lastChunk.text ? lastChunk.text.length : 0,
                detail: lastChunk.type === 'table' ? { rowIndex: 0, colIndex: 0, offset: 0 } : null
            }
        };
    },

    /**
     * 커서 데이터 정규화
     */
    normalizeRestoreData(restoreData) {
        if (!restoreData) return null;
        if (restoreData.anchor) return restoreData;

        return {
            lineIndex: restoreData.lineIndex,
            anchor: {
                chunkIndex: restoreData.chunkIndex ?? 0,
                type: 'text',
                offset: restoreData.offset ?? 0,
                detail: null
            }
        };
    }
};
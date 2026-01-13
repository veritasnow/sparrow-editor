// /module/uiModule/service/inputModelService.js
import { EditorLineModel } from '../../model/editorLineModel.js';
import { chunkRegistry } from '../chunk/chunkRegistry.js';

export const inputModelService = {
    /**
     * 텍스트 청크 업데이트 (containerId 포함)
     */
    updateTextChunk(currentLine, dataIndex, textContent, cursorOffset, lineIndex, containerId) {
        const oldChunk = currentLine.chunks[dataIndex];
        if (oldChunk.text === textContent) return null;

        const handler = chunkRegistry.get('text');
        const newChunks = [...currentLine.chunks];
        newChunks[dataIndex] = handler.create(textContent, oldChunk.style);

        return {
            updatedLine: EditorLineModel(currentLine.align, newChunks),
            restoreData: {
                containerId,
                lineIndex,
                anchor: { 
                    chunkIndex: dataIndex, 
                    type: 'text', 
                    offset: cursorOffset 
                }
            }
        };
    },

    /**
     * 기본 복원 데이터 생성
     */
    createDefaultRestoreData(currentLine, lineIndex, containerId) {
        const chunks = currentLine.chunks;
        const lastIdx = chunks.length - 1;
        if (lastIdx < 0) return null;

        const lastChunk = chunks[lastIdx];
        return {
            containerId,
            lineIndex,
            anchor: {
                chunkIndex: lastIdx,
                type: lastChunk.type,
                offset: lastChunk.text?.length || 0
            }
        };
    },
}
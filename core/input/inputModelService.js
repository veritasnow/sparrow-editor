import { EditorLineModel } from '../../model/editorLineModel.js';
import { chunkRegistry } from '../chunk/chunkRegistry.js';

export const inputModelService = {
    // [기존] 텍스트 업데이트
    updateTextChunk(updatedLine, dataIndex, textContent, cursorOffset, lineIndex) {
        const oldChunk = updatedLine.chunks[dataIndex];
        if (oldChunk.text === textContent) return null;

        const handler = chunkRegistry.get('text');
        const newChunks = [...updatedLine.chunks];
        newChunks[dataIndex] = handler.create(textContent, oldChunk.style);

        return {
            updatedLine: EditorLineModel(updatedLine.align, newChunks),
            restoreData: {
                lineIndex,
                anchor: { chunkIndex: dataIndex, type: 'text', offset: cursorOffset }
            }
        };
    },

    // [신규] 테이블 업데이트 계산 (순수 데이터만 인자로 받음)
    updateTableModel(updatedLine, dataIndex, tableData, tablePos, lineIndex) {
        const oldChunk = updatedLine.chunks[dataIndex];
        if (JSON.stringify(oldChunk.data) === JSON.stringify(tableData)) return null;

        const handler = chunkRegistry.get('table');
        const newChunks = [...updatedLine.chunks];
        newChunks[dataIndex] = handler.clone({ data: tableData });

        return {
            updatedLine: EditorLineModel(updatedLine.align, newChunks),
            restoreData: {
                lineIndex,
                anchor: {
                    chunkIndex: dataIndex,
                    type: 'table',
                    detail: { ...tablePos }
                }
            }
        };
    },

    // [기존] 복원 데이터 생성
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

    // [기존] 정규화
    normalizeRestoreData(restoreData) {
        if (!restoreData || restoreData.anchor) return restoreData;
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
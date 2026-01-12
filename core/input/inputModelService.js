import { EditorLineModel } from '../../model/editorLineModel.js';
import { chunkRegistry } from '../chunk/chunkRegistry.js';

export const inputModelService = {
    /**
     * [개선] 텍스트 업데이트
     * - 첫 줄에서 updatedLine 대신 currentLine을 받도록 명칭 변경 (의미 명확화)
     */
    updateTextChunk(currentLine, dataIndex, textContent, cursorOffset, lineIndex) {
        const oldChunk = currentLine.chunks[dataIndex];
        
        // 1. 내용이 같다면 아무것도 하지 않고 null 반환 (Short-circuit)
        if (oldChunk.text === textContent) return null;

        const handler = chunkRegistry.get('text');
        
        // 2. 새로운 청크 배열 생성 (Shallow Copy) 및 특정 인덱스 교체
        const newChunks = [...currentLine.chunks];
        newChunks[dataIndex] = handler.create(textContent, oldChunk.style);

        // 3. 새로운 Line 객체 반환 (참조값이 달라짐)
        return {
            updatedLine: EditorLineModel(currentLine.align, newChunks),
            restoreData: {
                lineIndex,
                anchor: { chunkIndex: dataIndex, type: 'text', offset: cursorOffset }
            }
        };
    },

    /**
     * [개선] 테이블 업데이트
     * - tableData 자체가 불변성을 유지하며 전달된다고 전제 (핸들러에서 처리)
     */
    updateTableModel(currentLine, dataIndex, tableData, tablePos, lineIndex) {
        const oldChunk = currentLine.chunks[dataIndex];
        
        // [중요] 테이블 데이터의 주소값(참조)을 직접 비교합니다.
        // tableData는 호출부(handler.updateFromDOM)에서 이미 변경 시 새 객체로 넘어와야 합니다.
        if (oldChunk.data === tableData) return null;

        const handler = chunkRegistry.get('table');
        const newChunks = [...currentLine.chunks];
        
        // 새로운 데이터로 청크 클론
        newChunks[dataIndex] = handler.clone({ ...oldChunk, data: tableData });

        return {
            updatedLine: EditorLineModel(currentLine.align, newChunks),
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

    /**
     * [개선] 기본 복원 데이터 생성
     * - 불필요한 연산 줄이기
     */
    createDefaultRestoreData(currentLine, lineIndex) {
        const chunks = currentLine.chunks;
        const lastIdx = chunks.length - 1;
        if (lastIdx < 0) return null;

        const lastChunk = chunks[lastIdx];

        return {
            lineIndex,
            anchor: {
                chunkIndex: lastIdx,
                type: lastChunk.type,
                offset: lastChunk.text?.length || 0,
                detail: lastChunk.type === 'table' 
                    ? { rowIndex: 0, colIndex: 0, offset: 0 } 
                    : null
            }
        };
    },

    /**
     * [유지] 정규화 로직
     */
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
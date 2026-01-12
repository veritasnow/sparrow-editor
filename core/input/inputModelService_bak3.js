// /module/uiModule/service/inputModelService.js

import { EditorLineModel } from '../../model/editorLineModel.js';
import { chunkRegistry } from '../chunk/chunkRegistry.js';

export const inputModelService = {
    /**
     * [개선] 텍스트 업데이트
     * - 이제 본문 root 뿐만 아니라 TD(셀) 내부의 텍스트 수정도 이 함수가 담당합니다.
     * - 어느 컨테이너인지는 restoreData에 포함된 containerId로 구분합니다.
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
                containerId, // 💡 어느 박스(본문 or 셀)인지 기록
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
     * [개선] 기본 복원 데이터 생성
     * - 테이블 특수 detail을 제거하고 containerId를 추가했습니다.
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

    /**
     * [유지/개선] 정규화 로직
     * - anchor 구조로 통일하며 detail 필드를 제거합니다.
     */
    normalizeRestoreData(restoreData, defaultContainerId) {
        if (!restoreData) return null;
        
        return {
            containerId: restoreData.containerId || defaultContainerId,
            lineIndex: restoreData.lineIndex,
            anchor: {
                chunkIndex: restoreData.anchor?.chunkIndex ?? restoreData.chunkIndex ?? 0,
                type: restoreData.anchor?.type || 'text',
                offset: restoreData.anchor?.offset ?? restoreData.offset ?? 0
            }
        };
    }
};
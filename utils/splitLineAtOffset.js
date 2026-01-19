import { EditorLineModel } from '../model/editorLineModel.js';
import { splitLineChunks } from './splitLineChunksUtils.js';

/**
 * 라인 모델을 분할하여 두 개의 라인 객체로 반환 (Paste, Enter 등에서 사용)
 */
export function splitLineAtOffset(line, offset) {
    const { beforeChunks, afterChunks } = splitLineChunks(line.chunks, offset);

    return {
        left: EditorLineModel(line.align, beforeChunks),
        right: EditorLineModel(line.align, afterChunks)
    };
}
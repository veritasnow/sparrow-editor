// ----------------------------------------------------------------------
// 1. DTO/Interface 정의 (타입 정의 통합 유지)
// ----------------------------------------------------------------------
import {DEFAULT_LINE_STYLE } from '../constants/styleConstants.js';
import {TextChunkModel} from '../model/editorModel.js';
/**
 * EditorLine Entity 모델을 생성하여 반환합니다.
 * 💡 Object.freeze()를 사용하여 외부에서 속성을 직접 변경하는 것을 방지합니다.
 * @param {'left' | 'center' | 'right'} [align='left'] - 라인의 정렬 상태.
 * @param {(TextChunk | VideoChunk)[]} [chunks] - 라인을 구성하는 청크 배열.
 * @returns {EditorLine}
 */
export function EditorLineModel(align = DEFAULT_LINE_STYLE.align, chunks = [TextChunkModel()]) {
    const model = {
        align : align,
        chunks: chunks 
    };
    // ⚠️ 얕은 동결(Shallow Freeze)
    return Object.freeze(model); 
}

// sparrow-editor/model/editorModel.js

// ----------------------------------------------------------------------
// 1. DTO/Interface 정의 (타입 정의 통합 유지)
// ----------------------------------------------------------------------

/**
 * @typedef {'text' | 'video' | 'image'} ChunkType - 청크의 종류를 정의합니다.
 */

/**
 * @typedef {Object} ChunkStyle - 인라인 스타일 속성을 정의합니다.
 * @property {('bold'|undefined)} [fontWeight] - 글꼴 굵기.
 * @property {('italic'|undefined)} [fontStyle] - 글꼴 기울임.
 * @property {('underline'|undefined)} [textDecoration] - 밑줄.
 */

/**
 * @typedef {Object} TextChunk - 일반 텍스트 청크 모델입니다.
 * @property {'text'} type - 청크의 종류.
 * @property {string} text - 청크에 포함된 텍스트 내용.
 * @property {ChunkStyle} style - 이 청크에 적용된 인라인 스타일 객체.
 */

/**
 * @typedef {Object} EditorLine - 에디터의 단일 라인(블록) 구조입니다.
 * @property {'left' | 'center' | 'right'} align - 라인의 정렬 상태.
 * @property {TextChunk[]} chunks - 라인을 구성하는 청크 배열.
 */


// ----------------------------------------------------------------------
// 2. DTO/Model 팩토리 함수 (순수한 Model Entity 생성 역할 + 불변성 적용)
// ----------------------------------------------------------------------

/**
 * TextChunk Entity 모델을 생성하여 반환합니다. 
 * 💡 Object.freeze()를 사용하여 외부에서 속성을 직접 변경하는 것을 방지합니다.
 * @param {string} [type='text'] - 청크의 타입.
 * @param {string} [text=''] - 청크의 텍스트 내용.
 * @param {ChunkStyle} [style={}] - 청크의 스타일 객체.
 * @returns {TextChunk}
 */
export function TextChunkModel(type = 'text', text = '', style = {}) {
    // 💡 type이 'text'로 고정된 DTO 정의와 맞지 않지만, 유연성을 위해 type 파라미터는 유지합니다.
    const model = {
        type: type, 
        text: text,
        style: style
    };
    // ⚠️ 얕은 동결(Shallow Freeze): 최상위 속성만 동결됩니다. (충분함)
    return Object.freeze(model); 
}

/**
 * EditorLine Entity 모델을 생성하여 반환합니다.
 * 💡 Object.freeze()를 사용하여 외부에서 속성을 직접 변경하는 것을 방지합니다.
 * @param {'left' | 'center' | 'right'} [align='left'] - 라인의 정렬 상태.
 * @param {TextChunk[]} [chunks] - 라인을 구성하는 청크 배열.
 * @returns {EditorLine}
 */
export function EditorLineModel(align = 'left', chunks = [TextChunkModel()]) {
    const model = {
        align: align,
        chunks: chunks 
    };
    // ⚠️ 얕은 동결(Shallow Freeze)
    return Object.freeze(model); 
}

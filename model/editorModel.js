// ----------------------------------------------------------------------
// 1. DTO/Interface 정의 (타입 정의 통합 유지)
// ----------------------------------------------------------------------
import {DEFAULT_TEXT_STYLE } from '../constants/styleConstants.js';

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
  return Object.freeze({
    type,
    text,
    style: { ...DEFAULT_TEXT_STYLE, ...style }
  });
}
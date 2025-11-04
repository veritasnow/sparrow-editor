import { TextChunkModel } from '../model/editorModel.js'; // 💡 TextChunkModel 임포트

/**
 * 두 스타일 객체가 동일한 속성 및 값을 갖는지 확인합니다.
 * @param {Object} a - 스타일 객체 A
 * @param {Object} b - 스타일 객체 B
 * @returns {boolean} 스타일이 동일한지 여부
 */
function isSameStyle(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;

    const aKeys = Object.keys(a).filter(k => a[k] !== undefined).sort();
    const bKeys = Object.keys(b).filter(k => b[k] !== undefined).sort();
    if (aKeys.length !== bKeys.length) return false;

    return aKeys.every(k => a[k] === b[k]);
}

/**
 * 인접한 청크 중 타입과 스타일이 동일한 청크들을 하나의 청크로 병합합니다.
 * @param {Array<Object>} blocks - 청크 배열
 * @returns {Array<TextChunk>} 병합된 새 청크 배열
 */
export function mergeSameStyleBlocks(blocks) {
    const merged = [];
    let buffer = '';
    let currentStyle = null;
    let currentType = undefined;

    for (const block of blocks) {
        // 비텍스트 청크는 병합하지 않고, 이전 버퍼를 플러시한 후 그대로 추가하고 버퍼를 리셋합니다.
        if (block.type !== 'text') {
            if (buffer) {
                // 💡 [수정] TextChunkModel을 사용하여 병합된 청크 생성
                merged.push(TextChunkModel(currentType, buffer, currentStyle));
            }
            
            // 비텍스트 청크는 그대로 (참조 복사)하여 추가합니다.
            // 비디오/이미지 청크는 불변 객체이므로 안전합니다.
            merged.push(block); 

            // 병합 상태 초기화
            buffer = '';
            currentStyle = null;
            currentType = undefined;
            continue;
        }

        const style = block.style || null;
        const type = block.type;

        // 병합 조건: 현재 버퍼가 없거나, 스타일이 다르거나, 타입이 다를 때
        if (!buffer || !isSameStyle(currentStyle, style) || currentType !== type) {
            if (buffer) {
                // 💡 [수정] TextChunkModel을 사용하여 병합된 청크 생성
                merged.push(TextChunkModel(currentType, buffer, currentStyle));
            }
            
            buffer = block.text;
            currentStyle = style;
            currentType = type;
        } else {
            // 병합
            buffer += block.text;
        }
    }

    // 마지막 남은 버퍼 플러시
    if (buffer) {
        // 💡 [수정] TextChunkModel을 사용하여 마지막 병합된 청크 생성
        merged.push(TextChunkModel(currentType, buffer, currentStyle));
    }

    return merged;
}

import { chunkRegistry } from '../core/chunk/chunkRegistry.js'; // 레지스트리 도입
// ======================================================================
// 1. 청크 배열을 오프셋 기준으로 두 부분으로 나누는 함수
// ======================================================================

/**
 * 청크 배열을 전체 텍스트 오프셋을 기준으로 두 부분으로 나눕니다.
 * @param {Array<Object>} chunks - 라인의 청크 배열
 * @param {number} offset - 전체 텍스트 기준 분할 위치
 * @returns {{beforeChunks: Array, afterChunks: Array}}
 */
export function splitLineChunks(chunks, offset) {
    let currentOffset = 0;
    const beforeChunks = [];
    const afterChunks = [];
    let splitDone = false;

    for (const chunk of chunks) {
        if (chunk.type !== 'text') {
            // 비텍스트 청크는 그대로 유지
            if (!splitDone) beforeChunks.push(chunk);
            else afterChunks.push(chunk);
            continue;
        }

        const len = chunk.text.length;

        if (!splitDone && currentOffset + len >= offset) {
            const splitPoint = offset - currentOffset;

            const textBefore = chunk.text.substring(0, splitPoint);
            const textAfter = chunk.text.substring(splitPoint);

            if (textBefore.length > 0) {
                const handler  = chunkRegistry.get('text');
                beforeChunks.push(handler.create(textBefore, chunk.style));
            }
            if (textAfter.length > 0) {
                const handler  = chunkRegistry.get('text');            
                afterChunks.push(handler.create(textAfter, chunk.style));
            }
            splitDone = true;

        } else if (!splitDone) {
            beforeChunks.push(chunk);
        } else {
            afterChunks.push(chunk);
        }

        currentOffset += len;
    }

    // afterChunks가 비어있으면 공백 청크 추가 (커서 이동 가능하게)
    /*
    if (afterChunks.length === 0) {
        const handler  = chunkRegistry.get('text');     
        afterChunks.push(handler.create('', {})   );
    }
    */

    return { beforeChunks, afterChunks };
}
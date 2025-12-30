// ───────── chunkUtils.js ─────────
import { chunkRegistry } from '../core/chunk/chunkRegistry.js'; // 레지스트리 도입

/**
 * 전체 offset 기준으로 텍스트 청크를 before/target/after로 나눕니다.
 */
export function splitChunkByOffset(chunk, start, end) {
    if (chunk.type !== 'text') return { before: [], target: [chunk], after: [] };

    const text = chunk.text;
    const beforeText = text.slice(0, start);
    const targetText = text.slice(start, end);
    const afterText  = text.slice(end);

    const handler  = chunkRegistry.get('text');            
    const result = {
        before: beforeText ? [handler.create(beforeText, chunk.style)] : [],
        target: targetText ? [handler.create(targetText, chunk.style)] : [],
        after:  afterText  ? [handler.create(afterText, chunk.style)]  : []
    };

    return result;
}

/**
 * 연속된 동일 스타일 텍스트 청크를 병합
 */
export function mergeChunks(chunks) {
    const merged = [];
    let buffer = '';
    let currentStyle = null;
    let currentType = undefined;
    const handler  = chunkRegistry.get('text');            

    function flush() {
        if (buffer) {
            merged.push(handler.create(buffer, currentStyle));
            buffer = '';
            currentStyle = null;
            currentType = undefined;
        }
    }

    for (const chunk of chunks) {
        if (chunk.type !== 'text') {
            flush();
            merged.push(chunk);
            continue;
        }

        const style = chunk.style || null;
        const type  = chunk.type;

        if (!buffer || currentType !== type || !isSameStyle(currentStyle, style)) {
            flush();
            buffer = chunk.text;
            currentStyle = style;
            currentType = type;
        } else {
            buffer += chunk.text;
        }
    }
    flush();
    return merged;
}

function isSameStyle(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => a[key] === b[key]);
}

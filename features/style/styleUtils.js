// ───────── styleUtils.js ─────────
import { EditorLineModel } from '../../model/editorLineModel.js';
import { chunkRegistry } from '../../core/chunk/chunkRegistry.js'; // 레지스트리 도입
import { splitChunkByOffset, mergeChunks } from "../../utils/mergeUtils.js";
/**
 * 선택 영역에 스타일 patch 적용
 */
export function applyStylePatch(editorState, ranges, patch) {
    const newState = [...editorState];

    ranges.forEach(({ lineIndex, startIndex, endIndex }) => {
        const line = editorState[lineIndex];
        if (!line) return;

        let offset = 0;
        const newChunks = [];

        line.chunks.forEach(chunk => {
            const chunkStart = offset;
            const chunkEnd   = offset + (chunk.text?.length || 0);

            if (endIndex <= chunkStart || startIndex >= chunkEnd) {
                // 영역 밖
                newChunks.push(chunk);
            } else {
                // 영역 안 → 분리 후 patch 적용
                const { before, target, after } = splitChunkByOffset(
                    chunk,
                    Math.max(0, startIndex - chunkStart),
                    Math.min(chunk.text?.length || 0, endIndex - chunkStart)
                );

                newChunks.push(...before);

                if (target.length) {
                    target.forEach(t => {
                        const newStyle = { ...t.style, ...patch };
                        Object.keys(newStyle).forEach(k => newStyle[k] === undefined && delete newStyle[k]);

                        if (t.type === 'text') {
                            const handler  = chunkRegistry.get('text');
                            newChunks.push(handler.create(t.text, newStyle));
                        } else {
                            // 비텍스트(chunk.type !== 'text')는 기존 속성을 유지, style만 업데이트
                            newChunks.push({ ...t, style: newStyle });
                        }
                    });
                }

                newChunks.push(...after);
            }

            offset += chunk.text?.length || 0;
        });

        newState[lineIndex] = EditorLineModel(line.align, mergeChunks(newChunks));
    });

    return newState;
}

/**
 * 토글 스타일
 */
export function toggleInlineStyle(editorState, ranges, styleKey, styleValue) {
    let allApplied = true;

    ranges.forEach(({ lineIndex, startIndex, endIndex }) => {
        const line = editorState[lineIndex];
        if (!line) return;

        let offset = 0;
        for (const chunk of line.chunks) {
            const chunkStart = offset;
            const chunkEnd = offset + (chunk.text?.length || 0);

            if (endIndex > chunkStart && startIndex < chunkEnd) {
                if (!(chunk.style && chunk.style[styleKey] === styleValue)) {
                    allApplied = false;
                }
            }
            offset += chunk.text?.length || 0;
        }
    });

    const patch = allApplied
        ? { [styleKey]: undefined }   // 제거
        : { [styleKey]: styleValue }; // 적용

    return applyStylePatch(editorState, ranges, patch);
}

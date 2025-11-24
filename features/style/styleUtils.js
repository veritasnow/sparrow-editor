import { mergeSameStyleBlocks } from "../../utils/mergeUtils.js";
import { EditorLineModel, TextChunkModel } from '../../model/editorModel.js'; 

// ───────── 선택 영역에 스타일 patch 적용 ─────────
/**
 * 선택 영역에 스타일 패치(patch)를 적용하여 새로운 에디터 상태를 생성합니다. (순수 함수)
 */
export function applyInlineStyle(editorState, ranges, patch) {
    const newState = editorState.slice(); 

    ranges.forEach(({ lineIndex, startIndex, endIndex }) => {
        const line = editorState[lineIndex];
        if (!line) return;

        let charCount = 0;
        const newChunks = [];

        line.chunks.forEach(chunk => {
            const chunkStart = charCount;
            const chunkEnd = charCount + chunk.text.length;

            // 🟥 텍스트가 아닌 chunk는 절대 split하면 안 됨!!!
            if (chunk.type !== 'text') {
                newChunks.push(chunk);
                charCount += chunk.text.length;
                return;
            }

            // --- 텍스트 처리 ---
            if (endIndex <= chunkStart || startIndex >= chunkEnd) {
                newChunks.push(chunk);
            } else {
                const beforeText = chunk.text.slice(0, Math.max(0, startIndex - chunkStart));
                const targetText = chunk.text.slice(
                    Math.max(0, startIndex - chunkStart),
                    Math.min(chunk.text.length, endIndex - chunkStart)
                );
                const afterText = chunk.text.slice(Math.min(chunk.text.length, endIndex - chunkStart));

                if (beforeText) {
                    newChunks.push(TextChunkModel(chunk.type, beforeText, chunk.style));
                }

                if (targetText) {
                    const newStyle = { ...chunk.style, ...patch };
                    Object.keys(newStyle).forEach(key => newStyle[key] === undefined && delete newStyle[key]);
                    newChunks.push(TextChunkModel('text', targetText, newStyle));
                }

                if (afterText) {
                    newChunks.push(TextChunkModel(chunk.type, afterText, chunk.style));
                }
            }

            charCount += chunk.text.length;
        });

        const mergedChunks = mergeSameStyleBlocks(newChunks);
        newState[lineIndex] = EditorLineModel(line.align, mergedChunks);
    });

    return newState;
}


// ───────── 토글 스타일 적용 ─────────
export function toggleInlineStyle(editorState, ranges, styleKey, styleValue) {
    let allApplied = true;

    // ... (적용 여부 확인 로직은 DTO를 생성하지 않으므로 그대로 유지) ...
    ranges.forEach(({ lineIndex, startIndex, endIndex }) => {
        const line = editorState[lineIndex];
        if (!line) return;

        let charCount = 0;
        line.chunks.forEach(chunk => {
            const chunkStart = charCount;
            const chunkEnd   = charCount + chunk.text.length;

            if (endIndex > chunkStart && startIndex < chunkEnd) {
                if (!(chunk.style && chunk.style[styleKey] === styleValue)) {
                    allApplied = false;
                }
            }
            charCount += chunk.text.length;
        });
    });

    const patch = allApplied
        ? { [styleKey]: undefined }   // 이미 적용되어 있으면 제거
        : { [styleKey]: styleValue }; // 아니면 적용

    // applyInlineStyle 함수가 이제 Model 기반의 새로운 상태를 반환
    return applyInlineStyle(editorState, ranges, patch);
}

// utils/styleUtils.js
import { mergeSameStyleBlocks } from "./mergeUtils.js";

// ───────── 선택 영역에 스타일 patch 적용 ─────────
export function applyInlineStyle(editorState, ranges, patch, defaultChunkProps = { type: 'text' }) {
  const newState = editorState.map(line => ({ ...line, chunks: [...line.chunks] }));

  ranges.forEach(({ lineIndex, startIndex, endIndex }) => {
    const line = newState[lineIndex];
    if (!line) return;

    let charCount = 0;
    const newChunks = [];

    line.chunks.forEach(chunk => {
      const chunkStart = charCount;
      const chunkEnd = charCount + chunk.text.length;

      if (endIndex <= chunkStart || startIndex >= chunkEnd) {
        newChunks.push(chunk);
      } else {
        const before = chunk.text.slice(0, Math.max(0, startIndex - chunkStart));
        const target = chunk.text.slice(
          Math.max(0, startIndex - chunkStart),
          Math.min(chunk.text.length, endIndex - chunkStart)
        );
        const after = chunk.text.slice(Math.min(chunk.text.length, endIndex - chunkStart));

        if (before) newChunks.push({ ...chunk, text: before });
        if (target) {
          newChunks.push({ ...defaultChunkProps, ...chunk, text: target, style: { ...chunk.style, ...patch } });
        }
        if (after) newChunks.push({ ...chunk, text: after });
      }

      charCount += chunk.text.length;
    });

    line.chunks = mergeSameStyleBlocks(newChunks);
  });

  return newState;
}

// ───────── 토글 스타일 적용 ─────────
export function toggleInlineStyle(editorState, ranges, styleKey, styleValue, defaultChunkProps = { type: 'text' }) {
  let allApplied = true;

  ranges.forEach(({ lineIndex, startIndex, endIndex }) => {
    const line = editorState[lineIndex];
    if (!line) return;

    let charCount = 0;
    line.chunks.forEach(chunk => {
      const chunkStart = charCount;
      const chunkEnd = charCount + chunk.text.length;

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

  return applyInlineStyle(editorState, ranges, patch, defaultChunkProps);
}

import { mergeSameStyleBlocks } from "../../../utils/mergeUtils.js";

export function createStyleService({ getEditorState }) {

  function applyInlineStyle(ranges, patch) {
    const originalState = getEditorState();
    const newState = originalState.map(line => ({ ...line, chunks: [...line.chunks] }));

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
          if (target) newChunks.push({ ...chunk, text: target, style: { ...chunk.style, ...patch } });
          if (after) newChunks.push({ ...chunk, text: after });
        }

        charCount += chunk.text.length;
      });

      line.chunks = mergeSameStyleBlocks(newChunks);
    });

    return newState;
  }

  function toggleInlineStyle(ranges, styleKey, styleValue) {
    const originalState = getEditorState();
    const newState = originalState.map(line => ({ ...line, chunks: [...line.chunks] }));

    let allApplied = true;
    ranges.forEach(({ lineIndex, startIndex, endIndex }) => {
      const line = newState[lineIndex];
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
      ? { [styleKey]: undefined }
      : { [styleKey]: styleValue };

    return applyInlineStyle(ranges, patch);
  }

  return {
    applyInlineStyle,
    toggleInlineStyle
  };
}
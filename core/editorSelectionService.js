import {DEFAULT_TEXT_STYLE } from '../constants/styleConstants.js';

// core/editorSelectionService.js
export function createEditorSelectionService(stateAPI, uiAPI) {

  function analyzeSelection() {
    const ranges = uiAPI.getDomSelection();
    if (!ranges || ranges.length === 0) {
      return { isUniform: true, style: DEFAULT_TEXT_STYLE };      
    }

    const lineIndexes = ranges.map(r => r.lineIndex);
    const lines = stateAPI.getLines(lineIndexes);

    const map = {};
    lineIndexes.forEach((idx, i) => {
      map[idx] = lines[i];
    });

    return getUniformStyleFromSelection(map, ranges);
  }

  function getUniformStyleFromSelection(linesMap, ranges) {
    const collected = [];

    ranges.forEach(r => {
      const line = linesMap[r.lineIndex];
      if (!line) return;

      const chunks = getChunksInRange(line, r.startIndex, r.endIndex);
      chunks.forEach(info => collected.push(info.chunk.style || {}));
    });

    if (collected.length === 0)
      return { isUniform: true, style: DEFAULT_TEXT_STYLE };

    const base = JSON.stringify(collected[0]);
    const allSame = collected.every(st => JSON.stringify(st) === base);

    return { isUniform: allSame, style: allSame ? collected[0] : null };
  }

  function getChunksInRange(line, startIndex, endIndex) {
    const result = [];
    let acc = 0;

    line.chunks.forEach((chunk, i) => {
      const chunkStart = acc;
      const chunkEnd = acc + chunk.text.length;

      if (chunkEnd > startIndex && chunkStart < endIndex) {
        result.push({
          chunkIndex: i,
          chunk
        });
      }

      acc = chunkEnd;
    });

    return result;
  }

  return { analyzeSelection };
}

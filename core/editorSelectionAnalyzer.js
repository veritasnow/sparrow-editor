import {
  DEFAULT_TEXT_STYLE,
  DEFAULT_LINE_STYLE
} from '../constants/styleConstants.js';

// core/editorSelectionAnalyzer.js
export function editorSelectionAnalyzer(stateAPI, uiAPI) {

  function analyzeSelection() {
    const ranges = uiAPI.getDomSelection();

    // ✅ 선택이 없을 때 (최초 로드 / 포커스 없음)
    if (!ranges || ranges.length === 0) {
      return {
        text: {
          isUniform: true,
          style: DEFAULT_TEXT_STYLE
        },
        line: {
          isUniform: true,
          style: DEFAULT_LINE_STYLE
        }
      };
    }

    const lineIndexes = ranges.map(r => r.lineIndex);
    const lines = stateAPI.getLines(lineIndexes);

    const linesMap = {};
    lineIndexes.forEach((idx, i) => {
      linesMap[idx] = lines[i];
    });

    return getUniformStyleFromSelection(linesMap, ranges);
  }

  function getUniformStyleFromSelection(linesMap, ranges) {
    // -----------------------------
    // 1️⃣ 텍스트(청크) 스타일 수집
    // -----------------------------
    const collectedTextStyles = [];

    ranges.forEach(r => {
      const line = linesMap[r.lineIndex];
      if (!line) return;

      const chunks = getChunksInRange(line, r.startIndex, r.endIndex);
      chunks.forEach(info => {
        collectedTextStyles.push(info.chunk.style || {});
      });
    });

    // -----------------------------
    // 2️⃣ 텍스트 스타일 uniform 판별
    // -----------------------------
    let textResult;

    if (collectedTextStyles.length === 0) {
      textResult = {
        isUniform: true,
        style: DEFAULT_TEXT_STYLE
      };
    } else {
      const base = JSON.stringify(collectedTextStyles[0]);
      const isUniform = collectedTextStyles.every(
        st => JSON.stringify(st) === base
      );

      textResult = {
        isUniform,
        style: isUniform ? collectedTextStyles[0] : null
      };
    }

    // -----------------------------
    // 3️⃣ 라인 스타일 uniform 판별
    // -----------------------------
    const lineStyles = Object.values(linesMap).map(line => ({
      align: line.align
    }));

    let lineResult;

    if (lineStyles.length === 0) {
      lineResult = {
        isUniform: true,
        style: DEFAULT_LINE_STYLE
      };
    } else {
      const base = JSON.stringify(lineStyles[0]);
      const isUniform = lineStyles.every(
        st => JSON.stringify(st) === base
      );

      lineResult = {
        isUniform,
        style: isUniform ? lineStyles[0] : null
      };
    }

    // -----------------------------
    // 4️⃣ 최종 결과
    // -----------------------------
    return {
      text: textResult,
      line: lineResult
    };
  }

  function getChunksInRange(line, startIndex, endIndex) {
    const result = [];
    let acc = 0;

    line.chunks.forEach((chunk, i) => {
      const chunkStart = acc;
      const chunkEnd = acc + chunk.length; // 핵심 변경

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

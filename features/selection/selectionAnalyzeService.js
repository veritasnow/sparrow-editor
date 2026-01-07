import {
  DEFAULT_TEXT_STYLE,
  DEFAULT_LINE_STYLE
} from '../../constants/styleConstants.js';

/**
 * 에디터의 통합 커서 모델을 기반으로 현재 선택 영역의 
 * 텍스트 스타일 및 라인 스타일의 일관성(Uniformity)을 분석합니다.
 */
export function createSelectionAnalyzeService(stateAPI, uiAPI) {

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

  /**
   * 참고: 드래그를 통한 다중 선택 영역(Range) 분석이 필요한 경우 활용
   * (현재 질문하신 통합 커서 모델에 맞춘 확장 버전)
   */
  function getUniformStyleFromSelection(linesMap, ranges) {
    const collectedTextStyles = [];

    ranges.forEach(r => {
      const line = linesMap[r.lineIndex];
      if (!line) return;

      // 텍스트 기반 오프셋 범위 내의 청크들 수집
      const chunks = getChunksInRange(line, r.startIndex, r.endIndex);
      chunks.forEach(info => {
        // 테이블 청크인 경우 단순 chunk.style만 수집하거나 
        // 선택 영역이 테이블 내부라면 셀 스타일을 수집하도록 로직 확장 가능
        collectedTextStyles.push(info.chunk.style || DEFAULT_TEXT_STYLE);
      });
    });

    return {
      text: checkUniform(collectedTextStyles, DEFAULT_TEXT_STYLE),
      line: checkUniform(Object.values(linesMap).map(l => ({ align: l.align })), DEFAULT_LINE_STYLE)
    };
  }

  function checkUniform(styleList, defaultStyle) {
    if (styleList.length === 0) return { isUniform: true, style: defaultStyle };
    const base = JSON.stringify(styleList[0]);
    const isUniform = styleList.every(st => JSON.stringify(st) === base);
    return { isUniform, style: isUniform ? styleList[0] : null };
  }

  // 기존 헬퍼 함수 유지
  function getChunksInRange(line, startIndex, endIndex) {
    const result = [];
    let acc = 0;
    line.chunks.forEach((chunk, i) => {
      const len = chunk.type === 'text' ? (chunk.text?.length || 0) : 1; // 테이블 등은 길이를 1로 간주
      const chunkStart = acc;
      const chunkEnd = acc + len;
      if (chunkEnd > startIndex && chunkStart < endIndex) {
        result.push({ chunkIndex: i, chunk });
      }
      acc = chunkEnd;
    });
    return result;
  }

  return { analyzeSelection };
}
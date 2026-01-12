import {
  DEFAULT_TEXT_STYLE,
  DEFAULT_LINE_STYLE
} from '../../constants/styleConstants.js';

export function createSelectionAnalyzeService(stateAPI, uiAPI) {

  function analyzeSelection() {
    const ranges = uiAPI.getDomSelection();

    if (!ranges || ranges.length === 0) {
      return {
        text: { isUniform: true, style: DEFAULT_TEXT_STYLE },
        line: { isUniform: true, style: DEFAULT_LINE_STYLE }
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
    const collectedTextStyles = [];

    ranges.forEach(r => {
      const line = linesMap[r.lineIndex];
      if (!line) return;

      const chunks = getChunksInRange(line, r.startIndex, r.endIndex);
      chunks.forEach(info => {
        collectedTextStyles.push(info.chunk.style || DEFAULT_TEXT_STYLE);
      });
    });

    // 라인 스타일(정렬 등) 수집
    const collectedLineStyles = Object.values(linesMap).map(l => ({ align: l.align }));

    return {
      text: checkUniform(collectedTextStyles, DEFAULT_TEXT_STYLE),
      line: checkUniform(collectedLineStyles, DEFAULT_LINE_STYLE)
    };
  }

  /**
   * [개선] JSON.stringify 대신 참조 및 속성 비교 사용
   */
  function checkUniform(styleList, defaultStyle) {
    if (styleList.length === 0) return { isUniform: true, style: defaultStyle };
    
    const firstStyle = styleList[0];
    
    // 모든 요소가 첫 번째 요소와 "동일한지" 확인
    const isUniform = styleList.every(style => isShallowEqual(firstStyle, style));
    
    return { 
      isUniform, 
      style: isUniform ? firstStyle : null 
    };
  }

  /**
   * [신규] 객체 얕은 비교 헬퍼
   * 스타일 객체는 깊이가 깊지 않으므로(단순 키-값) 이 방식이 훨씬 빠릅니다.
   */
  function isShallowEqual(objA, objB) {
    if (objA === objB) return true; // 참조가 같으면 즉시 true
    if (!objA || !objB) return false;

    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) return false;

    // 모든 키의 값이 일치하는지 확인
    for (let key of keysA) {
      if (objA[key] !== objB[key]) return false;
    }

    return true;
  }

  // 기존 헬퍼 함수 (유지하되 가독성 개선)
  function getChunksInRange(line, startIndex, endIndex) {
    const result = [];
    let acc = 0;
    
    for (let i = 0; i < line.chunks.length; i++) {
      const chunk = line.chunks[i];
      const len = chunk.type === 'text' ? (chunk.text?.length || 0) : 1;
      const chunkStart = acc;
      const chunkEnd = acc + len;

      if (chunkEnd > startIndex && chunkStart < endIndex) {
        result.push({ chunkIndex: i, chunk });
      }
      acc = chunkEnd;
      if (acc >= endIndex) break; // 범위를 벗어나면 조기 종료
    }
    return result;
  }

  return { analyzeSelection };
}
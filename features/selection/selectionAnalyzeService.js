// /features/selection/selectionAnalyzeService.js
import {
  DEFAULT_TEXT_STYLE,
  DEFAULT_LINE_STYLE
} from '../../constants/styleConstants.js';

export function createSelectionAnalyzeService(stateAPI, uiAPI) {

  /**
   * [Main] 현재 선택 영역의 스타일을 통합 분석하여 반환
   */
  function analyzeSelection() {
    // 1. 현재 선택된 모든 컨테이너(셀들 또는 본문) ID 확보
    const activeKeys = uiAPI.getActiveKeys(); 
    
    // 선택 영역이 아예 없거나 에디터 외부인 경우
    if (!activeKeys || activeKeys.length === 0) {
      return getEmptyResult();
    }

    const allCollectedTextStyles = [];
    const allCollectedLineStyles = [];

    // 2. 각 활성 컨테이너를 순회하며 스타일 수집
    activeKeys.forEach(key => {
      const ranges = uiAPI.getDomSelection(key); 
      if (!ranges || ranges.length === 0) return;

      const currentState = stateAPI.get(key);
      if (!currentState) return;

      // 해당 컨테이너 내부의 상세 스타일 추출
      const { textStyles, lineStyles } = collectStylesFromContainer(currentState, ranges);
      
      allCollectedTextStyles.push(...textStyles);
      allCollectedLineStyles.push(...lineStyles);
    });

    // 3. 수집된 데이터가 없으면 기본값 반환
    if (allCollectedTextStyles.length === 0 && allCollectedLineStyles.length === 0) {
      return getEmptyResult();
    }

    // 4. 수집된 모든 스타일의 균일성(Uniform) 판단
    return {
      text: checkUniform(allCollectedTextStyles, DEFAULT_TEXT_STYLE),
      line: checkUniform(allCollectedLineStyles, DEFAULT_LINE_STYLE)
    };
  }

  /**
   * 컨테이너 내부 수집 로직 (가독성을 위해 분리)
   */
  function collectStylesFromContainer(state, ranges) {
    const textStyles = [];
    const lineStyles = [];
    const seenLines = new Set();

    ranges.forEach(r => {
      const line = state[r.lineIndex];
      if (!line) return;

      // 텍스트 스타일 추출 (getChunksInRange 활용)
      const chunksInRange = getChunksInRange(line, r.startIndex, r.endIndex);
      chunksInRange.forEach(info => {
        textStyles.push(info.chunk.style || DEFAULT_TEXT_STYLE);
      });

      // 라인 스타일 추출 (중복 라인 방지)
      if (!seenLines.has(r.lineIndex)) {
        lineStyles.push({ align: line.align || DEFAULT_LINE_STYLE.align });
        seenLines.add(r.lineIndex);
      }
    });

    return { textStyles, lineStyles };
  }

  /**
   * 스타일 목록이 모두 동일한지 비교
   */
  function checkUniform(styleList, defaultStyle) {
    if (styleList.length === 0) return { isUniform: true, style: defaultStyle };
    
    const firstStyle = styleList[0];
    const isUniform = styleList.every(style => isShallowEqual(firstStyle, style));
    
    // 하나라도 다르면 style은 null을 반환하여 툴바 버튼을 끕니다.
    return { 
      isUniform, 
      style: isUniform ? firstStyle : null 
    };
  }

  /**
   * 객체 비교 최적화 (Shallow Equal)
   */
  function isShallowEqual(objA, objB) {
    if (objA === objB) return true;
    if (!objA || !objB) return false;
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);
    if (keysA.length !== keysB.length) return false;
    for (let key of keysA) {
      if (objA[key] !== objB[key]) return false;
    }
    return true;
  }

  function getChunksInRange(line, startIndex, endIndex) {
    const result = [];
    let acc = 0;
    for (let i = 0; i < line.chunks.length; i++) {
      const chunk = line.chunks[i];
      const len = chunk.type === 'text' ? (chunk.text?.length || 0) : 1;
      const chunkEnd = acc + len;
      if (chunkEnd > startIndex && acc < endIndex) {
        result.push({ chunkIndex: i, chunk });
      }
      acc = chunkEnd;
      if (acc >= endIndex) break;
    }
    return result;
  }

  function getEmptyResult() {
    return {
      text: { isUniform: true, style: DEFAULT_TEXT_STYLE },
      line: { isUniform: true, style: DEFAULT_LINE_STYLE }
    };
  }

  return { analyzeSelection };
}
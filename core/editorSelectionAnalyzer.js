import {
  DEFAULT_TEXT_STYLE,
  DEFAULT_LINE_STYLE
} from '../constants/styleConstants.js';

/**
 * 에디터의 통합 커서 모델을 기반으로 현재 선택 영역의 
 * 텍스트 스타일 및 라인 스타일의 일관성(Uniformity)을 분석합니다.
 */
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

  /*
  function analyzeSelection() {
    // 1. 통합 커서 정보 가져오기 (이미 개선된 getSelectionPosition 활용)
    const selection = uiAPI.getSelectionPosition();
    
    // ✅ 선택이 없거나 포커스가 없을 때
    if (!selection) {
      return {
        text: { isUniform: true, style: DEFAULT_TEXT_STYLE },
        line: { isUniform: true, style: DEFAULT_LINE_STYLE }
      };
    }

    // 2. 현재 라인 정보 가져오기
    const line = stateAPI.getLines(selection.lineIndex);
    if (!line) return null;

    // 3. 청크 찾기
    const chunk = line.chunks[selection.anchor.chunkIndex];
    if (!chunk) return null;

    // -------------------------------------------------------
    // [분기 처리] 테이블 내부인지 일반 텍스트인지에 따라 스타일 추출
    // -------------------------------------------------------
    let targetStyle = DEFAULT_TEXT_STYLE;

    if (selection.anchor.type === 'table' && selection.anchor.detail) {
      // A. 테이블인 경우: 해당 셀(Cell)의 데이터를 확인 (셀마다 스타일이 다를 수 있으므로)
      const { rowIndex, colIndex } = selection.anchor.detail;
      const cellData = chunk.data?.rows?.[rowIndex]?.[colIndex];
      
      // 테이블 셀 내부에 별도 스타일 시스템이 있다면 그 스타일을 반환
      // (현재 구조에서는 테이블 전체 스타일 혹은 셀 기본 스타일 적용)
      targetStyle = cellData?.style || chunk.style || DEFAULT_TEXT_STYLE;
    } else {
      // B. 일반 텍스트 청크인 경우
      targetStyle = chunk.style || DEFAULT_TEXT_STYLE;
    }

    // -------------------------------------------------------
    // 결과 반환 (현재는 단일 지점 커서 기준 분석 위주)
    // -------------------------------------------------------
    return {
      text: {
        isUniform: true, // 단일 커서일 때는 항상 true
        style: targetStyle
      },
      line: {
        isUniform: true,
        style: { align: line.align || 'left' }
      }
    };
  }
  */

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
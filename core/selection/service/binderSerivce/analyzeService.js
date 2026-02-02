import { DEFAULT_TEXT_STYLE, DEFAULT_LINE_STYLE } from '../../../../constants/styleConstants.js';

export function createAnalyzeService(stateAPI, selectionAPI) {
  
  /**
   * [Main] 분석 로직 최적화
   * 루프를 최소화하고 "통일성 확인"과 "데이터 수집"을 한 번의 패스로 처리합니다.
   */
  function analyzeSelection() {
    const activeKeys = selectionAPI.getActiveKeys(); 
    if (!activeKeys?.length) return getEmptyResult();

    // 분석을 위한 상태 변수
    let unifiedText = null;   // 첫 번째 텍스트 스타일 기준
    let unifiedLine = null;   // 첫 번째 라인 스타일 기준
    let textUniformMap = {};  // 각 속성별 통일성 여부
    let lineUniformMap = {};
    let isFirstText = true;
    let isFirstLine = true;
    let hasValidData = false;

    // 1. 활성 컨테이너 순회
    for (const key of activeKeys) {
      const ranges = selectionAPI.getDomSelection(key);
      const state = stateAPI.get(key);
      if (!state) continue;

      // [Case A] 드래그 선택 영역이 있는 경우
      if (ranges?.length) {
        for (const r of ranges) {
          const line = state[r.lineIndex];
          if (!line) continue;

          // 라인 스타일 분석 (중복 계산 방지)
          const currentLineStyle = { align: line.align || DEFAULT_LINE_STYLE.align };
          [unifiedLine, lineUniformMap, isFirstLine] = updateUniformStatus(
            unifiedLine, currentLineStyle, lineUniformMap, isFirstLine
          );

          // 텍스트 스타일 분석 (교집합 청크만 정밀 탐색)
          let acc = 0;
          for (const chunk of line.chunks) {
            const len = (chunk.type === 'text' || !chunk.type) ? (chunk.text?.length || 0) : 1;
            const chunkEnd = acc + len;

            // 수학적 교집합: 선택 범위 내에 있는 청크만 처리
            if (Math.max(acc, r.startIndex) < Math.min(chunkEnd, r.endIndex)) {
              const currentTextStyle = { ...DEFAULT_TEXT_STYLE, ...(chunk.style || {}) };
              [unifiedText, textUniformMap, isFirstText] = updateUniformStatus(
                unifiedText, currentTextStyle, textUniformMap, isFirstText
              );
              hasValidData = true;
            }
            acc = chunkEnd;
            if (acc >= r.endIndex) break; // 성능 최적화: 범위를 벗어나면 즉시 중단
          }
        }
      } 
      // [Case B] 커서만 있는 경우
      else {
        const context = selectionAPI.getSelectionContext();
        if (context?.containerId === key) {
          const line = state[context.lineIndex];
          if (line) {
            const chunk = line.chunks[context.dataIndex ?? 0] || line.chunks[0];
            unifiedText = { ...DEFAULT_TEXT_STYLE, ...(chunk?.style || {}) };
            unifiedLine = { align: line.align || DEFAULT_LINE_STYLE.align };
            // 커서 상태는 무조건 Uniform함
            return {
              text: { isUniform: true, style: unifiedText },
              line: { isUniform: true, style: unifiedLine }
            };
          }
        }
      }
    }

    if (!hasValidData && isFirstLine) return getEmptyResult();

    return {
      text: finalizeResult(unifiedText, textUniformMap, DEFAULT_TEXT_STYLE),
      line: finalizeResult(unifiedLine, lineUniformMap, DEFAULT_LINE_STYLE)
    };
  }

  /**
   * [성능 핵심] 스타일 비교 및 상태 업데이트 루프 최적화
   * 매번 배열을 만들지 않고 현재까지의 통일성 상태만 유지합니다.
   */
  function updateUniformStatus(unified, current, map, isFirst) {
    if (isFirst) {
      // 첫 데이터인 경우 맵 초기화
      Object.keys(current).forEach(k => map[k] = true);
      return [current, map, false];
    }

    // 기존 속성들을 순회하며 통일성이 깨졌는지 확인
    for (const key in map) {
      if (map[key] && unified[key] !== current[key]) {
        map[key] = false; // 한 번 깨진 통일성은 다시 복구되지 않음
      }
    }
    return [unified, map, false];
  }

  /**
   * 통일성이 깨진 속성은 null로 처리하여 최종 결과 반환
   */
  function finalizeResult(style, map, defaultStyle) {
    if (!style) return { isUniform: true, style: defaultStyle };
    
    const resultStyle = { ...style };
    let isAllUniform = true;

    for (const key in map) {
      if (!map[key]) {
        resultStyle[key] = null;
        isAllUniform = false;
      }
    }

    return { isUniform: isAllUniform, style: resultStyle };
  }

  function getEmptyResult() {
    return {
      text: { isUniform: true, style: DEFAULT_TEXT_STYLE },
      line: { isUniform: true, style: DEFAULT_LINE_STYLE }
    };
  }

  return { analyzeSelection };
}
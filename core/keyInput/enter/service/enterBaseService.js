import { resolveEnterPosition, commitCursor } from '../utils/enterUtils.js';
import { calculateEnterState } from '../service/calculateService.js';
import { normalizeCursorData } from '../../../../utils/cursorUtils.js';

export function handleBaseEnter({ stateAPI, uiAPI, selectionAPI, containerId }) {
    // 해당 컨테이너의 상태와 선택 범위를 가져옵니다.
    const currentState = stateAPI.get(containerId);
    const domRanges    = selectionAPI.getDomSelection(containerId);

    if (!domRanges || domRanges.length === 0 || !currentState) return;

    // 1. [위치 파악]
    const { lineIndex, offset } = resolveEnterPosition(currentState, domRanges);

    // 2. [상태 계산]
    const result = calculateEnterState(currentState, lineIndex, offset, containerId);

    // 3. [UI 반영] 
    applyEnterResult(containerId, result, { stateAPI, uiAPI, selectionAPI });
}


/**
 * [Step 3] 상태 저장 및 UI 업데이트 반영
 */
function applyEnterResult(targetContainerId, result, { stateAPI, uiAPI, selectionAPI }) {
    const { newState, newPos, newLineData, lineIndex } = result;

    // 1. 상태 저장 (정확한 대상 컨테이너에 저장)
    stateAPI.save(targetContainerId, newState);

    const container = document.getElementById(targetContainerId);
    if (!container) return;

    // 2. 🔥 [중요] :scope를 사용하여 해당 컨테이너의 직계 자식 라인만 추출
    // 이를 통해 테이블 외부 엔터 시 내부 0번 라인이 잡히는 것을 방지합니다.
    const currentLineEl   = container.querySelector(`:scope > [data-line-index="${lineIndex}"]`);
    
    // 테이블 소실 방지를 위한 Pool 추출
    const movingTablePool = currentLineEl 
        ? Array.from(currentLineEl.getElementsByClassName('chunk-table')) 
        : [];

    // 3. UI 반영: 반드시 targetContainerId를 넘겨 부모-자식 관계 명시
    uiAPI.insertLine(lineIndex + 1, newLineData.align, targetContainerId, newLineData); 

    // 4. 기존 줄 업데이트
    uiAPI.renderLine(lineIndex, newState[lineIndex], { 
        key: targetContainerId 
    });

    // 5. 새 줄 업데이트 (추출한 테이블 주입)
    uiAPI.renderLine(lineIndex + 1, newState[lineIndex + 1], { 
        key: targetContainerId, 
        pool: movingTablePool 
    });
    
    // 6. 커서 복원 (가상 스크롤 및 DOM 안정화 대응)
    const finalPos = normalizeCursorData(newPos, targetContainerId);
    commitCursor(finalPos, stateAPI, selectionAPI);
    movingTablePool.length = 0;
}
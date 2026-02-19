import { resolveEnterPosition, commitCursor } from '../utils/enterUtils.js';
import { calculateEnterState } from '../service/calculateService.js';
import { normalizeCursorData } from '../../../../utils/cursorUtils.js';
import { isLineEmpty } from '../../../../utils/emptyUtils.js';
import { EditorLineModel } from '../../../../model/editorLineModel.js';

/**
 * 리스트 전용 엔터 핸들러
 */
export function handleListEnter({ stateAPI, uiAPI, selectionAPI, containerId }) {

    const listState = stateAPI.get(containerId);
    const domRanges = selectionAPI.getDomSelection(containerId);

    if (!listState || !domRanges) {
        return;
    }

    const { lineIndex, offset } = resolveEnterPosition(listState, domRanges);

    // =========================
    // 1️⃣ 빈 줄 → 리스트 탈출
    // =========================
    if (isLineEmpty(listState[lineIndex])) {
        lineEmptyPrcessEnter(stateAPI, selectionAPI, uiAPI, containerId, listState, lineIndex);
    } else {
        linePrcessEnter(stateAPI, selectionAPI, uiAPI, containerId, listState, lineIndex, offset);
    }
}


function linePrcessEnter(stateAPI, selectionAPI, uiAPI, containerId, listState, lineIndex, offset) {
    const result = calculateEnterState(listState, lineIndex, offset, containerId);

    // 리스트 상태 저장
    stateAPI.save(containerId, result.newState);

    const { mainKey, mainState, parentLineIndex } = findParentLineInMain(stateAPI, selectionAPI, containerId);
    if (parentLineIndex !== -1) {
        const parentLine = mainState[parentLineIndex];
        const listChunk  = parentLine.chunks.find(c => c.id === containerId);

        // 리스트 데이터 동기화
        listChunk.data = result.newState.map((line, idx) => ({
            index: idx,
            line: line
        }));

        stateAPI.save(mainKey, mainState);
        uiAPI.renderLine(parentLineIndex, mainState[parentLineIndex], { key: mainKey });

    }

    // 커서 복원 (공통 처리)
    const finalPos = normalizeCursorData(result.newPos, containerId);
    commitCursor(finalPos, stateAPI, selectionAPI);

}

function lineEmptyPrcessEnter(stateAPI, selectionAPI, uiAPI, containerId, listState, lineIndex) {
    const parentId        = selectionAPI.findParentContainerId(containerId);
    const parentState     = [...stateAPI.get(parentId)];
    const listEl          = document.getElementById(containerId);
    const parentLineIndex = selectionAPI.getLineIndex(listEl);

    // 리스트 내부 상태 제거
    const updatedListState = [...listState];
    updatedListState.splice(lineIndex, 1);

    // 새 일반 라인 생성
    const newEmptyLine = EditorLineModel('left', [{
        type: 'text',
        text: '',
        style: { fontSize: '14px', fontFamily: 'Pretendard, sans-serif' }
    }]);

    // 상태 반영
    parentState.splice(parentLineIndex + 1, 0, newEmptyLine);

    stateAPI.save(parentId, parentState);
    uiAPI.renderLine(parentLineIndex, parentState[parentLineIndex], { key: parentId });        

    // 새 라인 삽입 및 렌더
    uiAPI.insertLine(parentLineIndex + 1, newEmptyLine.align, parentId, newEmptyLine);
    uiAPI.renderLine(parentLineIndex + 1, newEmptyLine, { key: parentId });

    // 커서 위치 계산
    const finalPos = {
        containerId: parentId,
        lineIndex: updatedListState.length === 0
            ? parentLineIndex
            : parentLineIndex + 1,
        anchor: { chunkIndex: 0, type: 'text', offset: 0 }
    };

    commitCursor(finalPos, stateAPI, selectionAPI);
}

function findParentLineInMain(stateAPI, selectionAPI, containerId) {
    const mainKey   = selectionAPI.getMainKey();
    const mainState = [...stateAPI.get(mainKey)];

    const parentLineIndex = mainState.findIndex(line =>
        line.chunks?.some(c => c.id === containerId)
    );

    return { mainKey, mainState, parentLineIndex };
}
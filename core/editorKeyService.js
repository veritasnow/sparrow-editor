// service/keyInput/editorKeyService.js
import { calculateEnterState, calculateBackspaceState } from '../utils/keyStateUtil.js';
import { getLineLengthFromState } from '../utils/editorStateUtils.js';

/**
 * 💚 EditorKeyService
 * -------------------------------------------------------
 * 에디터의 Enter / Backspace / Undo / Redo 키 입력을 처리하는 서비스.
 *
 * 이 모듈은 "Controller" 역할만 담당한다:
 *  - 상태 읽기
 *  - 순수 상태 계산 함수 호출
 *  - 변경된 상태 저장
 *  - UI에 반영하기 위한 Side Effect 실행
 *
 * "State Logic" 은 calculateEnterState(), calculateBackspaceState() 등에서만 담당한다.
 * "UI Rendering" 은 ui.renderLine(), ui.insertLine(), ui.removeLine() 등에서 담당한다.
 *
 * 즉 다음 구조를 따른다:
 *   DOM Selection → Offset 보정 → 순수 상태 계산 → 상태 저장 → UI 업데이트 → 커서 복원
 */
export function createEditorKeyService({ state, ui }) {

    /**
     * ENTER 처리
     * -------------------------------------------------------
     * - DOM Selection 읽기
     * - State 기반 offset 보정
     * - 순수 상태 계산 함수로 줄바꿈 로직 위임
     * - 변경된 상태 저장
     * - DOM 라인 추가 및 렌더링
     * - 커서 위치 복원
     */
    function processEnter() {
        const currentState = state.get();

        // 🎨 DOM selection 가져오기
        const domRanges = ui.getDomSelection();
        if (!domRanges || domRanges.length === 0) return;

        const { lineIndex, endIndex: domOffset } = domRanges[0];

        // 현재 라인 길이를 기반으로 DOM offset 보정(클램프)
        const lineState = currentState[lineIndex];
        const lineLen = getLineLengthFromState(lineState);
        const offset = Math.max(0, Math.min(domOffset, lineLen));

        // 🧠 순수 상태 계산 (줄바꿈 로직)
        const { newState, newPos, newLineData } =
            calculateEnterState(currentState, lineIndex, offset);

        // 💚 상태 + 커서 저장
        state.save(newState);
        state.saveCursor({
            lineIndex  : newPos.lineIndex,
            startOffset: 0,
            endOffset  : newPos.offset
        });

        // 🎨 UI 반영 (DOM 라인 삽입 + 렌더링)
        ui.insertLine(lineIndex + 1, newLineData.align);
        ui.renderLine(lineIndex, newState[lineIndex]);
        ui.renderLine(lineIndex + 1, newLineData);

        // 🎨 커서 복원
        ui.restoreCursor(newPos);
    }

    /**
     * BACKSPACE 처리
     * -------------------------------------------------------
     * - DOM Selection 읽기
     * - State 기반 offset 보정
     * - 순수 상태 계산 함수에서 삭제/줄 병합 로직 처리
     * - 변경된 상태 저장
     * - 삭제된 라인/업데이트된 라인 UI에 반영
     * - 커서 위치 복원
     */
    function processBackspace() {
        const currentState = state.get();
        const domRanges = ui.getDomSelection();
        if (!domRanges || domRanges.length === 0) return;

        const { lineIndex, endIndex: domOffset } = domRanges[0];

        // offset 보정
        const lineState = currentState[lineIndex];
        const lineLen = getLineLengthFromState(lineState);
        const offset = Math.max(0, Math.min(domOffset, lineLen));

        // 🧠 순수 상태 계산 (삭제/병합)
        const { newState, newPos, deletedLineIndex, updatedLineIndex } =
            calculateBackspaceState(currentState, lineIndex, offset);

        // 상태 변화가 없으면 종료
        if (newState === currentState) return;

        // 💚 상태 + 커서 저장
        state.save(newState);
        state.saveCursor({
            lineIndex  : newPos.lineIndex,
            startOffset: 0,
            endOffset  : newPos.offset
        });

        // 🎨 UI 반영
        if (deletedLineIndex !== null) {
            ui.removeLine(deletedLineIndex);
        }
        if (updatedLineIndex !== null) {
            ui.renderLine(updatedLineIndex, newState[updatedLineIndex]);
        }

        // 🎨 커서 복원
        ui.restoreCursor(newPos);
    }

    /**
     * UNDO
     * -------------------------------------------------------
     * - 히스토리에서 이전 상태 꺼내기
     * - 전체 UI 렌더링
     * - 커서 복원
     */
    function callUndo() {
        const { state: newState, cursor } = state.undo();

        // cursor가 null이면 전체 렌더링
        if (!cursor) {
            ui.render(newState.editorState);
            return;
        }

        // 특정 라인만 렌더링
        ui.renderLine(cursor.lineIndex, newState.editorState[cursor.lineIndex]);

        // 커서 복원
        ui.restoreCursor({
            lineIndex: cursor.lineIndex,
            offset: cursor.endOffset
        });
    }

    /**
     * REDO
     * -------------------------------------------------------
     * - 다음 상태 꺼내기
     * - UI 렌더링
     * - 커서 복원
     */
    function callRedo() {
        const { state: newState, cursor } = state.redo();
        // cursor가 null이면 전체 렌더링
        if (!cursor) {
            ui.render(newState.editorState);
            return;
        }

        // 특정 라인만 렌더링
        ui.renderLine(cursor.lineIndex, newState.editorState[cursor.lineIndex]);

        // 커서 복원
        ui.restoreCursor({
            lineIndex: cursor.lineIndex,
            offset: cursor.endOffset
        });
    }

    // 외부 API
    return {
        processEnter,
        processBackspace,
        undo : callUndo,
        redo : callRedo
    };
}

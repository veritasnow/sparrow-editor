/**
 * 테이블 툴바 액션 서비스
 * (행 추가 / 열 추가 / 병합 / 삭제)
 * 실제 로직은 추후 구현 예정 - 현재는 이벤트 연결용 스켈레톤
 */
export function createTableToolbarService(stateAPI, uiAPI, selectionAPI) {

    /**
     * 아래에 행 추가
     */
    function addRow({ tableEl, rootEl, action, event }) {
        alert("기능 구현중");        
        if (!tableEl) return false;
        // TODO: 행 추가 로직 구현 예정
        // 1. 선택된 셀 위치 분석
        // 2. 모델 state에 row 삽입
        // 3. UI 부분 렌더링
        
        console.log("[TableToolbar] addRow called", {
            tableId: tableEl.id,
            action
        });

        return true;
    }

    /**
     * 오른쪽에 열 추가
     */
    function addCol({ tableEl, rootEl, action, event }) {
        alert("기능 구현중");        
        if (!tableEl) return false;

        // TODO: 열 추가 로직 구현 예정
        // 1. 현재 셀 column index 계산
        // 2. 각 row에 column 삽입
        // 3. state & UI 동기화

        console.log("[TableToolbar] addCol called", {
            tableId: tableEl.id,
            action
        });

        return true;
    }

    /**
     * 셀 병합
     */
    function mergeCells({ tableEl, rootEl, action, event }) {
        alert("기능 구현중");        
        if (!tableEl) return false;

        // TODO: 병합 로직 구현 예정
        // 1. 선택된 셀 범위 계산
        // 2. rowspan / colspan 모델 수정
        // 3. 불필요 셀 제거
        // 4. 부분 렌더링

        console.log("[TableToolbar] mergeCells called", {
            tableId: tableEl.id,
            action
        });

        return true;
    }

    /**
     * 테이블 삭제
     */
    function deleteTable({ tableEl, rootEl, action, event }) {
        alert("기능 구현중");        
        if (!tableEl) return false;

        // TODO: 테이블 삭제 로직 구현 예정
        // 1. 현재 activeKey 확인
        // 2. state에서 table chunk 제거
        // 3. 라인 재렌더링
        // 4. 커서 복원 처리

        console.log("[TableToolbar] deleteTable called", {
            tableId: tableEl.id,
            action
        });

        return true;
    }

    return {
        addRow,
        addCol,
        mergeCells,
        deleteTable
    };
}
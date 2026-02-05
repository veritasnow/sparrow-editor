/**
 * 활성 컨테이너(ID) 추출 및 분석 서비스
 */
export function createRangeService() {
    
    function applyVisualAndRangeSelection(selectedCells, normalized) {
        // 1. 먼저 같은 형제가 있는지 확인한다.
        //    형제가 있으면 유즈 비쥬얼, 없으면 스킵비쥬얼을 한다.

        console.log("selectedCells.length : ", selectedCells.length);
        console.log("selectedCells : ", selectedCells);

        if (!selectedCells || selectedCells.length === 0) {
            return; 
        }

        if (selectedCells.length > 0) {
            const firstCell = selectedCells[0];
            const firstMidName = firstCell.id.split('-')[1];
            const hasSameMidName = selectedCells.slice(1).some(td => td.id.split('-')[1] === firstMidName);

            console.log("hasSameMidName : ", hasSameMidName);

            selectedCells.forEach((td, idx) => {
                // 정방향(아래로)일 때만 부모 텍스트 살리기 적용
                if (idx === 0 && !hasSameMidName) {
                    td.selectionStatus = 'skip-visual'; 
                } else {
                    td.selectionStatus = 'use-visual';
                }
            });
        } 

        const isSkipVisual = selectedCells[0].selectionStatus === "skip-visual";
        console.log("isSkipVisual : ", isSkipVisual);
 
        if(isSkipVisual) {
            const targetTD = selectedCells[0];
            targetTD.classList.remove('is-selected', 'is-not-selected');

            if (normalized && normalized.ranges) {
                normalized.ranges.forEach(range => {
                    if (range.isTableLine) {
                        // 🔥 [수정] :scope > 를 사용하여 targetTD의 직계 자식 라인만 탐색
                        // 이렇게 해야 중첩된 테이블 내부의 라인을 건드리지 않습니다.
                        const lineEl = targetTD.querySelector(`:scope > [data-line-index="${range.lineIndex}"]`);
                        
                        if (lineEl) {
                            // 라인 자체가 테이블이거나, 내부에 테이블이 있는 경우
                            // .se-table 역시 직계 자식인 경우만 찾도록 제한하는 것이 안전합니다.
                            const childTable = lineEl.matches('.se-table') ? lineEl : lineEl.querySelector(':scope > .se-table');
                            
                            if (childTable) {
                                // 테이블 내부의 모든 셀에 is-selected 적용
                                // (이 부분은 하위의 모든 셀을 잡는 것이 의도라면 유지, 
                                // 직계 셀만 잡는 것이 의도라면 :scope 활용)
                                const subCells = childTable.querySelectorAll('.se-table-cell');
                                subCells.forEach(subCell => {
                                    subCell.classList.add('is-selected');
                                    subCell.classList.remove('is-not-selected');
                                });
                            }
                        }
                    }
                });
            }       
        } else {
            // 1. 현재 드래그 중인 레벨의 메인 테이블 찾기
            const table = selectedCells[0].closest('.se-table');
            if (!table) return;

            // 2. 해당 테이블의 모든 셀(직계)에 대해 상태 업데이트
            const allCellsInTable = table.querySelectorAll('.se-table-cell');
            
            allCellsInTable.forEach(td => {
                // [예외 가드] 해당 셀이 현재 테이블의 직계가 아니면 무시 (중첩 테이블 중복 처리 방지)
                if (td.closest('.se-table') !== table) return;

                // 선택 상태 결정
                const isTarget = selectedCells.includes(td);
                const shouldSkip = isTarget && td.selectionStatus === 'skip-visual';

                if (shouldSkip) {
                    // 텍스트 드래그 중인 셀은 블록 하이라이트 제거
                    td.classList.remove('is-selected', 'is-not-selected');
                } else if (isTarget) {
                    // [A] 부모 셀 선택
                    td.classList.add('is-selected');
                    td.classList.remove('is-not-selected');

                    // 🔥 [핵심] 부모가 선택되면 그 안의 모든 자식 테이블 셀들도 강제로 선택 처리
                    const nestedCells = td.querySelectorAll('.se-table-cell');
                    nestedCells.forEach(child => {
                        child.classList.add('is-selected');
                        child.classList.remove('is-not-selected');
                    });
                } else {
                    // [B] 선택되지 않은 셀은 비활성화
                    td.classList.remove('is-selected');
                    td.classList.add('is-not-selected');

                    // 부모가 해제되면 자식들도 해제
                    const nestedCells = td.querySelectorAll('.se-table-cell');
                    nestedCells.forEach(child => {
                        child.classList.remove('is-selected');
                        child.classList.add('is-not-selected');
                    });
                }
            });
        }
        // 2. skipVisual이라면 형제 td가 선택되지 않은 상태이다.



        console.log("selectedCells : ", selectedCells);
        console.log("normalized : ", normalized);
    }

    return { applyVisualAndRangeSelection };
}
// service/input/inputStateUtil.js
import { EditorLineModel, TextChunkModel } from '../../model/editorModel.js'; // 💡 Model 팩토리 임포트 가정

/**
 * 에디터의 입력(Input) 이벤트 발생 시, 다음 라인 상태를 계산하는 순수 도메인 로직입니다.
 * 이 함수는 Side Effect(상태 저장, DOM 렌더링)가 없어야 합니다.
 * * @param {Object} currentLine - 현재 에디터 상태의 라인 데이터
 * @param {Object} selectionContext - UI에서 파악한 선택 영역 및 DOM 정보
 * @param {Function} uiParseFunction - ui.parseParentPToChunks 함수 (DOM 파싱 로직)
 * @returns {{ updatedLine: Object, restoreData: Object|null, isNewChunk: boolean, isChunkRendering: boolean }}
 */
export function calculateNextLineState(currentLine, selectionContext, uiParseFunction) {
    const { 
        parentP, container, cursorOffset, activeNode, dataIndex, lineIndex
    } = selectionContext;

    // 💡 [수정] DTO 리터럴 대신 Model 팩토리를 사용하여 새로운 라인 인스턴스 생성
    //    currentLine의 align 속성을 유지하고 chunks는 깊은 복사
    let updatedLine = EditorLineModel(currentLine.align, [...currentLine.chunks]); 
    
    let isNewChunk       = false;
    let isChunkRendering = false;
    let restoreData      = null;

    // 1. 기존 [data-index] 텍스트 청크 업데이트 (가장 일반적인 경우)
    if (dataIndex !== null && updatedLine.chunks[dataIndex] && updatedLine.chunks[dataIndex].type === 'text') {
        const oldChunk = updatedLine.chunks[dataIndex];
        const newText  = activeNode.textContent; // DOM에서 텍스트 내용을 읽어옴

        if (oldChunk.text !== newText) {
            // 💡 [수정] 청크 업데이트 시 Model 팩토리를 사용하여 새 불변 청크 인스턴스 생성
            const newChunk = TextChunkModel(oldChunk.type, newText, oldChunk.style);
            
            // 청크 배열을 복사하여 불변성 유지
            const newChunks = [...updatedLine.chunks];
            newChunks[dataIndex] = newChunk;
            
            // 💡 [수정] 최종적으로 업데이트된 청크 배열로 새로운 라인 모델 생성
            updatedLine = EditorLineModel(updatedLine.align, newChunks); 
            
            isChunkRendering = true;
            restoreData = { lineIndex, chunkIndex: dataIndex, offset: cursorOffset };
        }
    } 
    // 2. 새로운 청크 추가 또는 청크 배열 재구성 (data-index 밖에서 입력 발생)
    else {
        // uiParseFunction 호출 (ui.parseParentPToChunks)
        const { newChunks, restoreData: newRestoreData } = uiParseFunction(
            parentP, currentLine.chunks, container, cursorOffset, lineIndex
        );
        
        restoreData = newRestoreData;

        // 청크 배열이 실제로 변경되었을 때만 업데이트
        if (JSON.stringify(newChunks) !== JSON.stringify(currentLine.chunks)) {
            // 💡 [수정] 새로운 청크 배열로 새로운 라인 모델 생성
            updatedLine = EditorLineModel(updatedLine.align, newChunks);
            isNewChunk = true; 
        }
    }

    // isNewChunk이면서 restoreData가 없을 경우 (라인 끝에 커서 복원)
    if (isNewChunk && !restoreData) {
        const lastChunk = updatedLine.chunks[updatedLine.chunks.length - 1];
        if (lastChunk && lastChunk.type === 'text') {
            restoreData = {
                lineIndex,
                chunkIndex: updatedLine.chunks.length - 1,
                offset: lastChunk.text.length
            };
        }
    }

    return { updatedLine, restoreData, isNewChunk, isChunkRendering };
}
import { EditorLineModel, TextChunkModel, VideoChunkModel } from '../../model/editorModel.js'; 
// ======================================================================
// 1. 유틸리티 함수: 청크 배열을 오프셋 기준으로 나누는 함수
// ======================================================================

/**
 * 청크 배열을 전체 텍스트 오프셋을 기준으로 두 부분으로 나눕니다.
 * @param {Array<Object>} chunks - 라인의 청크 배열
 * @param {number} offset - 전체 텍스트 기준 분할 위치
 * @returns {{beforeChunks: Array, afterChunks: Array}}
 */
function splitLineChunks(chunks, offset) {
    let currentOffset = 0;
    const beforeChunks = [];
    const afterChunks = [];
    let splitDone = false;

    for (const chunk of chunks) {
        if (chunk.type !== 'text') {
            // 비텍스트 청크는 분할 위치 전후에 그대로 유지 (참조 복사)
            if (!splitDone) {
                beforeChunks.push(chunk);
            } else {
                afterChunks.push(chunk);
            }
            continue;
        }

        const len = chunk.text.length;
        
        // 텍스트 청크 내 분할 지점 발견
        if (!splitDone && currentOffset + len >= offset) {
            const splitPoint = offset - currentOffset;
            
            // 텍스트 분리
            const textBefore = chunk.text.substring(0, splitPoint);
            const textAfter = chunk.text.substring(splitPoint);

            if (textBefore.length > 0) {
                // 💡 [수정] TextChunkModel을 사용하여 새 불변 인스턴스 생성
                beforeChunks.push(TextChunkModel(chunk.type, textBefore, chunk.style));
            }
            if (textAfter.length > 0) {
                // 💡 [수정] TextChunkModel을 사용하여 새 불변 인스턴스 생성
                afterChunks.push(TextChunkModel(chunk.type, textAfter, chunk.style));
            }
            
            splitDone = true;
            
        } else if (!splitDone) {
            // 분할 지점 전 (참조 복사)
            beforeChunks.push(chunk);
        } else {
            // 분할 지점 후 (참조 복사)
            afterChunks.push(chunk);
        }

        currentOffset += len;
    }

    // afterChunks가 비어있으면 커서 복원 가능하게 빈 텍스트 청크 추가
    if (afterChunks.length === 0) {
        // 💡 [수정] TextChunkModel을 사용하여 빈 청크 모델 생성
        afterChunks.push(TextChunkModel('text', '', {})); 
    }

    return { beforeChunks, afterChunks };
}


// ======================================================================
// 2. applyVideoBlock 함수
// ======================================================================
/**
 * 🎬 에디터 상태에 동영상 block을 현재 커서 위치 기준으로 삽입
 * @param {Array} editorState - 현재 에디터 상태
 * @param {string} videoId - 유튜브 ID
 * @param {number} currentLineIndex - 커서가 위치한 라인 인덱스
 * @param {number} cursorOffset - 커서가 위치한 라인 내의 총 텍스트 오프셋
 * @returns {{newState: Array, restoreLineIndex: number, restoreOffset: number}}
 */
export function applyVideoBlock(editorState, videoId, currentLineIndex, cursorOffset) {
    const newState = [...editorState]; // 상태 배열 얕은 복사
    const currentLine = editorState[currentLineIndex]; // 원본 라인 (수정하지 않음)

    // 1. 비디오 청크 모델 생성
    // 💡 [수정] VideoChunkModel 팩토리 함수 사용 (editorModel에서 임포트)
    const videoChunk = VideoChunkModel(videoId, `https://www.youtube.com/embed/${videoId}`);

    // 2. 텍스트 청크를 정확하게 분리하여 동영상 블록 삽입
    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);
    
    // 💡 추가된 로직: 현재 라인이 "완전히 비어있는" 상태로 판단될 경우 
    const isEffectivelyEmptyLine = beforeChunks.length === 0 && 
                                   afterChunks.length === 1 && 
                                   afterChunks[0].type === 'text' && 
                                   afterChunks[0].text === '';

    if (isEffectivelyEmptyLine) {
        // 빈 행을 동영상 블록으로 대체
        // 💡 [수정] EditorLineModel을 사용하여 새 라인 모델 생성
        const newVideoLine = EditorLineModel('center', [videoChunk]);
        newState[currentLineIndex] = newVideoLine; // 현재 행을 대체
        
        // 다음 작업을 위한 빈 라인 추가
        // 💡 [수정] EditorLineModel과 TextChunkModel을 사용하여 새 라인 모델 생성
        const nextLine = EditorLineModel('left', [TextChunkModel('text', '', {})]);
        newState.splice(currentLineIndex + 1, 0, nextLine);
        
        // 커서는 새로 추가된 빈 라인으로 이동
        return { newState, restoreLineIndex: currentLineIndex + 1, restoreOffset: 0 };

    } else {
        // 텍스트가 있거나 복잡한 청크가 있는 경우: 라인 분할
        
        // a. 기존 라인은 '이전 청크'만 가지도록 업데이트
        // 💡 [수정] EditorLineModel을 사용하여 새 라인 모델 생성
        const lineBefore = EditorLineModel(currentLine.align, beforeChunks);
        newState[currentLineIndex] = lineBefore;

        // b. 새 동영상 라인 삽입
        // 💡 [수정] EditorLineModel을 사용하여 새 라인 모델 생성
        const newVideoLine = EditorLineModel('center', [videoChunk]);
        newState.splice(currentLineIndex + 1, 0, newVideoLine);
        
        // c. '이후 청크'를 위한 새 라인 삽입
        // 💡 [수정] EditorLineModel을 사용하여 새 라인 모델 생성
        const lineAfter = EditorLineModel('left', afterChunks);
        newState.splice(currentLineIndex + 2, 0, lineAfter);
        
        // 커서는 '이후 청크'가 포함된 새 라인의 시작점 (0)으로 이동
        return { newState, restoreLineIndex: currentLineIndex + 2, restoreOffset: 0 };
    }
}


// ======================================================================
// 3. extractYouTubeId 함수 (수정 없음, 이관만)
// ======================================================================

/**
 * 🔍 유튜브 URL에서 videoId 추출 (모든 패턴 대응)
 */
export function extractYouTubeId(url) {
    // 유튜브 모든 형태 지원: watch?v=, embed/, shorts/, youtu.be/
    const regExp = /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    if (!match) return null;

    // ✅ videoId만 추출 (파라미터 제거)
    const videoId = match[1];
    return videoId;
}

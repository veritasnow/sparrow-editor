import { EditorLineModel} from '../../../model/editorLineModel.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js'; // 레지스트리 도입
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

// ======================================================================
// 2. applyVideoBlock (최종 리팩토링)
// ======================================================================

/**
 * 🎬 현재 커서 위치를 기준으로 동영상 블록 삽입
 * @param {Array} editorState - 현재 에디터 상태
 * @param {string} videoId - 유튜브 ID
 * @param {number} currentLineIndex - 커서가 위치한 라인 인덱스
 * @param {number} cursorOffset - 커서가 위치한 라인 내의 총 텍스트 오프셋
 * @returns {{newState: Array, restoreLineIndex: number, restoreOffset: number}}
 */
export function applyVideoBlock(editorState, videoId, currentLineIndex, cursorOffset) {
    const newState = [...editorState];
    const currentLine = editorState[currentLineIndex];
    const videoHandler = chunkRegistry.get('video');
    const videoChunk = videoHandler.create(videoId, `https://www.youtube.com/embed/${videoId}`);
    
    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);

    // 1) 빈 줄이든 아니든, 현재 라인에 비디오를 "포함"시키는 방향으로 통일
    // 이전 내용 + 비디오 + 이후 내용을 한 줄에 배치합니다.
    const cleanBefore = beforeChunks.filter(c => c.type !== 'text' || c.text !== '');
    const cleanAfter = afterChunks.filter(c => c.type !== 'text' || c.text !== '');

    // 만약 한 줄을 통째로 비디오로 만들고 싶다면 align을 center로, 
    // 글자와 섞인다면 기존 정렬 유지
    const newAlign = (cleanBefore.length === 0 && cleanAfter.length === 0) ? 'center' : currentLine.align;

    const mergedChunks = [...cleanBefore, videoChunk, ...cleanAfter];
    newState[currentLineIndex] = EditorLineModel(newAlign, mergedChunks);

    // 커서 위치: 비디오 바로 뒤
    const targetChunkIndex = cleanBefore.length + 1;

    return {
        newState,
        restoreLineIndex: currentLineIndex, // 🚩 인덱스 변화 없음!
        restoreChunkIndex: targetChunkIndex,
        restoreOffset: 0
    };
}

// ======================================================================
// 3. extractYouTubeId
// ======================================================================

/**
 * 🔍 유튜브 URL에서 videoId 추출
 */
export function extractYouTubeId(url) {
    const regExp =
        /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

    const match = url.match(regExp);
    if (!match) return null;

    return match[1];
}

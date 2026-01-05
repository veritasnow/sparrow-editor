import { EditorLineModel} from '../../../model/editorLineModel.js';
import { DEFAULT_LINE_STYLE } from '../../../constants/styleConstants.js';
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
    const textHandler = chunkRegistry.get('text');
    const videoChunk = videoHandler.create(videoId, `https://www.youtube.com/embed/${videoId}`);
    
    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);

    // 1) 빈 줄에 삽입하는 경우 (정리: 깔끔하게 비디오만 남기거나 다음 줄로 넘김)
    const isEmpty = (chunks) => chunks.length === 0 || (chunks.length === 1 && chunks[0].text === '');
    
    if (isEmpty(beforeChunks) && isEmpty(afterChunks)) {
        // 현재 라인은 비디오만 딱 하나! (앞뒤 "" 제거)
        newState[currentLineIndex] = EditorLineModel('center', [videoChunk]);

        // 다음 줄에 빈 입력창 제공
        const nextLine = EditorLineModel(DEFAULT_LINE_STYLE.align, [textHandler.create('', {})]);
        newState.splice(currentLineIndex + 1, 0, nextLine);

        return {
            newState,
            restoreLineIndex: currentLineIndex + 1,
            restoreChunkIndex: 0,
            restoreOffset: 0
        };
    }

    // 2) 텍스트 사이에 삽입하는 경우
    // 앞뒤에 내용이 있는 청크들만 필터링해서 합침
    const cleanBefore = beforeChunks.filter(c => c.type !== 'text' || c.text !== '');
    const cleanAfter = afterChunks.filter(c => c.type !== 'text' || c.text !== '');

    // 만약 뒤가 비어있다면 입력을 위해 빈 청크 하나 추가
    if (cleanAfter.length === 0) {
        cleanAfter.push(textHandler.create('', {}));
    }

    const mergedChunks = [...cleanBefore, videoChunk, ...cleanAfter];
    newState[currentLineIndex] = EditorLineModel(currentLine.align, mergedChunks);

    // 커서 위치: 비디오 바로 다음 청크
    const targetChunkIndex = cleanBefore.length + 1;

    return {
        newState,
        restoreLineIndex: currentLineIndex,
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

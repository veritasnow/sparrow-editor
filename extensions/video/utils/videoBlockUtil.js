import { EditorLineModel} from '../../../model/editorLineModel.js';
import { DEFAULT_LINE_STYLE } from '../../../constants/styleConstants.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js'; // 레지스트리 도입
import { splitLineChunks } from '../../utils/splitLineChunksUtils.js';

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

    const vidoeHandler  = chunkRegistry.get('video');     
    const videoChunk = vidoeHandler.create(videoId, `https://www.youtube.com/embed/${videoId}`)
    const { beforeChunks, afterChunks } = splitLineChunks(currentLine.chunks, cursorOffset);

    // -----------------------------------------------------------
    // 1) 완전히 비어 있는 라인은 "block" 형태로 동영상 삽입
    // -----------------------------------------------------------
    const isEmptyLine =
        beforeChunks.length === 0 &&
        afterChunks.length === 1 &&
        afterChunks[0].type === 'text' &&
        afterChunks[0].text === '';

    if (isEmptyLine) {
        // 현재 라인을 동영상 라인으로 대체
        const newVideoLine = EditorLineModel('center', [videoChunk]);
        newState[currentLineIndex] = newVideoLine;

        // 다음 줄에 빈 라인 생성
        const handler  = chunkRegistry.get('text');     
        const nextLine = EditorLineModel(DEFAULT_LINE_STYLE.align, [
            handler.create('', {})
        ]);
        newState.splice(currentLineIndex + 1, 0, nextLine);

        // 커서는 새 빈 라인
        return {
            newState,
            restoreLineIndex: currentLineIndex + 1,
            restoreOffset: 0
        };
    }

    // -----------------------------------------------------------
    // 2) 텍스트가 있는 라인은 "inline" 삽입
    //    같은 라인 안에 videoChunk를 넣고 라인을 나누지 않음
    // -----------------------------------------------------------
    const mergedChunks = [
        ...beforeChunks,
        videoChunk,
        ...afterChunks
    ];

    const newLine = EditorLineModel(currentLine.align, mergedChunks);
    newState[currentLineIndex] = newLine;

    // video 뒤의 커서 offset = beforeChunks 텍스트 길이 + 1(비디오)
    const beforeTextLength = beforeChunks.reduce((sum, chunk) => {
        return chunk.type === 'text' ? sum + chunk.text.length : sum;
    }, 0);

    return {
        newState,
        restoreLineIndex: currentLineIndex,
        restoreOffset: beforeTextLength + 1 // 비디오 다음 위치
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

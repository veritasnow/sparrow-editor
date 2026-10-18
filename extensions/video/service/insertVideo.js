
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

/**
 * 비디오 삽입 기능 생성
 */
export function createVideoInsert({ stateAPI, uiAPI, selectionAPI }) {
    function insertVideo(url, cursorPos) {
        if (!url) {
            alert('유튜브 URL을 입력하세요.');
            return false;
        }

        const videoId = extractYouTubeId(url);

        if (!videoId) {
            alert('올바른 유튜브 URL이 아닙니다.');
            return false;
        }

        // 1. 대상 컨테이너 확보
        const activeKey =
            selectionAPI.getActiveKey() ||
            selectionAPI.getLastActiveKey();

        if (!activeKey) return false;

        // 2. 현재 상태 가져오기
        const areaState = stateAPI.get(activeKey);

        if (!areaState || areaState.length === 0) return false;

        // 3. 삽입 위치 결정
        let pos = cursorPos || selectionAPI.getLastValidPosition();

        if (!pos) {
            const lastIdx = Math.max(0, areaState.length - 1);
            const lastLine = areaState[lastIdx];

            let offset = 0;

            if (lastLine) {
                for (const chunk of lastLine.chunks) {
                    offset += chunk.text?.length || 0;
                }
            }

            pos = {
                lineIndex: lastIdx,
                absoluteOffset: offset
            };
        }

        const { lineIndex, absoluteOffset } = pos;

        if (
            !Number.isInteger(lineIndex) ||
            lineIndex < 0 ||
            lineIndex >= areaState.length
        ) {
            return false;
        }

        // 4. 상태 변경 계산
        const result = buildVideoInsertion(
            areaState,
            videoId,
            lineIndex,
            absoluteOffset
        );

        if (!result) return false;

        const {
            newState,
            restoreLineIndex,
            restoreChunkIndex,
            restoreOffset
        } = result;

        // 5. 상태 저장
        stateAPI.save(activeKey, newState);

        const nextCursorPos = {
            containerId: activeKey,
            lineIndex: restoreLineIndex,
            anchor: {
                chunkIndex: restoreChunkIndex,
                type: 'text',
                offset: restoreOffset
            }
        };

        stateAPI.saveCursor(nextCursorPos);

        // 6. 변경된 라인만 렌더링
        uiAPI.renderLine(lineIndex, newState[lineIndex], {
            key: activeKey
        });

        // 7. 커서 복원
        requestAnimationFrame(() => {
            selectionAPI.restoreCursor(nextCursorPos);
        });

        return true;
    }

    return { insertVideo };
}

/**
 * 비디오 청크를 삽입한 새 상태를 계산한다.
 */
function buildVideoInsertion(
    areaState,
    videoId,
    currentLineIndex,
    cursorOffset
) {
    const currentLine = areaState[currentLineIndex];

    if (!currentLine) return null;

    const videoHandler = chunkRegistry.get('video');
    const textHandler = chunkRegistry.get('text');

    // 1. 비디오 청크 생성
    const videoChunk = videoHandler.create(
        videoId,
        `https://www.youtube.com/embed/${videoId}`
    );

    // 2. 커서 위치 기준으로 청크 분리
    const { beforeChunks, afterChunks } = splitLineChunks(
        currentLine.chunks,
        cursorOffset
    );

    // 3. 앞뒤 청크 유효성 검사
    const hasValidBefore =
        beforeChunks.length > 0 &&
        (
            beforeChunks.length > 1 ||
            beforeChunks[0].type !== 'text' ||
            beforeChunks[0].text !== ''
        );

    const hasValidAfter =
        afterChunks.length > 0 &&
        (
            afterChunks.length > 1 ||
            afterChunks[0].type !== 'text' ||
            afterChunks[0].text !== ''
        );

    const finalBefore = hasValidBefore ? beforeChunks : [];

    const finalAfter = hasValidAfter
        ? afterChunks
        : [textHandler.create('', { fontSize: '14px' })];

    // 4. 청크 조합 및 정렬 결정
    const mergedChunks = [
        ...finalBefore,
        videoChunk,
        ...finalAfter
    ];

    const newAlign =
        !hasValidBefore &&
        finalAfter.length === 1 &&
        finalAfter[0].text === ''
            ? 'center'
            : currentLine.align;

    // 5. 변경된 라인만 교체
    const newState = [...areaState];

    newState[currentLineIndex] = EditorLineModel(
        newAlign,
        mergedChunks
    );

    return {
        newState,
        restoreLineIndex: currentLineIndex,
        restoreChunkIndex: finalBefore.length + 1,
        restoreOffset: 0
    };
}

/**
 * 유튜브 URL에서 영상 ID를 추출한다.
 */
function extractYouTubeId(url) {
    if (!url) return null;

    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();

        let videoId = null;

        if (
            hostname === 'youtu.be' ||
            hostname === 'www.youtu.be'
        ) {
            videoId = parsedUrl.pathname.split('/').filter(Boolean)[0];
        } else if (
            hostname === 'youtube.com' ||
            hostname.endsWith('.youtube.com')
        ) {
            if (parsedUrl.pathname === '/watch') {
                videoId = parsedUrl.searchParams.get('v');
            } else {
                const match = parsedUrl.pathname.match(
                    /^\/(?:embed|live|shorts)\/([^/]+)/
                );

                videoId = match?.[1] || null;
            }
        }

        return videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)
            ? videoId
            : null;
    } catch {
        return null;
    }
}

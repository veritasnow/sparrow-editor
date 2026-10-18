
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { chunkRegistry } from '../../../core/chunk/chunkRegistry.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';

/**
 * 이미지 삽입 기능 생성
 * 에디터 인스턴스별 API를 주입받아 사용한다.
 */
export function createImageInsert({ stateAPI, uiAPI, selectionAPI }) {
    function insertImage(src) {
        if (!src) return false;

        // 1. 타겟 영역 확보
        const activeKey =
            selectionAPI.getActiveKey() ||
            selectionAPI.getLastActiveKey();

        if (!activeKey) return false;

        // 2. 상태 가져오기
        const areaState = stateAPI.get(activeKey);
        if (!areaState || areaState.length === 0) return false;

        // 3. 삽입 위치 결정
        let pos = selectionAPI.getLastValidPosition();

        if (!pos) {
            const lastLineIdx = Math.max(0, areaState.length - 1);

            pos = {
                lineIndex: lastLineIdx,
                absoluteOffset: areaState[lastLineIdx].chunks.reduce(
                    (sum, chunk) => sum + (chunk.text?.length || 0),
                    0
                )
            };
        }

        const { lineIndex } = pos;

        // 4. 이미지 블록 생성 및 상태 계산
        const {
            newState,
            restoreLineIndex,
            restoreChunkIndex,
            restoreOffset
        } = applyImageBlock(
            areaState,
            src,
            lineIndex,
            pos.absoluteOffset
        );

        // 유효한 삽입 결과인지 확인
        if (
            !newState ||
            restoreLineIndex == null ||
            restoreChunkIndex == null ||
            restoreOffset == null
        ) {
            return false;
        }

        // 5. UI 대상 확인
        if (!document.getElementById(activeKey)) return false;

        // 6. 변경된 상태 저장 및 UI 렌더링
        stateAPI.save(activeKey, newState);
        renderImage(newState, activeKey, lineIndex, uiAPI);

        // 7. 커서 위치 복원
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
        selectionAPI.restoreCursor(nextCursorPos);

        return true;
    }

    return { insertImage };
}

/**
 * 커서 위치에 이미지 청크를 삽입한 새 상태를 계산한다.
 */
function applyImageBlock(areaState, src, currentLineIndex, cursorOffset) {
    const currentLine = areaState[currentLineIndex];

    if (!currentLine) return null;

    const handler = chunkRegistry.get('image');
    const textHandler = chunkRegistry.get('text');
    const imageChunk = handler.create(src);

    // 1. 커서 기준으로 청크 분리
    const { beforeChunks, afterChunks } = splitLineChunks(
        currentLine.chunks,
        cursorOffset
    );

    // 2. 앞뒤 청크 유효성 검사
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

    // 3. 이미지 앞뒤 청크 조합
    const mergedChunks = [
        ...finalBefore,
        imageChunk,
        ...finalAfter
    ];

    // 이미지 외에 내용이 없는 라인은 중앙 정렬
    const newAlign =
        !hasValidBefore &&
        finalAfter.length === 1 &&
        finalAfter[0].text === ''
            ? 'center'
            : currentLine.align;

    // 4. 변경된 라인만 교체한 새 상태 생성
    const newState = [...areaState];

    newState[currentLineIndex] = EditorLineModel(
        newAlign,
        mergedChunks
    );

    // 5. 이미지 다음 텍스트 청크 위치
    const targetChunkIndex = finalBefore.length + 1;

    return {
        newState,
        restoreLineIndex: currentLineIndex,
        restoreChunkIndex: targetChunkIndex,
        restoreOffset: 0
    };
}

/**
 * 이미지 삽입 이후 변경된 라인들을 렌더링한다.
 */
function renderImage(newState, activeKey, lineIndex, uiAPI) {
    const container = document.getElementById(activeKey);

    if (!container) return false;

    // DOM 라인 개수 동기화
    uiAPI.syncParagraphCount?.(newState, activeKey);

    // 삽입 위치부터 이후 라인 렌더링
    for (let i = lineIndex; i < newState.length; i++) {
        const lineEl = container.children[i];

        // 기존 테이블 DOM 재사용을 위한 풀
        const tablePool = lineEl
            ? Array.from(lineEl.getElementsByClassName('chunk-table'))
            : [];

        uiAPI.renderLine(i, newState[i], {
            key: activeKey,
            pool: tablePool
        });
    }

    return true;
}

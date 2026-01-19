// /core/keyInput/serivce/keyCommonService.js
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { mergeChunks, splitChunkByOffset } from '../../../utils/mergeUtils.js';
import { chunkRegistry } from '../../chunk/chunkRegistry.js'; // 레지스트리 도입

// -----------------------------------------------------------------
// 🚀 공통 로직: Registry를 이용해 추상화된 복제
// -----------------------------------------------------------------
export function cloneChunk(chunk) {
    // Registry의 각 핸들러가 가진 clone 기능을 사용합니다.
    return chunkRegistry.get(chunk.type).clone(chunk);
}

// -----------------------------------------------------------------
// 🚀 공통 로직: 정규화
// -----------------------------------------------------------------
export function normalizeLineChunks(chunks) {
    // 1. 길이가 0인 텍스트 청크를 필터링 (단, 전체가 비었을 때는 제외)
    let filtered = chunks.filter(chunk => {
        if (chunk.type === 'text' && chunk.text === "") return false;
        return true;
    });

    // 2. 만약 모든 청크가 지워졌다면(완전 빈 줄), 기본 빈 청크 하나 생성
    if (filtered.length === 0) {
        return [chunkRegistry.get('text').create("", { fontSize: "14px" })];
    }

    // 3. 연속된 텍스트 청크 병합
    return mergeChunks(filtered.map(cloneChunk));
}

/**
 * 선택 영역(Range) 삭제 상태 계산
 */
export function calculateDeleteSelectionState(editorState, ranges) {
    const startRange = ranges[0];
    const endRange = ranges[ranges.length - 1];

    const { lineIndex: startLineIdx, startIndex: startOffset } = startRange;
    const { lineIndex: endLineIdx, endIndex: endOffset } = endRange;

    const newState = [...editorState];
    const startLine = editorState[startLineIdx];
    const endLine = editorState[endLineIdx];

    let beforeChunks = [];
    let afterChunks = [];

    // 시작 라인의 앞부분 수집
    let acc = 0;
    startLine.chunks.forEach(chunk => {
        const handler = chunkRegistry.get(chunk.type);
        const len = handler.getLength(chunk);
        if (acc + len <= startOffset) {
            beforeChunks.push(cloneChunk(chunk));
        } else if (acc < startOffset) {
            const { before } = splitChunkByOffset(chunk, startOffset - acc, len);
            beforeChunks.push(...before);
        }
        acc += len;
    });

    // 끝 라인의 뒷부분 수집
    acc = 0;
    endLine.chunks.forEach(chunk => {
        const handler = chunkRegistry.get(chunk.type);
        const len = handler.getLength(chunk);
        if (acc >= endOffset) {
            afterChunks.push(cloneChunk(chunk));
        } else if (acc < endOffset && acc + len > endOffset) {
            const { after } = splitChunkByOffset(chunk, 0, endOffset - acc);
            afterChunks.push(...after);
        }
        acc += len;
    });

    // 라인 합치기
    const finalChunks = normalizeLineChunks([...beforeChunks, ...afterChunks]);
    newState[startLineIdx] = EditorLineModel(startLine.align, finalChunks);

    // 사이 라인들 삭제
    const deleteCount = endLineIdx - startLineIdx;
    if (deleteCount > 0) {
        newState.splice(startLineIdx + 1, deleteCount);
    }

    // 커서는 선택 영역의 시작점에 위치
    return {
        newState,
        newPos: {
            lineIndex: startLineIdx,
            anchor: {
                chunkIndex: 0, // normalize 후 첫 번째 텍스트 청크일 확률이 높음 (추후 정교화 가능)
                type: 'text',
                offset: startOffset
            }
        },
        deletedLineIndex: deleteCount > 0 ? { start: startLineIdx + 1, count: deleteCount } : null,
        updatedLineIndex: startLineIdx
    };
}



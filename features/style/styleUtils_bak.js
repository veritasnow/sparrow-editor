// ───────── styleUtils.js ─────────
import { EditorLineModel } from '../../model/editorLineModel.js';
import { chunkRegistry } from '../../core/chunk/chunkRegistry.js'; // 레지스트리 도입
import { splitChunkByOffset, mergeChunks } from "../../utils/mergeUtils.js";

/**
 * 에디터 상태의 특정 범위(ranges)에 스타일 패치를 적용합니다.
 * @param {Array} editorState - 현재 에디터 전체 상태
 * @param {Array} ranges - 보정된 범위 객체 배열 ({ lineIndex, startIndex, endIndex, detail })
 * @param {Object} patch - 적용할 스타일 객체 (예: { fontWeight: 'bold' } 또는 { fontWeight: undefined })
 */
export function applyStylePatch(editorState, ranges, patch) {
    const newState = [...editorState];

    ranges.forEach(({ lineIndex, startIndex, endIndex }) => {
        const line = editorState[lineIndex];
        if (!line) return;

        let acc = 0; // 누적 논리적 오프셋 (비디오=1, 텍스트=N)
        const newChunks = [];

        line.chunks.forEach(chunk => {
            const handler = chunkRegistry.get(chunk.type);
            const chunkLen = handler.getLength(chunk); // ✨ 텍스트 길이나 블록(1)을 정확히 가져옴
            
            const chunkStart = acc;
            const chunkEnd   = acc + chunkLen;

            // 1. 영역 밖
            if (endIndex <= chunkStart || startIndex >= chunkEnd) {
                newChunks.push(chunk);
            } 
            // 2. 영역 안 (또는 걸쳐 있음)
            else {
                // 현재 청크 내부에서의 상대적 시작/끝 지점 계산
                const relativeStart = Math.max(0, startIndex - chunkStart);
                const relativeEnd = Math.min(chunkLen, endIndex - chunkStart);

                if (chunk.type === 'text') {
                    // 텍스트는 부분적으로 쪼개서 스타일 적용
                    const { before, target, after } = splitChunkByOffset(
                        chunk,
                        relativeStart,
                        relativeEnd
                    );

                    newChunks.push(...before);
                    target.forEach(t => {
                        const newStyle = { ...t.style, ...patch };
                        // undefined 필드 제거 (토글 기능 대응)
                        Object.keys(newStyle).forEach(k => newStyle[k] === undefined && delete newStyle[k]);
                        newChunks.push(handler.create(t.text, newStyle));
                    });
                    newChunks.push(...after);
                } 
                else {
                    // 비디오/테이블 등 비텍스트 블록은 쪼갤 수 없으므로 통째로 스타일(또는 속성) 업데이트
                    const newStyle = { ...chunk.style, ...patch };
                    Object.keys(newStyle).forEach(k => newStyle[k] === undefined && delete newStyle[k]);
                    newChunks.push({ ...chunk, style: newStyle });
                }
            }
            acc += chunkLen; // 다음 청크를 위해 논리적 길이 누적
        });

        // 병합 처리를 통해 쪼개진 청크들(같은 스타일)을 하나로 합침
        newState[lineIndex] = EditorLineModel(line.align, mergeChunks(newChunks));
    });

    return newState;
}

export function toggleInlineStyle(editorState, ranges, styleKey, styleValue) {
    let allApplied = true;

    ranges.forEach(({ lineIndex, startIndex, endIndex }) => {
        const line = editorState[lineIndex];
        if (!line) return;

        let acc = 0;
        for (const chunk of line.chunks) {
            const handler = chunkRegistry.get(chunk.type);
            const chunkLen = handler.getLength(chunk);
            const chunkStart = acc;
            const chunkEnd = acc + chunkLen;

            if (endIndex > chunkStart && startIndex < chunkEnd) {
                // 선택 영역에 포함된 청크 중 하나라도 스타일이 없으면 false
                if (!(chunk.style && chunk.style[styleKey] === styleValue)) {
                    allApplied = false;
                }
            }
            acc += chunkLen;
        }
    });

    const patch = allApplied
        ? { [styleKey]: undefined } 
        : { [styleKey]: styleValue };

    return applyStylePatch(editorState, ranges, patch);
}
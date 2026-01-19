// ───────── styleUtils.js ─────────
import { EditorLineModel } from '../../model/editorLineModel.js';
import { chunkRegistry } from '../../core/chunk/chunkRegistry.js';
import { splitChunkByOffset, normalizeLineChunks } from "../../utils/mergeUtils.js";
/**
 * 에디터 상태(특정 영역의 line 배열)의 특정 범위에 스타일을 적용합니다.
 */
export function applyStylePatch(areaState, ranges, patch) {
    // areaState는 이제 전체가 아닌 본문 혹은 TD의 [Line, Line...] 배열입니다.
    const newState = [...areaState];

    ranges.forEach(({ lineIndex, startIndex, endIndex }) => {
        const line = areaState[lineIndex];
        if (!line) return;

        let acc = 0; 
        const newChunks = [];

        line.chunks.forEach(chunk => {
            const handler = chunkRegistry.get(chunk.type);
            const chunkLen = handler.getLength(chunk); 
            
            const chunkStart = acc;
            const chunkEnd   = acc + chunkLen;

            // 1. 선택 영역 밖: 그대로 유지
            if (endIndex <= chunkStart || startIndex >= chunkEnd) {
                newChunks.push(chunk);
            } 
            // 2. 선택 영역 안 (또는 걸쳐 있음)
            else {
                const relativeStart = Math.max(0, startIndex - chunkStart);
                const relativeEnd = Math.min(chunkLen, endIndex - chunkStart);

                if (chunk.type === 'text') {
                    // 텍스트는 필요한 부분만 쪼개서 스타일 적용
                    const { before, target, after } = splitChunkByOffset(
                        chunk,
                        relativeStart,
                        relativeEnd
                    );

                    newChunks.push(...before);
                    target.forEach(t => {
                        const newStyle = { ...t.style, ...patch };
                        // undefined 필드 제거 (토글 시 스타일 삭제 대응)
                        Object.keys(newStyle).forEach(k => {
                            if (newStyle[k] === undefined) delete newStyle[k];
                        });
                        newChunks.push(handler.create(t.text, newStyle));
                    });
                    newChunks.push(...after);
                } 
                else {
                    // 비텍스트(이미지/비디오/테이블)는 통째로 스타일 적용
                    const newStyle = { ...chunk.style, ...patch };
                    Object.keys(newStyle).forEach(k => {
                        if (newStyle[k] === undefined) delete newStyle[k];
                    });
                    newChunks.push({ ...chunk, style: newStyle });
                }
            }
            acc += chunkLen;
        });

        // 같은 스타일을 가진 텍스트 청크끼리 다시 합쳐서 최적화
        newState[lineIndex] = EditorLineModel(line.align, normalizeLineChunks(newChunks));
    });

    return newState;
}

/**
 * 선택 영역에 스타일이 모두 적용되어 있으면 제거(토글 Off), 아니면 적용(토글 On)
 */
export function toggleInlineStyle(areaState, ranges, styleKey, styleValue) {
    let allApplied = true;

    ranges.forEach(({ lineIndex, startIndex, endIndex }) => {
        const line = areaState[lineIndex];
        if (!line) return;

        let acc = 0;
        for (const chunk of line.chunks) {
            const handler = chunkRegistry.get(chunk.type);
            const chunkLen = handler.getLength(chunk);
            const chunkStart = acc;
            const chunkEnd = acc + chunkLen;

            // 선택 영역과 겹치는 청크 검사
            if (endIndex > chunkStart && startIndex < chunkEnd) {
                // 하나라도 해당 스타일이 적용 안 되어 있다면 토글 On 모드로 결정
                if (!(chunk.style && chunk.style[styleKey] === styleValue)) {
                    allApplied = false;
                }
            }
            acc += chunkLen;
        }
    });

    const patch = allApplied
        ? { [styleKey]: undefined } // 이미 다 적용됐으면 제거
        : { [styleKey]: styleValue }; // 하나라도 안 됐으면 적용

    return applyStylePatch(areaState, ranges, patch);
}
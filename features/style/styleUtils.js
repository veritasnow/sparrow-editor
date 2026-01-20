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
                    // 비텍스트(이미지/비디오/테이블) 처리
                    const newStyle = { ...chunk.style, ...patch };
                    Object.keys(newStyle).forEach(k => {
                        // patch에서 넘어온 값이 undefined이면 해당 스타일 키 삭제
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
    let hasCheckableContent = false; // 실제로 체크한 대상이 있는지 확인

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
                // 💡 핵심 수정: 스타일 토글 여부는 'text' 청크를 기준으로 판단하는 것이 일반적입니다.
                // 이미지나 동영상은 스타일Key가 없을 가능성이 높으므로 체크에서 제외하거나 스킵합니다.
                if (chunk.type === 'text') {
                    hasCheckableContent = true; 
                    if (!(chunk.style && chunk.style[styleKey] === styleValue)) {
                        allApplied = false;
                    }
                }
                // 이미지/비디오에도 스타일 토글을 적용할 경우 아래 조건을 추가
                // else if (chunk.type === 'image' || chunk.type === 'video') { ... }
            }
            acc += chunkLen;
        }
    });

    // 만약 선택 영역에 텍스트가 하나도 없고 이미지만 있다면? 
    // 기본적으로 적용(On) 모드로 작동하게 하거나 상황에 맞게 처리
    const patch = (allApplied && hasCheckableContent)
        ? { [styleKey]: undefined } // 모두 적용되어 있으면 제거
        : { [styleKey]: styleValue }; // 하나라도 안 되어 있으면 적용

    return applyStylePatch(areaState, ranges, patch);
}
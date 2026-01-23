// ───────── styleUtils.js ─────────
import { EditorLineModel } from '../../model/editorLineModel.js';
import { chunkRegistry } from '../../core/chunk/chunkRegistry.js';
import { splitChunkByOffset, normalizeLineChunks } from "../../utils/mergeUtils.js";

/**
 * [최적화 포인트]
 * 1. map/forEach 대신 for-loop 사용 (대용량 청크 처리 속도 향상)
 * 2. 스타일 패치 시 불필요한 Object.keys 순회 제거
 * 3. 변경이 없는 라인은 기존 객체를 그대로 반환 (Referential Integrity)
 */
export function applyStylePatch(areaState, ranges, patch) {
    let hasGlobalChange = false;
    const newState = [...areaState];

    // 1. 패치 객체 정규화 (undefined 미리 필터링)
    const patchKeys = Object.keys(patch);
    const cleanPatch = {};
    const removeKeys = [];
    
    for (const k of patchKeys) {
        if (patch[k] === undefined) removeKeys.push(k);
        else cleanPatch[k] = patch[k];
    }

    // 2. 범위 순회
    for (const range of ranges) {
        const { lineIndex, startIndex, endIndex } = range;
        const line = areaState[lineIndex];
        if (!line) continue;

        let acc = 0;
        let lineChanged = false;
        const newChunks = [];

        for (let i = 0; i < line.chunks.length; i++) {
            const chunk = line.chunks[i];
            const handler = chunkRegistry.get(chunk.type);
            const chunkLen = handler.getLength(chunk);
            const chunkEnd = acc + chunkLen;

            // 선택 영역 밖: 참조 유지
            if (endIndex <= acc || startIndex >= chunkEnd) {
                newChunks.push(chunk);
            } 
            // 선택 영역 안 또는 걸침
            else {
                lineChanged = true;
                const relativeStart = Math.max(0, startIndex - acc);
                const relativeEnd = Math.min(chunkLen, endIndex - acc);

                if (chunk.type === 'text') {
                    const { before, target, after } = splitChunkByOffset(chunk, relativeStart, relativeEnd);
                    
                    newChunks.push(...before);
                    for (const t of target) {
                        // 스타일 병합 최적화
                        const newStyle = { ...t.style, ...cleanPatch };
                        for (const rk of removeKeys) delete newStyle[rk];
                        
                        newChunks.push(handler.create(t.text, newStyle));
                    }
                    newChunks.push(...after);
                } else {
                    const newStyle = { ...chunk.style, ...cleanPatch };
                    for (const rk of removeKeys) delete newStyle[rk];
                    newChunks.push({ ...chunk, style: newStyle });
                }
            }
            acc = chunkEnd;
        }

        if (lineChanged) {
            newState[lineIndex] = EditorLineModel(line.align, normalizeLineChunks(newChunks));
            hasGlobalChange = true;
        }
    }

    return hasGlobalChange ? newState : areaState;
}

/**
 * [최적화 포인트]
 * 1. Early Exit: 루프 도중 '모두 적용되지 않음'이 판명되면 즉시 중단
 */
export function toggleInlineStyle(areaState, ranges, styleKey, styleValue) {
    let allApplied = true;
    let hasCheckableContent = false;

    // 분석 단계: 통일성 확인 (Early Exit 적용)
    checkLoop: for (const range of ranges) {
        const line = areaState[range.lineIndex];
        if (!line) continue;

        let acc = 0;
        for (const chunk of line.chunks) {
            const handler = chunkRegistry.get(chunk.type);
            const chunkLen = handler.getLength(chunk);
            const chunkEnd = acc + chunkLen;

            if (range.endIndex > acc && range.startIndex < chunkEnd) {
                if (chunk.type === 'text') {
                    hasCheckableContent = true;
                    // 하나라도 스타일이 다르면 즉시 전체 루프 종료 (성능 핵심)
                    if (!(chunk.style && chunk.style[styleKey] === styleValue)) {
                        allApplied = false;
                        break checkLoop; 
                    }
                }
            }
            acc = chunkEnd;
            if (acc >= range.endIndex) break;
        }
    }

    const patch = (allApplied && hasCheckableContent)
        ? { [styleKey]: undefined }
        : { [styleKey]: styleValue };

    return applyStylePatch(areaState, ranges, patch);
}
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

    ranges.forEach((range) => {
        const { lineIndex, detail } = range;
        // 🚀 [수정] 역전된 인덱스 방지 (보정)
        const startIndex = Math.min(range.startIndex, range.endIndex);
        const endIndex = Math.max(range.startIndex, range.endIndex);
        
        const line = editorState[lineIndex];
        if (!line) return;

        let acc = 0;
        const nextChunks = [];

        line.chunks.forEach(chunk => {
            const handler = chunkRegistry.get(chunk.type);
            const chunkLen = handler.getLength(chunk);
            const chunkStart = acc;
            const chunkEnd = acc + chunkLen;

            const isTableTarget = chunk.type === 'table' && detail && typeof detail.rowIndex === 'number';

            if (!isTableTarget && (endIndex <= chunkStart || startIndex >= chunkEnd)) {
                nextChunks.push(chunk);
            } 
            else if (isTableTarget) {
                // 테이블 데이터 깊은 복사
                const newData = chunk.data.map(row => row.map(cell => ({ 
                    ...cell,
                    chunks: cell.chunks ? cell.chunks.map(c => ({...c})) : (cell.text ? [{text: cell.text, style: cell.style || {}}] : [])
                })));

                const targetCell = newData[detail.rowIndex][detail.colIndex];
                
                // 🚀 [수정] cellOffset이 있다면 이를 기준으로 범위를 다시 잡습니다.
                const targetStart = detail.cellOffset;
                const targetEnd = targetStart + Math.abs(range.endIndex - range.startIndex); // 절대값으로 길이 계산

                let currentPos = 0;
                const updatedCellChunks = [];

                targetCell.chunks.forEach(subChunk => {
                    const subLen = subChunk.text.length;
                    const subStart = currentPos;
                    const subEnd = currentPos + subLen;

                    // 겹치지 않는 경우
                    if (targetEnd <= subStart || targetStart >= subEnd) {
                        updatedCellChunks.push(subChunk);
                    } 
                    // 겹치는 경우 분할 처리
                    else {
                        const relStart = Math.max(0, targetStart - subStart);
                        const relEnd = Math.min(subLen, targetEnd - subStart);

                        const b = subChunk.text.substring(0, relStart);
                        const t = subChunk.text.substring(relStart, relEnd);
                        const a = subChunk.text.substring(relEnd);

                        if (b) updatedCellChunks.push({ text: b, style: { ...subChunk.style } });
                        if (t) {
                            const mergedStyle = { ...subChunk.style, ...patch };
                            // undefined인 경우 스타일 삭제 처리
                            Object.keys(mergedStyle).forEach(k => { if (mergedStyle[k] === undefined) delete mergedStyle[k]; });
                            updatedCellChunks.push({ text: t, style: mergedStyle, type: 'text' });
                        }
                        if (a) updatedCellChunks.push({ text: a, style: { ...subChunk.style } });
                    }
                    currentPos += subLen;
                });

                // 셀 데이터 병합 및 정리
                targetCell.chunks = mergeChunks(updatedCellChunks.map(c => ({...c, type: 'text'})));
                targetCell.text = undefined;
                targetCell.style = {}; 

                nextChunks.push({ ...chunk, data: newData });
            } 
            else if (chunk.type === 'text') {
                const relativeStart = Math.max(0, startIndex - chunkStart);
                const relativeEnd = Math.min(chunkLen, endIndex - chunkStart);
                const { before, target, after } = splitChunkByOffset(chunk, relativeStart, relativeEnd);
                
                nextChunks.push(...before);
                target.forEach(t => {
                    const newStyle = { ...(t.style || {}), ...patch };
                    Object.keys(newStyle).forEach(k => { if (newStyle[k] === undefined) delete newStyle[k]; });
                    nextChunks.push(handler.create(t.text, newStyle));
                });
                nextChunks.push(...after);
            }
            acc += chunkLen;
        });

        newState[lineIndex] = EditorLineModel(line.align, mergeChunks(nextChunks));
    });

    return newState;
}
/*
표 작업후
export function applyStylePatch(editorState, ranges, patch) {
    const newState = [...editorState];

    ranges.forEach(({ lineIndex, startIndex, endIndex, detail }) => {
        const line = editorState[lineIndex];
        if (!line) return;

        let acc = 0; 
        const newChunks = [];

        line.chunks.forEach(chunk => {
            const handler = chunkRegistry.get(chunk.type);
            const chunkLen = handler.getLength(chunk);
            const chunkStart = acc;
            const chunkEnd = acc + chunkLen;

            if (endIndex <= chunkStart || startIndex >= chunkEnd) {
                newChunks.push(chunk);
            } 
            else {
                // ✅ [A] 테이블 정밀 타격 (최우선순위)
                // detail이 존재하고, 현재 처리 중인 청크가 테이블인 경우
                if (chunk.type === 'table' && detail && typeof detail.rowIndex === 'number') {
                    console.log('[applyStylePatch] 테이블 셀 타격 시작:', detail);
                    
                    const newData = chunk.data.map(row => 
                        row.map(cell => ({ 
                            ...cell, 
                            style: { ...(cell.style || {}) } 
                        }))
                    );

                    const targetCell = newData[detail.rowIndex][detail.colIndex];
                    const newStyle = { ...(targetCell.style || {}), ...patch };
                    
                    Object.keys(newStyle).forEach(k => {
                        if (newStyle[k] === undefined) delete newStyle[k];
                    });

                    newData[detail.rowIndex][detail.colIndex] = {
                        ...targetCell,
                        style: newStyle
                    };

                    // 중요: 테이블 전체 style은 건드리지 않고 data만 교체
                    newChunks.push({ ...chunk, data: newData });
                } 
                // [B] 텍스트 청크 처리
                else if (chunk.type === 'text') {
                    const relativeStart = Math.max(0, startIndex - chunkStart);
                    const relativeEnd = Math.min(chunkLen, endIndex - chunkStart);
                    const { before, target, after } = splitChunkByOffset(chunk, relativeStart, relativeEnd);

                    newChunks.push(...before);
                    target.forEach(t => {
                        const newStyle = { ...(t.style || {}), ...patch };
                        Object.keys(newStyle).forEach(k => { if (newStyle[k] === undefined) delete newStyle[k]; });
                        newChunks.push(handler.create(t.text, newStyle));
                    });
                    newChunks.push(...after);
                } 
                // [C] 기타 Atomic (이미지 등)
                else {
                    // 테이블인데 detail이 없는 경우 혹은 진짜 다른 블록인 경우
                    const newStyle = { ...(chunk.style || {}), ...patch };
                    Object.keys(newStyle).forEach(k => { if (newStyle[k] === undefined) delete newStyle[k]; });
                    newChunks.push({ ...chunk, style: newStyle });
                }
            }
            acc += chunkLen;
        });

        newState[lineIndex] = EditorLineModel(line.align, mergeChunks(newChunks));
    });

    return newState;
}
*/

/*
백업 - 표작업 전

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
*/

/**
 * 토글 체크 시에도 동일하게 getLength 적용
 */
// styleUtils.js
export function toggleInlineStyle(editorState, ranges, styleKey, styleValue) {
    let allApplied = true;

    ranges.forEach(({ lineIndex, startIndex, endIndex, detail }) => {
        const line = editorState[lineIndex];
        if (!line) return;

        // 1. 테이블 셀 내부인 경우 (가장 우선 처리)
        if (detail && typeof detail.rowIndex === 'number') {
            const tableChunk = line.chunks[detail.chunkIndex || 0];
            if (!tableChunk || tableChunk.type !== 'table') return;

            const cell = tableChunk.data[detail.rowIndex][detail.colIndex];
            let currentStyle = {};

            if (cell.chunks && cell.chunks.length > 0) {
                // 사용자가 선택한 cellOffset 위치의 조각 스타일 확인
                const cellOffset = detail.cellOffset ?? 0;
                let cellAcc = 0;
                let found = false;

                for (const sub of cell.chunks) {
                    const subLen = sub.text.length;
                    if (cellOffset >= cellAcc && cellOffset < cellAcc + subLen) {
                        currentStyle = sub.style || {};
                        found = true;
                        break;
                    }
                    cellAcc += subLen;
                }
                if (!found) currentStyle = cell.chunks[0].style || {};
            } else {
                currentStyle = cell.style || {};
            }

            // 비교 로그 (여기서 undefined vs 'bold' 인지 확인 가능)
            console.log(`[Table Check] 셀 내부 스타일[${styleKey}]:`, currentStyle[styleKey], " / 목표값:", styleValue);

            if (currentStyle[styleKey] !== styleValue) {
                allApplied = false;
            }
        } 
        // 2. 일반 텍스트 라인인 경우
        else {
            let acc = 0;
            line.chunks.forEach(chunk => {
                const chunkLen = chunkRegistry.get(chunk.type).getLength(chunk);
                const chunkStart = acc;
                const chunkEnd = acc + chunkLen;

                if (endIndex > chunkStart && startIndex < chunkEnd) {
                    const currentStyle = chunk.style || {};
                    if (currentStyle[styleKey] !== styleValue) {
                        allApplied = false;
                    }
                }
                acc += chunkLen;
            });
        }
    });

    const patch = allApplied
        ? { [styleKey]: undefined } 
        : { [styleKey]: styleValue };

    console.log(`[toggleInlineStyle] 최종 결정: allApplied=${allApplied}, patch=`, patch);

    return applyStylePatch(editorState, ranges, patch);
}

/*
이전버전2
export function toggleInlineStyle(editorState, ranges, styleKey, styleValue) {
    let allApplied = true;

    ranges.forEach(({ lineIndex, startIndex, endIndex, detail }) => {
        const line = editorState[lineIndex];
        if (!line) return;

        let acc = 0;
        for (const chunk of line.chunks) {
            const handler = chunkRegistry.get(chunk.type);
            const chunkLen = handler.getLength(chunk);
            const chunkStart = acc;
            const chunkEnd = acc + chunkLen;

            if (endIndex > chunkStart && startIndex < chunkEnd) {
                // ✅ 테이블이면 해당 셀의 스타일을 정확히 체크
                let currentStyle = chunk.style;
                if (chunk.type === 'table' && detail && detail.rowIndex !== undefined) {
                    const cell = chunk.data[detail.rowIndex][detail.colIndex];
                    currentStyle = cell.style || {};
                }

                if (!(currentStyle && currentStyle[styleKey] === styleValue)) {
                    allApplied = false;
                }
            }
            acc += chunkLen;
        }
    });

    const patch = allApplied
        ? { [styleKey]: undefined } 
        : { [styleKey]: styleValue };

    // 여기서 ranges(detail 포함)와 함께 다시 applyStylePatch로 갑니다.
    return applyStylePatch(editorState, ranges, patch);
}
*/



/*
이전버전1
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
*/
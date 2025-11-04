import { mergeSameStyleBlocks } from "../../utils/mergeUtils.js";
import { EditorLineModel, TextChunkModel } from '../../model/editorModel.js'; 

// ───────── 선택 영역에 스타일 patch 적용 ─────────
/**
 * 선택 영역에 스타일 패치(patch)를 적용하여 새로운 에디터 상태를 생성합니다. (순수 함수)
 */
export function applyInlineStyle(editorState, ranges, patch, defaultChunkProps = { type: 'text' }) {
    // 💡 [수정] 최상위 상태 배열만 얕게 복사하여 불변성을 확보
    const newState = editorState.slice(); 

    ranges.forEach(({ lineIndex, startIndex, endIndex }) => {
        const line = editorState[lineIndex]; // 원본 라인 모델 사용
        if (!line) return;

        let charCount = 0;
        const newChunks = []; // 새로운 청크 배열

        line.chunks.forEach(chunk => {
            const chunkStart = charCount;
            const chunkEnd = charCount + chunk.text.length;

            // 1. 선택 영역 밖의 청크 (그대로 재사용)
            if (endIndex <= chunkStart || startIndex >= chunkEnd) {
                newChunks.push(chunk);
            } else {
                // 2. 선택 영역 내부 청크 (분할 및 스타일 적용)
                const beforeText = chunk.text.slice(0, Math.max(0, startIndex - chunkStart));
                const targetText = chunk.text.slice(
                    Math.max(0, startIndex - chunkStart),
                    Math.min(chunk.text.length, endIndex - chunkStart)
                );
                const afterText = chunk.text.slice(Math.min(chunk.text.length, endIndex - chunkStart));

                // A. 이전 텍스트 (스타일 유지)
                if (beforeText) {
                    // 💡 [수정] TextChunkModel을 사용해 불변 인스턴스 생성
                    newChunks.push(TextChunkModel(chunk.type, beforeText, chunk.style));
                }
                
                // B. 대상 텍스트 (스타일 적용)
                if (targetText) {
                    const newStyle = { ...chunk.style, ...patch };
                    // undefined/null 값은 스타일에서 제거 (토글 해제 시)
                    Object.keys(newStyle).forEach(key => newStyle[key] === undefined && delete newStyle[key]);

                    // 💡 [수정] TextChunkModel을 사용해 새 스타일이 적용된 불변 인스턴스 생성
                    newChunks.push(TextChunkModel(
                        defaultChunkProps.type, 
                        targetText, 
                        newStyle
                    ));
                }
                
                // C. 이후 텍스트 (스타일 유지)
                if (afterText) {
                    // 💡 [수정] TextChunkModel을 사용해 불변 인스턴스 생성
                    newChunks.push(TextChunkModel(chunk.type, afterText, chunk.style));
                }
            }
            charCount += chunk.text.length;
        });

        // 3. 청크 배열 병합 및 라인 객체 교체
        const mergedChunks = mergeSameStyleBlocks(newChunks);
        
        // 💡 [수정] EditorLineModel을 사용해 새로운 불변 라인 객체 생성 및 상태 배열에 교체
        newState[lineIndex] = EditorLineModel(line.align, mergedChunks);
    });

    return newState;
}

// ───────── 토글 스타일 적용 ─────────
export function toggleInlineStyle(editorState, ranges, styleKey, styleValue, defaultChunkProps = { type: 'text' }) {
    let allApplied = true;

    // ... (적용 여부 확인 로직은 DTO를 생성하지 않으므로 그대로 유지) ...
    ranges.forEach(({ lineIndex, startIndex, endIndex }) => {
        const line = editorState[lineIndex];
        if (!line) return;

        let charCount = 0;
        line.chunks.forEach(chunk => {
            const chunkStart = charCount;
            const chunkEnd   = charCount + chunk.text.length;

            if (endIndex > chunkStart && startIndex < chunkEnd) {
                if (!(chunk.style && chunk.style[styleKey] === styleValue)) {
                    allApplied = false;
                }
            }
            charCount += chunk.text.length;
        });
    });

    const patch = allApplied
        ? { [styleKey]: undefined }   // 이미 적용되어 있으면 제거
        : { [styleKey]: styleValue }; // 아니면 적용

    // applyInlineStyle 함수가 이제 Model 기반의 새로운 상태를 반환
    return applyInlineStyle(editorState, ranges, patch, defaultChunkProps);
}

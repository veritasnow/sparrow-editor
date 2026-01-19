// /core/keyInput/processors/keyPasteProcessors.js
import { HtmlDeserializer } from '../../convert/HtmlDeserializer.js';
import { EditorLineModel} from '../../../model/editorLineModel.js';
import { mergeChunks} from '../../../utils/mergeUtils.js';
import { splitLineChunks } from '../../../utils/splitLineChunksUtils.js';


/**
 * 붙여넣기 실행 핵심 프로세서
 */
export function executePaste(e, { state, ui, domSelection }) {
    e.preventDefault();
    const activeKey = domSelection.getActiveKey();
    if (!activeKey) return;

    // 1. 데이터 가져오기 및 컨버팅
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    let { mainLines, additionalState } = html 
        ? HtmlDeserializer.deserialize(html)
        : { 
            mainLines: text.split(/\r?\n/).map(t => EditorLineModel('left', [TextChunkModel('text', t)])),
            additionalState: {} 
          };

    // 2. 현재 상태와 커서 위치 파악
    const currentLines = [...state.get(activeKey)];
    const domRanges = domSelection.getDomSelection(activeKey);
    const { lineIndex, endIndex: offset } = domRanges[0];
    const targetLine = currentLines[lineIndex];

    // 3. 현재 라인을 커서 기준으로 분할
    const { left, right } = splitLineAtOffset(targetLine, offset);

    // 4. 새로운 라인들 병합 구성
    const newLines = [];
    
    if (mainLines.length === 1) {
        // 단일 라인 붙여넣기: [왼쪽] + [중간] + [오른쪽]을 한 줄로 합침
        const combined = [...left.chunks, ...mainLines[0].chunks, ...right.chunks];
        newLines.push(EditorLineModel(left.align, mergeChunks(combined)));
    } else {
        // 다중 라인 붙여넣기
        // 첫 줄: 기존 왼쪽 + 복사된 첫 줄
        newLines.push(EditorLineModel(left.align, mergeChunks([...left.chunks, ...mainLines[0].chunks])));
        
        // 중간 줄들: 그대로 추가
        if (mainLines.length > 2) {
            newLines.push(...mainLines.slice(1, -1));
        }
        
        // 마지막 줄: 복사된 마지막 줄 + 기존 오른쪽
        const lastPasted = mainLines[mainLines.length - 1];
        newLines.push(EditorLineModel(lastPasted.align, mergeChunks([...lastPasted.chunks, ...right.chunks])));
    }

    // 5. 최종 상태 조립
    const nextState = [
        ...currentLines.slice(0, lineIndex),
        ...newLines,
        ...currentLines.slice(lineIndex + 1)
    ];

    // 6. 데이터 저장
    state.save(activeKey, nextState);
    
    // 테이블 셀 등 추가 데이터 저장
    Object.entries(additionalState).forEach(([cellId, content]) => {
        state.save(cellId, content);
    });

    // 7. 렌더링
    ui.render(nextState, activeKey);
    
    // 💡 다음 스텝: 붙여넣기 후 커서를 마지막 위치로 이동시키는 로직 호출 가능
    // focusAtLastPasted(domSelection, lineIndex, newLines);
}


/**
 * 라인 모델을 분할하여 두 개의 라인 객체로 반환 (Paste, Enter 등에서 사용)
 */
function splitLineAtOffset(line, offset) {
    const { beforeChunks, afterChunks } = splitLineChunks(line.chunks, offset);

    return {
        left: EditorLineModel(line.align, beforeChunks),
        right: EditorLineModel(line.align, afterChunks)
    };
}
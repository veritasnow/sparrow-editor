// factory/editorBootstrapFactory.js
import { createDOMCreateService } from '../features/domCreateService.js';
import { createEditorApp } from '../modules/state/application/editorApplication.js';
import { EditorLineModel } from '../model/editorLineModel.js';
import { TextChunkModel } from '../model/editorModel.js';
import { DEFAULT_LINE_STYLE, DEFAULT_TEXT_STYLE } from '../constants/styleConstants.js';

export function createEditorBootstrap({ rootId, contentKey }) {

    // DOM 구조 생성 (HTML 기본 뼈대)
    const domService = createDOMCreateService(rootId);
    domService.create();

    // 상태 관리 엔진 (메인 영역 데이터로 초기화)
    const state = createEditorApp({
    [contentKey]: [
        EditorLineModel(
        DEFAULT_LINE_STYLE.align,
        [TextChunkModel('text', '', { ...DEFAULT_TEXT_STYLE })]
        )
    ]
    });

    return {
    state,
    domService
    };
}

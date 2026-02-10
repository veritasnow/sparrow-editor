

import { createEditorLayoutBuilder } from '../core/layout/editorLayoutBuilder.js';
import { createStateApplication } from '../modules/state/application/editorApplication.js';
import { EditorLineModel } from '../model/editorLineModel.js';
import { TextChunkModel } from '../model/editorModel.js';
import { DEFAULT_LINE_STYLE, DEFAULT_TEXT_STYLE } from '../constants/styleConstants.js';
import { createUiApplication } from '../modules/ui/application/uiApplication.js';
import { createInputApplication } from '../modules/input/application/inputApplication.js';
import { createSelectionApplication } from '../modules/selection/selectionApplication.js';
import { createApiApplication } from '../modules/rest/apiApplication.js';

/**
 * factory/editorBootstrapFactory.js
 */
export function createEditorBootstrap({ rootId, contentKey, rendererRegistry }) {
    // 1. DOM 뼈대 생성
    const domService = createEditorLayoutBuilder(rootId);
    domService.create();

    const editorEl = document.getElementById(contentKey);

    // 2. 상태(State) 애플리케이션 생성
    const state = createStateApplication({
        [contentKey]: [
            EditorLineModel(
                DEFAULT_LINE_STYLE.align,
                [TextChunkModel('text', '', { ...DEFAULT_TEXT_STYLE })]
            )
        ]
    });

    // 3. UI 애플리케이션 생성
    const ui = createUiApplication({
        rootId: contentKey,
        rendererRegistry
    });

    // 4. 선택(Selection) 애플리케이션 생성
    const domSelection = createSelectionApplication({ root: editorEl });
    
    // 5. API 애플리케이션 생성 (새로 추가된 통신 모듈)
    const restApi      = createApiApplication();

    // 입력 시스템은 엘리먼트 의존성이 강하므로 여기서 같이 생성하거나 팩토리에서 생성
    const inputApp     = createInputApplication({ editorEl });

    return {
        domService,
        state,
        ui,
        domSelection,
        restApi,
        inputApp,
        editorEl
    };
}
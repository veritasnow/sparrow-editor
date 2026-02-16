// extensions/list/listExtension.js
import { bindUnorderedListButton } from './unorderedListFeatureBinder.js';

/**
 * 리스트(ul/li) 익스텐션
 */
export function createUnorderedListExtension(rootId) {
  return {
    name: 'unorderedList',

    /**
     * Editor 초기화 시 호출되어 툴바 버튼과 서비스를 바인딩합니다.
     */
    setup({ stateAPI, uiAPI, selectionAPI, editorAPI }) {
      // 툴바에서 리스트 버튼 요소를 가져옵니다.
      // (버튼 ID는 툴바 생성 시 ${rootId}-unorderedListBtn 등으로 설정되어 있어야 합니다)
      const listBtn = editorAPI.getToolbarButton(`${rootId}-unorderedListBtn`);
      
      if (!listBtn) {
        console.warn(`[ListExtension] Button not found: ${rootId}-unorderedListBtn`);
        return;
      }

      // 버튼 클릭 이벤트 및 리스트 생성 로직 바인딩
      bindUnorderedListButton(listBtn, stateAPI, uiAPI, selectionAPI, rootId);
    }
  };
}
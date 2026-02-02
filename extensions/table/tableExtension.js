// extensions/table/tableExtension.js
import { bindTableButton } from './tableFeatureBinder.js';

export function createTableExtension(rootId) {
  return {
    name: 'table',

    setup({ stateAPI, uiAPI, selectionAPI, editorAPI }) {
      const tableBtn = editorAPI.getToolbarButton('table');
      if (!tableBtn) return;

      bindTableButton(tableBtn, stateAPI, uiAPI, selectionAPI, rootId);
    }
  };
}

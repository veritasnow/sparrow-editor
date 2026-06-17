// extensions/image/imageExtension.js

import { imageFeatureBinder } from './imageFeatureBinder.js';

export function imageExtension(rootId) {
  return {
    name: 'image',

    /**
     * Editor 초기화 시 호출됨
     * @param {Object} deps
     * @param {Object} deps.stateAPI
     * @param {Object} deps.uiAPI
     * @param {Object} deps.editorAPI
     */
    setup({ stateAPI, uiAPI, selectionAPI, editorAPI }) {
      const imageBtn = editorAPI.getToolbarButton('image');
      if (!imageBtn) return;

      imageFeatureBinder(imageBtn, stateAPI, uiAPI, selectionAPI, rootId);
    }
  };
}

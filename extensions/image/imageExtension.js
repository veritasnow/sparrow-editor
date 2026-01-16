// extensions/image/imageExtension.js

import { bindImageButton } from './imageFeatureBinder.js';

export function createImageExtension(rootId) {
  return {
    name: 'image',

    /**
     * Editor 초기화 시 호출됨
     * @param {Object} deps
     * @param {Object} deps.stateAPI
     * @param {Object} deps.uiAPI
     * @param {Object} deps.editorAPI
     */
    setup({ stateAPI, uiAPI, editorAPI }) {
      const imageBtn = editorAPI.getToolbarButton('image');
      if (!imageBtn) return;

      bindImageButton(imageBtn, stateAPI, uiAPI, rootId);
    }
  };
}

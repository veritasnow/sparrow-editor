// extensions/video/videoExtension.js

import { bindVideoButton } from './videoFeatureBinder.js';

export function createVideoExtension() {
  return {
    name: 'video',

    /**
     * Editor 초기화 시 호출됨
     * @param {Object} deps
     * @param {Object} deps.stateAPI
     * @param {Object} deps.uiAPI
     * @param {Object} deps.editorAPI
     */
    setup({ stateAPI, uiAPI, editorAPI }) {
      const videoBtn = editorAPI.getToolbarButton('video');
      if (!videoBtn) return;

      bindVideoButton(videoBtn, stateAPI, uiAPI);
    }
  };
}

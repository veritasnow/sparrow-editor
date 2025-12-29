// editor.js
import { createEditorFactory } from './factory/editorFactory.js';
import { createVideoExtension } from './extensions/video/videoExtension.js';
import { createImageExtension } from './extensions/image/imageExtension.js';

export function createEditor(rootId) {
  const factory = createEditorFactory();

  const editor = factory.create({
    rootId,
    extensions: [
      createVideoExtension(rootId),
      createImageExtension(rootId)      
    ]
  });

  editor.mount();
  return editor;
}

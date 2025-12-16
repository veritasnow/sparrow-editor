// editor.js
import { createEditorFactory } from './factory/editorFactory.js';
import { createVideoExtension } from './extensions/video/videoExtension.js';

export function createEditor(rootId) {
  const factory = createEditorFactory();

  const editor = factory.create({
    rootId,
    extensions: [
      createVideoExtension()
    ]
  });

  editor.mount();
  return editor;
}

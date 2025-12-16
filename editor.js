import { createEditorFactory } from './factory/editorFactory.js';
import { createVideoExtension } from './extensions/video/videoExtension.js';

export function createEditor(rootId) {
  const factory = createEditorFactory();

  return factory.create({
    rootId,
    extensions: [
      createVideoExtension()
    ]
  });
}
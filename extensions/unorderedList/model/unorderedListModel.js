// extensions/unorderedList/model/unorderedListModel.js
import { EditorLineModel } from '../../../model/editorLineModel.js';
import { TextChunkModel } from '../../../model/editorModel.js';

// extensions/unorderedList/model/unorderedListModel.js
export function UnorderedListModel(itemCount = 1, initialData = [], stateAPI) {
  const listId = 'list-' + Math.random().toString(36).slice(2, 9);

  const listLines = (initialData.length > 0 ? initialData : Array(itemCount).fill("")).map(text => {
    return EditorLineModel('left', [
      TextChunkModel('text', text || "", {})
    ]);
  });

  if (stateAPI) {
    stateAPI.save(listId, listLines, false);
  }

  return {
    type: 'unorderedList',
    id: listId,
    // 💡 아주 깔끔하게 index만 유지!
    data: listLines.map((_, index) => ({ index })), 
    length: 1
  };
}
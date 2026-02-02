// factory/chunkRegistryFactory.js
import { chunkRegistry } from '../core/chunk/chunkRegistry.js';

import { TextChunkModel } from '../model/editorModel.js';
import { VideoChunkModel } from '../extensions/video/model/videoModel.js';
import { ImageChunkModel } from '../extensions/image/model/ImageModel.js';
import { TableChunkModel } from '../extensions/table/model/tableModel.js';

export function registerDefaultChunks() {

  chunkRegistry.register('text', {
    isText    : true,
    canSplit  : true,
    create    : (text = '', style = {}) => TextChunkModel('text', text, style),
    getLength : (chunk) => chunk.text.length,
    clone     : (chunk) => TextChunkModel('text', chunk.text, { ...chunk.style }),
    applyStyle: (chunk, patch) =>
      TextChunkModel('text', chunk.text, { ...chunk.style, ...patch })
  });

  chunkRegistry.register('video', {
    isText    : false,
    canSplit  : false,
    create    : (videoId, src) => VideoChunkModel(videoId, src),
    getLength : () => 1,
    clone     : (chunk) => VideoChunkModel(chunk.videoId, chunk.src),
    applyStyle: (chunk) => chunk
  });

  chunkRegistry.register('image', {
    isText    : false,
    canSplit  : false,
    create    : (src) => ImageChunkModel(src),
    getLength : () => 1,
    clone     : (chunk) => ImageChunkModel(chunk.src),
    applyStyle: (chunk) => chunk
  });

  chunkRegistry.register('table', {
    isText   : false,
    canSplit : false,
    create   : (rows, cols) => TableChunkModel(rows, cols),
    getLength: () => 1,
    clone    : (chunk) => ({
      ...chunk,
      data : chunk.data.map(row =>
        row.map(cell => ({
          id    : cell.id,
          style : { ...cell.style }
        }))
      ),
      style: { ...chunk.style }
    }),
    applyStyle: (chunk, patch) => ({
      ...chunk,
      style: { ...chunk.style, ...patch }
    })
  });
}

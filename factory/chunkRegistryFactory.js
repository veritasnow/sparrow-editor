// factory/chunkRegistryFactory.js
import { chunkRegistry } from '../core/chunk/chunkRegistry.js';

import { TextChunkModel } from '../model/editorModel.js';
import { VideoChunkModel } from '../extensions/video/model/videoModel.js';
import { ImageChunkModel } from '../extensions/image/model/ImageModel.js';
import { TableChunkModel } from '../extensions/table/model/tableModel.js';
import { UnorderedListModel } from '../extensions/unorderedList/model/unorderedListModel.js';

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

    clone: (chunk) => ({
      type    : 'table',
      tableId : chunk.tableId,          // 🔥 테이블 식별자 유지 (재사용 렌더 핵심)
      length  : 1,
      data: (chunk.data || []).map(row =>
        (row || []).map(cell => {
          if (!cell) return null;       // ← 자유병합 필수 (가로/세로 병합 대응)
          return {
            id      : cell.id,
            style   : cell.style ? { ...cell.style } : {},
            rowspan : cell.rowspan ?? 1,
            colspan : cell.colspan ?? 1
          };
        })
      ),
      style: chunk.style ? { ...chunk.style } : {}
    }),

    applyStyle: (chunk, patch) => ({
      ...chunk,
      style: { ...chunk.style, ...patch }
    })
  });

  /*
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
          style : { ...cell.style },
          rowspan : cell.rowspan ?? 1,
          colspan : cell.colspan ?? 1          
        }))
      ),
      style: { ...chunk.style }
    }),
    applyStyle: (chunk, patch) => ({
      ...chunk,
      style: { ...chunk.style, ...patch }
    })
  });
  */

  chunkRegistry.register('unorderedList', {
      isText: false,   // 블록 단위 컨테이너이므로 false
      canSplit: false, // 리스트 자체가 텍스트처럼 쪼개지지는 않음
      
      // 1. 모델 생성 함수 연결
      create: (itemCount, initialData) => UnorderedListModel(itemCount, initialData),
      
      // 2. 길이는 블록 1개로 취급
      getLength: () => 1,
      
      // 3. 깊은 복사 (Deep Clone)
      // li 항목들의 ID와 스타일이 유지되도록 처리합니다.
      clone: (chunk) => ({
          ...chunk,
          data: chunk.data.map(item => (
            {
              //id  : item.id,
              text: item.text,
              style: { ...item.style }
          })),
          style: { ...chunk.style }
      }),
      
      // 4. 스타일 적용 (ul 태그 자체 스타일)
      applyStyle: (chunk, patch) => ({
          ...chunk,
          style: { ...chunk.style, ...patch }
      })
  });  
}

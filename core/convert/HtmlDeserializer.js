import { TextChunkModel } from '../../model/editorModel.js';
import { EditorLineModel } from '../../model/editorLineModel.js';
import { VideoChunkModel } from '../../extensions/video/model/videoModel.js';
import { ImageChunkModel } from '../../extensions/image/model/ImageModel.js';
import { TableChunkModel } from '../../extensions/table/model/tableModel.js';

export const HtmlDeserializer = {
    allowedStyles: ['fontSize', 'color', 'fontWeight', 'fontStyle', 'textDecoration', 'backgroundColor'],

    deserialize(htmlString) {
        const parser = new DOMParser();
        const cleanHtml = htmlString.replace(/>\s+</g, '><').trim();
        const doc = parser.parseFromString(cleanHtml, 'text/html');

        const context = {
            mainLines: [],
            additionalState: {}, 
        };

        this.parseNodes(doc.body.childNodes, context);
        
        if (context.mainLines.length === 0) {
            context.mainLines.push(EditorLineModel());
        }
        
        return context;
    },

    parseNodes(nodes, context) {
        let currentChunks = [];

        nodes.forEach(node => {
            if (this.isBlockElement(node)) {
                if (currentChunks.length > 0) {
                    context.mainLines.push(EditorLineModel('left', currentChunks));
                    currentChunks = [];
                }

                const align = node.style?.textAlign || 'left';
                const chunks = this.collectChunks(node, {}, context);
                
                const finalChunks = chunks.length > 0 ? chunks : [TextChunkModel()];
                context.mainLines.push(EditorLineModel(align, finalChunks));
            } else {
                const chunks = this.collectChunks(node, {}, context);
                currentChunks.push(...chunks);
            }
        });

        if (currentChunks.length > 0) {
            context.mainLines.push(EditorLineModel('left', currentChunks));
        }
    },

    collectChunks(node, inheritedStyle = {}, context) {
        let chunks = [];
        const currentStyle = { ...inheritedStyle, ...this.extractStyle(node) };

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (text) {
                chunks.push(TextChunkModel('text', text, currentStyle));
            }
            return chunks;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();

            // 1. Table 처리
            if (tagName === 'table') {
                const rowCount = node.rows.length;
                const colCount = node.rows[0]?.cells.length || 0;
                const tableChunk = TableChunkModel(rowCount, colCount);
                
                Array.from(node.rows).forEach((row, rIdx) => {
                    Array.from(row.cells).forEach((cell, cIdx) => {
                        const cellId = tableChunk.data[rIdx][cIdx].id;
                        const cellContext = { mainLines: [], additionalState: context.additionalState };
                        this.parseNodes(cell.childNodes, cellContext);
                        context.additionalState[cellId] = cellContext.mainLines.length > 0 
                            ? cellContext.mainLines 
                            : [EditorLineModel()];
                    });
                });

                chunks.push(tableChunk);
                return chunks;
            }

            // 2. Image 처리
            if (tagName === 'img') {
                chunks.push(ImageChunkModel(node.src, node.alt || '', {}));
                return chunks;
            }

            // 🚀 3. Video 처리 (Youtube iframe 대응)
            if (tagName === 'iframe') {
                const src = node.getAttribute('src') || '';
                const videoId = this.extractYoutubeId(src);
                if (videoId) {
                    // VideoChunkModel(videoId, originalUrl) 구조라고 가정
                    chunks.push(VideoChunkModel(videoId, src));
                    return chunks;
                }
            }

            // 4. 일반 태그 재귀 탐색 (span, b, a 등)
            node.childNodes.forEach(child => {
                chunks.push(...this.collectChunks(child, currentStyle, context));
            });
        }
        return chunks;
    },

    /**
     * 유튜브 URL에서 ID를 추출하는 유틸리티
     */
    extractYoutubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    },

    extractStyle(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return {};
        const style = {};
        const tagName = node.tagName.toLowerCase();

        if (['b', 'strong'].includes(tagName)) style.fontWeight = 'bold';
        if (['i', 'em'].includes(tagName)) style.fontStyle = 'italic';
        if (tagName === 'u') style.textDecoration = 'underline';

        this.allowedStyles.forEach(prop => {
            if (node.style[prop]) {
                style[prop] = node.style[prop];
            }
        });

        return style;
    },

    isBlockElement(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        const blocks = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'table', 'section', 'article'];
        return blocks.includes(node.tagName.toLowerCase());
    }
};
import { TextChunkModel } from '../../model/editorModel.js';
import { EditorLineModel } from '../../model/editorLineModel.js';
import { VideoChunkModel } from '../../extensions/video/model/videoModel.js';
import { ImageChunkModel } from '../../extensions/image/model/ImageModel.js';
import { TableChunkModel } from '../../extensions/table/model/tableModel.js';

export const HtmlDeserializer = {

    allowedStyles: [
        'fontSize',
        'color',
        'fontWeight',
        'fontStyle',
        'textDecoration',
        'backgroundColor'
    ],

    deserialize(htmlString) {
        const parser = new DOMParser();
        const cleanHtml = htmlString.replace(/>\s+</g, '><').trim();
        const doc = parser.parseFromString(cleanHtml, 'text/html');

        const context = {
            mainLines: [],
            additionalState: {}
        };

        this.parseBlockNodes(doc.body.childNodes, context);

        if (context.mainLines.length === 0) {
            context.mainLines.push(EditorLineModel('left', []));
        }

        return context;
    },

    /**
     * ==============================
     * BLOCK PARSER (라인 단위 책임)
     * ==============================
     */
    parseBlockNodes(nodes, context) {
        nodes.forEach(node => {

            // block element → 무조건 새 라인
            if (this.isBlockElement(node)) {
                this.parseSingleBlock(node, context);
                return;
            }

            // inline / text 노드가 body 바로 아래에 있는 경우
            const chunks = this.collectInlineChunks(node, {}, context);
            if (chunks.length > 0) {
                context.mainLines.push(EditorLineModel('left', chunks));
            }
        });
    },

    parseSingleBlock(node, context) {
        const align = node.style?.textAlign || 'left';

        // table은 block이지만 자체 chunk
        if (node.tagName?.toLowerCase() === 'table') {
            const tableChunk = this.parseTable(node, context);
            context.mainLines.push(EditorLineModel(align, [tableChunk]));
            return;
        }

        const childNodes = Array.from(node.childNodes);

        // block 내부에 또 block이 있는 경우 → 재귀적으로 라인 분리
        const hasNestedBlock = childNodes.some(n => this.isBlockElement(n));

        if (hasNestedBlock) {
            this.parseBlockNodes(childNodes, context);
            return;
        }

        // 순수 inline block
        const chunks = [];
        childNodes.forEach(child => {
            chunks.push(...this.collectInlineChunks(child, {}, context));
        });

        context.mainLines.push(
            EditorLineModel(align, chunks)
        );
    },

    /**
     * ==============================
     * INLINE PARSER (chunk 전용)
     * ==============================
     */
    collectInlineChunks(node, inheritedStyle = {}, context) {
        const chunks = [];
        const currentStyle = { ...inheritedStyle, ...this.extractStyle(node) };

        // TEXT
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (text && text.length > 0) {
                chunks.push(TextChunkModel('text', text, currentStyle));
            }
            return chunks;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return chunks;

        const tagName = node.tagName.toLowerCase();

        // ❌ block은 여기서 처리 안 함
        if (this.isBlockElement(node)) return chunks;

        // image
        if (tagName === 'img') {
            chunks.push(
                ImageChunkModel(node.src, node.alt || '', {})
            );
            return chunks;
        }

        // video (youtube iframe)
        if (tagName === 'iframe') {
            const src = node.getAttribute('src') || '';
            const videoId = this.extractYoutubeId(src);
            if (videoId) {
                chunks.push(VideoChunkModel(videoId, src));
            }
            return chunks;
        }

        // 일반 inline 태그
        node.childNodes.forEach(child => {
            chunks.push(...this.collectInlineChunks(child, currentStyle, context));
        });

        return chunks;
    },

    /**
     * ==============================
     * TABLE
     * ==============================
     */
    parseTable(node, context) {
        const rowCount = node.rows.length;
        const colCount = node.rows[0]?.cells.length || 0;

        const tableChunk = TableChunkModel(rowCount, colCount);

        Array.from(node.rows).forEach((row, rIdx) => {
            Array.from(row.cells).forEach((cell, cIdx) => {
                const cellId = tableChunk.data[rIdx][cIdx].id;

                const cellContext = {
                    mainLines: [],
                    additionalState: context.additionalState
                };

                this.parseBlockNodes(cell.childNodes, cellContext);

                context.additionalState[cellId] =
                    cellContext.mainLines.length > 0
                        ? cellContext.mainLines
                        : [EditorLineModel('left', [])];
            });
        });

        return tableChunk;
    },

    /**
     * ==============================
     * STYLE
     * ==============================
     */
    extractStyle(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return {};

        const style = {};
        const tagName = node.tagName.toLowerCase();

        if (tagName === 'b' || tagName === 'strong') style.fontWeight = 'bold';
        if (tagName === 'i' || tagName === 'em') style.fontStyle = 'italic';
        if (tagName === 'u') style.textDecoration = 'underline';

        this.allowedStyles.forEach(prop => {
            if (node.style?.[prop]) {
                style[prop] = node.style[prop];
            }
        });

        return style;
    },

    /**
     * ==============================
     * UTIL
     * ==============================
     */
    extractYoutubeId(url) {
        const regExp =
            /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    },

    isBlockElement(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        const blocks = [
            'div',
            'p',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'li',
            'table',
            'section',
            'article'
        ];
        return blocks.includes(node.tagName.toLowerCase());
    }
};

// /core/convert/HtmlDeserializer.js
import { TextChunkModel } from '../../model/editorModel.js';
import { EditorLineModel } from '../../model/editorLineModel.js';
import { VideoChunkModel } from '../../extensions/video/model/videoModel.js';
import { createImageChunk } from '../../extensions/image/model/createImageChunk.js';
import { TableChunkModel } from '../../extensions/table/model/tableModel.js';
import { UnorderedListModel } from '../../extensions/unorderedList/model/unorderedListModel.js';

export const HtmlDeserializer = {
    allowedStyles: ['fontSize', 'color', 'fontWeight', 'fontStyle', 'textDecoration', 'backgroundColor'],

    deserialize(htmlString, stateAPI) {
        const parser = new DOMParser();
        // 불필요한 공백 및 스크립트 제거
        const cleanHtml = htmlString.replace(/>\s+</g, '><').trim();
        const doc = parser.parseFromString(cleanHtml, 'text/html');

        const context = {
            mainLines: [],
            additionalState: {},
            stateAPI // 중복 ID 체크를 위해 참조 전달
        };

        this.parseBlockNodes(doc.body.childNodes, context);

        if (context.mainLines.length === 0) {
            context.mainLines.push(EditorLineModel('left', []));
        }

        return context;
    },

    parseBlockNodes(nodes, context) {
        nodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === '') return;

            const tagName = node.tagName?.toLowerCase();

            // 1. 리스트 처리 (UL, OL)
            if (tagName === 'ul' || tagName === 'ol') {
                this.parseList(node, context);
                return;
            }

            // 2. 일반 블록 처리
            if (this.isBlockElement(node)) {
                this.parseSingleBlock(node, context);
                return;
            }

            // 3. 인라인/텍스트가 루트에 있는 경우
            const chunks = this.collectInlineChunks(node, {}, context);
            if (chunks.length > 0) {
                context.mainLines.push(EditorLineModel('left', chunks));
            }
        });
    },

    parseSingleBlock(node, context) {
        const align = node.style?.textAlign || 'left';
        const tagName = node.tagName?.toLowerCase();

        if (tagName === 'table') {
            const tableChunk = this.parseTable(node, context);
            context.mainLines.push(EditorLineModel(align, [tableChunk]));
            return;
        }

        // 중첩된 블록이 있으면 재귀적으로 분해 (평탄화 전략)
        const hasNestedBlock = Array.from(node.childNodes).some(n => this.isBlockElement(n));
        if (hasNestedBlock) {
            this.parseBlockNodes(node.childNodes, context);
            return;
        }

        // 인라인 청크 수집
        const chunks = [];
        node.childNodes.forEach(child => {
            chunks.push(...this.collectInlineChunks(child, {}, context));
        });

        // 빈 줄(<p><br></p>) 대응
        if (chunks.length === 0 && (tagName === 'p' || tagName === 'div')) {
            chunks.push(TextChunkModel('text', '\u200B')); // Zero-width space
        }

        context.mainLines.push(EditorLineModel(align, chunks));
    },

    parseList(listNode, context) {
        const listId = this.generateId('list', context);
        const listLines = [];

        Array.from(listNode.querySelectorAll('li')).forEach((li, index) => {
            let chunks = [];
            
            // 💡 해결책: li 내부의 모든 노드를 순회하며 인라인 요소만 추출
            // 만약 li 내부에 p가 있다면, 그 p 내부의 자식들을 가져옵니다.
            const processNode = (node) => {
                node.childNodes.forEach(child => {
                    // p나 div 같은 블록 요소라면 그 내부를 다시 탐색 (재귀)
                    if (child.nodeType === 1 && (child.tagName === 'P' || child.tagName === 'DIV')) {
                        processNode(child);
                    } else {
                        // 인라인 요소나 텍스트라면 청크로 변환
                        chunks.push(...this.collectInlineChunks(child, {}, context));
                    }
                });
            };

            processNode(li);

            // 사이냅 특유의 불필요한 제로 너비 공백(\u200B)이나 
            // 리스트 마커용 span(se-list-type) 등이 섞여 들어올 수 있으므로 필터링이 필요할 수 있습니다.
            chunks = chunks.filter(c => !(c.type === 'text' && c.text === '●')); // 마커 텍스트 제거 예시

            listLines.push(
                EditorLineModel('left', chunks.length > 0 ? chunks : [TextChunkModel('text', '\u200B')])
            );
        });

        context.additionalState[listId] = listLines;

        const listModel = UnorderedListModel();
        listModel.id = listId;
        
        // 💡 렌더러가 즉시 그릴 수 있도록 line 주입 구조 유지
        listModel.data = listLines.map((line, idx) => ({
            index: idx,
            line: line // 렌더러가 바로 참조할 수 있게 주입
        }));
        
        listModel.length = listLines.length;
        context.mainLines.push(EditorLineModel('left', [listModel]));
    },

    parseTable(node, context) {
        const rowCount = node.rows.length;
        const colCount = node.rows[0]?.cells.length || 0;
        const tableChunk = TableChunkModel(rowCount, colCount);

        Array.from(node.rows).forEach((row, rIdx) => {
            Array.from(row.cells).forEach((cell, cIdx) => {
                const cellId = tableChunk.data[rIdx][cIdx].id;
                const cellContext = { mainLines: [], additionalState: context.additionalState };
                
                this.parseBlockNodes(cell.childNodes, cellContext);
                
                context.additionalState[cellId] = cellContext.mainLines.length > 0 
                    ? cellContext.mainLines 
                    : [EditorLineModel('left', [TextChunkModel('text', '\u200B')])];
            });
        });

        return tableChunk;
    },

    collectInlineChunks(node, inheritedStyle = {}, context) {
        const chunks = [];
        if (node.nodeName === 'BR') {
            // 인라인 BR은 무시하거나 필요시 라인 분리 로직 추가 (여기서는 무시하여 평탄화)
            return chunks;
        }

        const currentStyle = { ...inheritedStyle, ...this.extractStyle(node) };

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.replace(/\n/g, ''); // 불필요한 개행 제거
            if (text.length > 0) chunks.push(TextChunkModel('text', text, currentStyle));
            return chunks;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return chunks;

        const tagName = node.tagName.toLowerCase();
        if (this.isBlockElement(node)) return chunks;

        if (tagName === 'img') {
            chunks.push(createImageChunk(node.src, node.alt || '', {}));
            return chunks;
        }

        if (tagName === 'iframe') {
            const videoId = this.extractYoutubeId(node.getAttribute('src') || '');
            if (videoId) chunks.push(VideoChunkModel(videoId, node.getAttribute('src')));
            return chunks;
        }

        node.childNodes.forEach(child => {
            chunks.push(...this.collectInlineChunks(child, currentStyle, context));
        });

        return chunks;
    },

    extractStyle(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return {};
        const style = {};
        const tag = node.tagName.toLowerCase();

        if (tag === 'b' || tag === 'strong') style.fontWeight = 'bold';
        if (tag === 'i' || tag === 'em') style.fontStyle = 'italic';
        if (tag === 'u') style.textDecoration = 'underline';

        this.allowedStyles.forEach(prop => {
            if (node.style?.[prop]) style[prop] = node.style[prop];
        });
        return style;
    },

    generateId(prefix, context) {
        let id;
        const present = context.stateAPI.getHistoryStatus().present || {};
        do {
            id = `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
        } while (present[id] || context.additionalState[id]);
        return id;
    },

    isBlockElement(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        const blocks = ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'table', 'ul', 'ol', 'section', 'article'];
        return blocks.includes(node.tagName.toLowerCase());
    },

    extractYoutubeId(url) {
        const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
        return (match && match[2].length === 11) ? match[2] : null;
    }
};
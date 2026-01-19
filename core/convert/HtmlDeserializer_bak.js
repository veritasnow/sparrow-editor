import { TextChunkModel } from '../../model/editorModel.js';
import { EditorLineModel} from '../../model/editorLineModel.js';
import { VideoChunkModel } from '../../extensions/video/model/videoModel.js';
import { ImageChunkModel } from '../../extensions/image/model/ImageModel.js';
import { TableChunkModel } from '../../extensions/table/model/tableModel.js';


export const HtmlDeserializer = {
    /**
     * 외부 HTML 문자열을 editorState 구조로 변환
     */
    deserialize(htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        return this.parseNodes(doc.body.childNodes);
    },

    /**
     * 노드 리스트를 순회하며 Line 배열 생성
     */
    parseNodes(nodes) {
        const lines = [];
        let currentChunks = [];

        nodes.forEach(node => {
            // 1. 블록 엘리먼트 (P, DIV, H1~H6, LI 등) -> 새로운 라인 형성
            if (this.isBlockElement(node)) {
                // 이전에 쌓인 인라인 청크가 있다면 라인으로 밀어넣고 초기화
                if (currentChunks.length > 0) {
                    lines.push(EditorLineModel('left', currentChunks));
                    currentChunks = [];
                }
                
                const chunks = this.collectChunks(node);
                const align = node.style?.textAlign || 'left';
                lines.push(EditorLineModel(align, chunks.length > 0 ? chunks : [TextChunkModel()]));
            } 
            // 2. 인라인 엘리먼트 및 텍스트 노드 -> 현재 라인의 청크로 수집
            else {
                const chunks = this.collectChunks(node);
                currentChunks.push(...chunks);
            }
        });

        // 남은 인라인 청크 처리
        if (currentChunks.length > 0) {
            lines.push(EditorLineModel('left', currentChunks));
        }

        return lines.length > 0 ? lines : [EditorLineModel()];
    },

    /**
     * 특정 노드 내부를 뒤져서 Chunk 배열을 반환 (재귀)
     */
    collectChunks(node, inheritedStyle = {}) {
        let chunks = [];
        const currentStyle = { ...inheritedStyle, ...this.extractStyle(node) };

        // 텍스트 노드인 경우
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.replace(/\s+/g, ' '); // 불필요한 공백 정리
            if (text) {
                chunks.push(TextChunkModel('text', text, currentStyle));
            }
            return chunks;
        }

        // 엘리먼트 노드인 경우 특수 타입 체크
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();

            if (tagName === 'img') {
                chunks.push(ImageChunkModel(node.src));
                return chunks;
            }
            if (tagName === 'iframe' && node.src.includes('youtube')) {
                const videoId = this.extractYoutubeId(node.src);
                chunks.push(VideoChunkModel(videoId, node.src));
                return chunks;
            }
            if (tagName === 'table') {
                const rows = node.rows.length;
                const cols = node.rows[0]?.cells.length || 0;
                chunks.push(TableChunkModel(rows, cols));
                return chunks;
            }
            if (tagName === 'br') {
                // BR은 보통 라인 끝을 의미하지만, 청크 구조상 빈 텍스트로 치환하거나 무시 가능
                return chunks;
            }

            // 일반 태그라면 자식들을 재귀적으로 탐색
            node.childNodes.forEach(child => {
                chunks.push(...this.collectChunks(child, currentStyle));
            });
        }

        return chunks;
    },

    /**
     * 태그와 인라인 스타일에서 우리가 사용하는 스타일만 추출
     */
    extractStyle(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return {};
        
        const style = {};
        const tagName = node.tagName.toLowerCase();

        // 1. 태그 기반 스타일
        if (tagName === 'b' || tagName === 'strong') style.fontWeight = 'bold';
        if (tagName === 'i' || tagName === 'em') style.fontStyle = 'italic';
        if (tagName === 'u') style.textDecoration = 'underline';

        // 2. 인라인 스타일 속성 기반 (fontSize 등 우리가 관리하는 것만)
        if (node.style.fontSize) style.fontSize = node.style.fontSize;
        if (node.style.color) style.color = node.style.color;
        if (node.style.fontWeight) style.fontWeight = node.style.fontWeight;

        return style;
    },

    isBlockElement(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        const blockTags = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'section', 'article'];
        return blockTags.includes(node.tagName.toLowerCase());
    },

    extractYoutubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }
};
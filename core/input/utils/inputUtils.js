// /core/input/utils/inputUtils.js
export function getSafeTextFromRange(range) {
    if (!range) return '';
    const node = range.startContainer;
    return node.nodeType === Node.TEXT_NODE ? (node.nodeValue ?? '') : '';
}
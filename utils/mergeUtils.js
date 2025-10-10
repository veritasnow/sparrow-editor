// utils/mergeUtils.js
function isSameStyle(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;

  const aKeys = Object.keys(a).filter(k => a[k] !== undefined).sort();
  const bKeys = Object.keys(b).filter(k => b[k] !== undefined).sort();
  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every(k => a[k] === b[k]);
}

export function mergeSameStyleBlocks(blocks) {
  const merged = [];
  let buffer = '';
  let currentStyle = null;
  let currentType = undefined;

  for (const block of blocks) {
    const style = block.style || null;
    const type = block.type; // 그대로 사용, 기본값 강제 안 함

    if (!currentStyle || !isSameStyle(currentStyle, style) || currentType !== type) {
      if (buffer) merged.push({ text: buffer, style: currentStyle, ...(currentType !== undefined && { type: currentType }) });
      buffer = block.text;
      currentStyle = style;
      currentType = type;
    } else {
      buffer += block.text;
    }
  }

  if (buffer) merged.push({ text: buffer, style: currentStyle, ...(currentType !== undefined && { type: currentType }) });

  return merged;
}
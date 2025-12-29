// extensions/image/componets/imageRenderer.js

export const imageRenderer = {
  /**
   * @param {Object} chunk
   * @param {string} chunk.src   - 이미지 URL
   * @param {string} [chunk.alt] - 대체 텍스트
   * @param {Object} [chunk.style] - 인라인 스타일
   * @returns {HTMLElement}
   */
  render(chunk) {
    const img = document.createElement('img');

    img.src = chunk.src;
    img.alt = chunk.alt || "";

    // 기본 크기 (없으면 100% 너비는 너무 과해서 적당한 가로값)
    img.style.width        = chunk.width ?? '420px';
    img.style.maxWidth     = '100%';          // 반응형 처리
    img.style.borderRadius = '8px';
    img.style.display      = 'inline-block';

    if (chunk.style) {
      Object.assign(img.style, chunk.style);
    }

    return img;
  }
};

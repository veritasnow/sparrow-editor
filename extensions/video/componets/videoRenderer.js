// ✅ videoRenderer.js
export const videoRenderer = {
  render(chunk) {
    // iframe 생성
    const iframe = document.createElement('iframe');
    iframe.src                = chunk.src;
    iframe.width              = '420';
    iframe.height             = '236';
    iframe.allowFullscreen    = true;
    iframe.style.display      = 'inline-block';
    iframe.style.borderRadius = '8px';
    return iframe;
  }
};

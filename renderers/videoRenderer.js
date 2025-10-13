// ✅ videoRenderer.js
export const videoRenderer = {
  render(chunk) {
    // 컨테이너 생성
    const container = document.createElement('div');
    container.style.textAlign = 'center';
    container.style.margin = '12px 0';

    // iframe 생성
    const iframe = document.createElement('iframe');
    iframe.src = chunk.src;
    iframe.width = '420';
    iframe.height = '236';
    iframe.allowFullscreen = true;
    iframe.style.display = 'inline-block';
    iframe.style.borderRadius = '8px';

    // DOM 연결
    container.appendChild(iframe);
    return container;
  }
};

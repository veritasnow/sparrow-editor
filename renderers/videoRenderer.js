export const videoRenderer = {
  render(chunk) {
    const iframe = document.createElement("iframe");
    iframe.src = chunk.src;
    iframe.width = "560";
    iframe.height = "315";
    iframe.allowFullscreen = true;
    iframe.style.display = "block";
    return iframe;
  }
};
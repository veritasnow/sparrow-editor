// core/scroll/scrollEventBinder.js
export function bindScrollEvent(rootEl, scrollService) {
  let scrollTimeout = null;

  const onScroll = () => {
    // 이전 타이머 제거
    if (scrollTimeout) clearTimeout(scrollTimeout);

    // 100ms 동안 스크롤 이벤트가 없으면 렌더링
    scrollTimeout = setTimeout(() => {
      window.requestAnimationFrame(() => {
        scrollService.handleScroll();
      });
    }, 100);
  };

  rootEl.addEventListener('scroll', onScroll);

  return () => {
    rootEl.removeEventListener('scroll', onScroll);
    if (scrollTimeout) clearTimeout(scrollTimeout);
  };
}

// core/scroll/scrollEventBinder.js

export function bindScrollEvent(rootEl, scrollService) {
  let ticking = false;

  const onScroll = () => {
    if (!ticking) {
      // 브라우저의 다음 리페인트 직전에 실행하여 부드러운 스크롤 보장
      window.requestAnimationFrame(() => {
        scrollService.handleScroll();
        ticking = false;
      });
      ticking = true;
    }
  };

  rootEl.addEventListener('scroll', onScroll);

  return () => {
    rootEl.removeEventListener('scroll', onScroll);
  };
}
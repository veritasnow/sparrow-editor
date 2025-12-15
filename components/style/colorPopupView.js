// sparrow-editor/components/style/colorPopupView.js

/**
 * 🎨 텍스트 색상 선택 팝업 View
 *
 * View 책임:
 * - DOM 생성
 * - 위치 계산
 * - 열기 / 닫기
 *
 * @returns {{
 *   popup: HTMLElement,
 *   open: Function,
 *   close: Function,
 *   onSelect: Function
 * }}
 */
export function createColorPopupView(toolbar, triggerBtn) {
  let popup = document.querySelector('.color-popup');

  if (!popup) {
    popup = document.createElement('div');
    popup.className = 'color-popup';
    popup.innerHTML = `
      <div class="color-grid">
        ${[
          '#000000', '#FF0000', '#FFA500', '#FFFF00',
          '#008000', '#00CED1', '#0000FF', '#800080',
          '#808080', '#A52A2A'
        ]
          .map(
            color =>
              `<button class="color-item" data-color="${color}"
                style="background:${color}"></button>`
          )
          .join('')}
      </div>
    `;
    toolbar.appendChild(popup);
  }

  let selectHandler = null;

  // 색상 클릭 처리
  popup.addEventListener('click', (e) => {
    const btn = e.target.closest('.color-item');
    if (!btn) return;

    const color = btn.dataset.color;
    if (selectHandler) selectHandler(color);
  });

  // 팝업 열기
  const open = () => {
    popup.style.display = 'block';

    const btnRect = triggerBtn.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();

    popup.style.top = `${btnRect.bottom - toolbarRect.top + 6}px`;
    popup.style.left = `${btnRect.left - toolbarRect.left}px`;
  };

  // 팝업 닫기
  const close = () => {
    popup.style.display = 'none';
  };

  // 선택 콜백 등록
  const onSelect = (handler) => {
    selectHandler = handler;
  };

  return { popup, open, close, onSelect };
}

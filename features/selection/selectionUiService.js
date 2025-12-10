// UI 업데이트 전담 서비스 (피처)
export function createSelectionUIService(toolbarElements = {}) {
  const {
    boldBtn,
    italicBtn,
    underLineBtn,
    fontSizeSelect
  } = toolbarElements;

  function clearAll() {
    boldBtn?.classList.remove('active');
    italicBtn?.classList.remove('active');
    underLineBtn?.classList.remove('active');
    if (fontSizeSelect) {
      // 툴바에서 중립 상태로 보이게 기본값(빈 값 또는 선택 해제)
      // 선택을 비활성화하려면 빈값을 허용하거나, 현재 옵션 중 기본을 선택
      fontSizeSelect.value = ''; // HTML에 빈 option이 없다면 set to default idx:
      // fontSizeSelect.selectedIndex = 1; // 예: 12pt 기본으로 복원하려면 사용
    }
  }

  function updateUI(result) {
    if (!result || !result.isUniform) {
      clearAll();
      return;
    }

    const style = result.style || {};

    // bold
    if (boldBtn) {
      const isBold = style.fontWeight === 'bold' || style.fontWeight === '700';
      boldBtn.classList.toggle('active', !!isBold);
    }

    // italic
    if (italicBtn) {
      const isItalic = style.fontStyle === 'italic';
      italicBtn.classList.toggle('active', !!isItalic);
    }

    // underline
    if (underLineBtn) {
      const isUnderline = (style.textDecoration === 'underline') || (style.textDecoration && style.textDecoration.includes('underline'));
      underLineBtn.classList.toggle('active', !!isUnderline);
    }

    // fontSize (style.fontSize expected like "12px" or "12pt")
    if (fontSizeSelect) {
      if (style.fontSize) {
        // 폰트값이 "12px" 같은 형태이면 select에서 같은 value를 찾아 셋
        fontSizeSelect.value = style.fontSize;
      } else {
        // 일관된 폰트 크기가 없으면 중립 상태로 (빈값 허용 시)
        fontSizeSelect.value = '';
      }
    }
  }

  return { updateUI, clearAll };
}

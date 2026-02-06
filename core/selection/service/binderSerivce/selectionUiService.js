// features/selection/selectionUiService.js
export function createSelectionUIService(toolbarElements = {}) {
  const {
    // text style
    boldBtn,
    italicBtn,
    underLineBtn,
    fontSizeSelect,
    fontFamilySelect,

    // line style
    leftBtn,
    centerBtn,
    rightBtn
  } = toolbarElements;

  /* -----------------------------
   * 공통 유틸
   * ----------------------------- */
  function clearTextUI() {
    boldBtn?.classList.remove('active');
    italicBtn?.classList.remove('active');
    underLineBtn?.classList.remove('active');

    if (fontSizeSelect) {
      fontSizeSelect.value = '';
    }

    if (fontFamilySelect) {
      fontFamilySelect.value = '';
    }    
  }

  function clearLineUI() {
    leftBtn?.classList.remove('active');
    centerBtn?.classList.remove('active');
    rightBtn?.classList.remove('active');
  }

  function clearAll() {
    clearTextUI();
    clearLineUI();
  }

  /* -----------------------------
   * 텍스트 스타일 반영
   * ----------------------------- */
  function updateTextUI(textResult) {
    if (!textResult || !textResult.isUniform) {
      clearTextUI();
      return;
    }

    const style = textResult.style || {};

    // bold
    if (boldBtn) {
      const isBold =
        style.fontWeight === 'bold' ||
        style.fontWeight === '700';
      boldBtn.classList.toggle('active', !!isBold);
    }

    // italic
    if (italicBtn) {
      italicBtn.classList.toggle(
        'active',
        style.fontStyle === 'italic'
      );
    }

    // underline
    if (underLineBtn) {
      const isUnderline = style.textDecoration === 'underline' || (typeof style.textDecoration === 'string' && style.textDecoration.includes('underline'));
      underLineBtn.classList.toggle('active', !!isUnderline);
    }

    // font size
    if (fontSizeSelect) {
      fontSizeSelect.value = style.fontSize || '';
    }

    // font family
    if (fontFamilySelect) {
      fontFamilySelect.value = style.fontFamily || '';
    }    
  }

  /* -----------------------------
   * 라인 스타일 반영 (align)
   * ----------------------------- */
  function updateLineUI(lineResult) {
    if (!lineResult || !lineResult.isUniform) {
      clearLineUI();
      return;
    }

    const align = lineResult.style?.align;

    leftBtn?.classList.toggle('active', align === 'left');
    centerBtn?.classList.toggle('active', align === 'center');
    rightBtn?.classList.toggle('active', align === 'right');
  }

  /* -----------------------------
   * 외부 API
   * ----------------------------- */
  function updateUI(result) {
    if (!result) {
      clearAll();
      return;
    }

    updateTextUI(result.text);
    updateLineUI(result.line);
  }

  return {
    updateUI,
    clearAll
  };
}

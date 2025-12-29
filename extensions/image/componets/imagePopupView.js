// extensions/image/ui/imagePopupView.js

export function createImagePopupView(rootEl, toolbar, imageBtn) {
    let popup = rootEl.querySelector('.image-input-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.className = 'image-input-popup';
        popup.innerHTML = `
            <input type="text" placeholder="이미지 URL 입력..." class="image-url-input" />
            <button class="image-upload-btn">파일 선택</button>
            <button class="image-confirm-btn">추가</button>
            <input type="file" accept="image/*" class="image-file-input" style="display:none;" />
        `;
        toolbar.appendChild(popup);
    }

    const inputEl    = popup.querySelector('.image-url-input');
    const fileBtn    = popup.querySelector('.image-upload-btn');
    const fileInput  = popup.querySelector('.image-file-input');
    const confirmBtn = popup.querySelector('.image-confirm-btn');

    const open = () => {
        popup.style.display = 'block';
        const rect = imageBtn.getBoundingClientRect();
        const toolbarRect = toolbar.getBoundingClientRect();
        popup.style.top = `${rect.bottom - toolbarRect.top + 6}px`;
        popup.style.left = `${rect.left - toolbarRect.left}px`;
        inputEl.focus();
    };

    const close = () => {
        inputEl.value = '';
        fileInput.value = '';
        popup.style.display = 'none';
    };

    return { popup, inputEl, fileBtn, fileInput, confirmBtn, open, close };
}

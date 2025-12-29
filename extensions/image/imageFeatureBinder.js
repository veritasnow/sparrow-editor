import { createImagePopupView } from './compoents/imagePopupView.js';
import { createImageInsertService } from './service/imageInsertService.js';

// features/image/imageFeatureBinder.js
export function bindImageButton(imageBtn, stateAPI, uiAPI, rootId) {
    const rootEl = document.getElementById(rootId);
    const toolbar = rootEl.querySelector('.toolbar');

    const { popup, inputEl, fileBtn, fileInput, confirmBtn, open, close }
        = createImagePopupView(rootEl, toolbar, imageBtn);
    const { insertImage } = createImageInsertService(stateAPI, uiAPI);

    let lastCursorPos = null;

    const onImageBtnClick = (e) => {
        e.stopPropagation();
        lastCursorPos = uiAPI.getSelectionPosition();
        popup.style.display === 'block' ? close() : open();
    };

    const onConfirmClick = () => {
        const url = inputEl.value.trim();
        if (insertImage(url, lastCursorPos)) close();
    };

    const onFileBtnClick = () => fileInput.click();

    const onFileInputChange = () => {
        const file = fileInput.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        if (insertImage(url, lastCursorPos)) close();
    };

    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && e.target !== imageBtn) {
            close();
        }
    });

    imageBtn.addEventListener('click', onImageBtnClick);
    confirmBtn.addEventListener('click', onConfirmClick);
    fileBtn.addEventListener('click', onFileBtnClick);
    fileInput.addEventListener('change', onFileInputChange);
}

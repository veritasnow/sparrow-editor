import { createImagePopupView } from './componets/imagePopupView.js';
import { createImageInsertService } from './service/imageInsertService.js';

// features/image/imageFeatureBinder.js
export function bindImageButton(imageBtn, stateAPI, uiAPI, selectionAPI, rootId) {
    const rootEl = document.getElementById(rootId);
    const toolbar = rootEl.querySelector('.sparrow-toolbar');

    const { popup, inputEl, fileBtn, fileInput, confirmBtn, open, close }
        = createImagePopupView(rootEl, toolbar, imageBtn);
    const { insertImage } = createImageInsertService(stateAPI, uiAPI, selectionAPI);

    const onImageBtnClick = (e) => {
        e.stopPropagation();
        
        if (popup.style.display === 'block') {
            close();
        } else {
            // [핵심] 버튼을 누르는 순간, 에디터 본문의 마지막 위치를 강제로 저장!
            selectionAPI.updateLastValidPosition(); 
            open();
        }
    };

    const onConfirmClick = () => {
        const url = inputEl.value.trim();
        if (insertImage(url)) close();
    };

    const onFileBtnClick = () => fileInput.click();

    const onFileInputChange = () => {
        const file = fileInput.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        if (insertImage(url)) close();
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

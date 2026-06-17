import { imagePopupView } from './componets/imagePopupView.js';
import { insertImage } from './services/insertImage.js';

// features/image/imageFeatureBinder.js
export function imageFeatureBinder(imageBtn, stateAPI, uiAPI, selectionAPI, rootId) {
    const rootEl = document.getElementById(rootId);
    const toolbar = rootEl.querySelector('.sparrow-toolbar');

    const { popup, inputEl, fileBtn, fileInput, confirmBtn, open, close } = imagePopupView(rootEl, toolbar, imageBtn);

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
        if (insertImage(url, {stateAPI, uiAPI, selectionAPI})) close();
    };

    const onFileBtnClick = () => fileInput.click();

    const onFileInputChange = () => {
        const file = fileInput.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        if (insertImage(url, {stateAPI, uiAPI, selectionAPI})) close();
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

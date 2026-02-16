// extensions/list/listFeatureBinder.js
import { createUnorderedListInsertService } from './service/unorderedListInsertService.js';

export function bindUnorderedListButton(listBtn, stateAPI, uiAPI, selectionAPI) {
    const { insertUnorderedList } = createUnorderedListInsertService(stateAPI, uiAPI, selectionAPI);

    const onBtnClick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        selectionAPI.updateLastValidPosition();
        insertUnorderedList();
    };

    listBtn.addEventListener('click', onBtnClick);

    return function destroy() {
        listBtn.removeEventListener('click', onBtnClick);
    };
}
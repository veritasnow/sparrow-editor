// extensions/list/listFeatureBinder.js
import { insertUnorderedList } from './service/insertUnorderedList.js';

export function bindUnorderedListButton(listBtn, stateAPI, uiAPI, selectionAPI) {

    const onBtnClick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        selectionAPI.updateLastValidPosition();
        insertUnorderedList(stateAPI, uiAPI, selectionAPI);
    };

    listBtn.addEventListener('click', onBtnClick);

    return function destroy() {
        listBtn.removeEventListener('click', onBtnClick);
    };
}
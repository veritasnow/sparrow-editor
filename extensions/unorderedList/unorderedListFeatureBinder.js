
import { createUnorderedListInsert } from './service/insertUnorderedList.js';

export function bindUnorderedListButton(
    listBtn,
    stateAPI,
    uiAPI,
    selectionAPI
) {
    const { insertUnorderedList } = createUnorderedListInsert({
        stateAPI,
        uiAPI,
        selectionAPI
    });

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

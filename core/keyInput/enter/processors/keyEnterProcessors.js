// /core/keyInput/processors/keyEnterProcessors.js
import { handleListEnter } from '../service/enterListService.js';
import { handleBaseEnter } from '../service/enterBaseService.js';


/**
 * ⏎ 엔터 키 실행 메인 함수
 */
export function executeEnter({ stateAPI, uiAPI, selectionAPI }) {
    const activeKey = selectionAPI.getActiveKey();
    if (!activeKey) return;

    // 현재 커서가 있는 실제 컨테이너(에디터 혹은 TD) 정보를 가져옵니다.
    const selection   = selectionAPI.getSelectionContext();
    const containerId = selection.containerId || activeKey;
    
    // ✅ 리스트 내부 엔터인지 확인
    if (containerId.startsWith('list-')) {
        handleListEnter({ stateAPI, uiAPI, selectionAPI, containerId });
    } else {
        handleBaseEnter ({ stateAPI, uiAPI, selectionAPI, containerId });
    }
}
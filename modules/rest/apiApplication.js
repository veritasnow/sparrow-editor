/**
 * modules/api/application/apiApplication.js
 */
import { createRestApiService } from "./service/restApiService.js";

export function createApiApplication() {
    
    // 1. 상태 관리 (내부 변수)
    const state = {
        baseUrl   : '',
        csrfHeader: null,
        csrfToken : null,
        authToken : null,
    };

    // 2. 범용 서비스 인스턴스
    const restService = createRestApiService();

    // 3. 상태 제어 API
    function initTokens({ csrfToken, csrfHeader, authToken }) {
        if (csrfToken !== undefined) state.csrfToken = csrfToken;
        if (csrfHeader !== undefined) state.csrfHeader = csrfHeader;
        if (authToken !== undefined) state.authToken = authToken;
    }

    function setBaseUrl(url) {
        // 끝에 슬래시가 있다면 제거하여 서비스에서의 결합을 안전하게 함
        state.baseUrl = url ? url.replace(/\/$/, '') : '';
    }

    // 4. 익스텐션/외부용 간소화 인터페이스 (state 자동 바인딩)
    return {
        initTokens,
        setBaseUrl,
        get    : (url, params) => restService.get(url, params, state),
        post   : (url, data) => restService.post(url, data, state),
        put    : (url, data) => restService.put(url, data, state),
        delete : (url, data) => restService.delete(url, data, state),
        upload(url, fileOrFormData) {
            let formData = fileOrFormData;
            if (fileOrFormData instanceof File) {
                formData = new FormData();
                formData.append('uploadFile', fileOrFormData); // 백엔드 필드명에 맞게 조정 가능
            }
            return restService.upload(url, formData, state);
        },
        getState: () => ({ ...state })
    };
}
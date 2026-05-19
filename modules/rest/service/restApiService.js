/**
 * modules/api/service/restApiService.js
 * 상태를 가지지 않고 주입받은 데이터로 통신만 수행하는 순수 서비스
 */
/**
 * modules/api/service/restApiService.js
 * 상태를 가지지 않고 주입받은 데이터로 통신만 수행하는 순수 서비스
 */
export function createRestApiService() {

    // [개선] 크롬/엣지 익스텐션 환경(콘텐츠 스크립트 등)인지 확인하는 헬퍼 함수
    const isExtensionEnvironment = () => {
        return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.sendMessage;
    };

    async function request(method, url, options = {}, apiState) {
        const fullUrl = apiState.baseUrl + url;

        // --- 1. 익스텐션 환경일 때: 백그라운드로 메시지를 보내 대리 통신 (에러 방지 핵심) ---
        if (isExtensionEnvironment()) {
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    type: 'API_REQUEST',
                    payload: { method, url: fullUrl, options, apiState }
                }, (response) => {
                    // 통신 채널이 예기치 않게 끊겼을 때의 예외 처리
                    if (chrome.runtime.lastError) {
                        return reject({ status: 500, message: chrome.runtime.lastError.message });
                    }
                    if (response && response.success) {
                        resolve(response.data);
                    } else {
                        reject({
                            status: response?.status || 500,
                            message: response?.message || '익스텐션 백그라운드 요청 실패'
                        });
                    }
                });
            });
        }

        // --- 2. 일반 웹 환경일 때: 기존의 순수 fetch 통신 유지 ---
        const headers = new Headers(options.headers || {});

        if (apiState.csrfHeader && apiState.csrfToken) {
            headers.set(apiState.csrfHeader, apiState.csrfToken);
        }
        if (apiState.authToken) {
            headers.set('Authorization', `Bearer ${apiState.authToken}`);
        }

        let body = options.data;
        if (body && !(body instanceof FormData)) {
            headers.set('Content-Type', 'application/json; charset=utf-8');
            body = JSON.stringify(body);
        }

        try {
            const response = await fetch(fullUrl, {
                method,
                headers,
                body: method !== 'GET' ? body : null
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                return Promise.reject({
                    status: response.status,
                    message: result.message || 'API 요청 실패'
                });
            }
            return result;
        } catch (error) {
            return Promise.reject(error);
        }
    }

    return {
        get: (url, params, apiState) => {
            const query = params ? '?' + new URLSearchParams(params).toString() : '';
            return request('GET', url + query, {}, apiState);
        },
        post: (url, data, apiState) => request('POST', url, { data }, apiState),
        put: (url, data, apiState) => request('PUT', url, { data }, apiState),
        delete: (url, data, apiState) => request('DELETE', url, { data }, apiState),
        upload: (url, formData, apiState) => request('POST', url, { data: formData }, apiState)
    };
}
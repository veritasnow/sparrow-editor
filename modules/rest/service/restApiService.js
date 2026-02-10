/**
 * modules/api/service/restApiService.js
 * 상태를 가지지 않고 주입받은 데이터로 통신만 수행하는 순수 서비스
 */
export function createRestApiService() {

    async function request(method, url, options = {}, apiState) {
        const fullUrl = apiState.baseUrl + url;
        const headers = new Headers(options.headers || {});

        // 주입받은 apiState의 토큰들을 사용
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
        // 모든 메서드에서 마지막 인자로 apiState를 받음
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
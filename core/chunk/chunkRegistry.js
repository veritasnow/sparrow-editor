// core/chunk/ChunkRegistry.js
const behaviors = new Map();

export const chunkRegistry = {
    register(type, config) {
        behaviors.set(type, config);
    },
    get(type) {
        // 등록되지 않은 타입은 기본적으로 'text' 핸들러를 사용하거나 에러를 반환
        return behaviors.get(type) || behaviors.get('text');
    }
};
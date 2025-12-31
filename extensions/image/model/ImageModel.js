// extensions/image/model/ImageChunkModel.js
export function ImageChunkModel(src) {
    const model = {
        type : 'image',
        src  : src,
        text : '',   // 비텍스트 청크
        style: {}    // 이미지에는 기본적으로 스타일 없음, 향후 width/height 가능
    };
    return Object.freeze(model);
}
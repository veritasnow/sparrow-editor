export function createDOMCreateService(rootId) {
  const root = document.getElementById(rootId);
  if (!root) {
    console.error(`❌ rootId "${rootId}"를 찾을 수 없습니다.`);
    return;
  }

  root.innerHTML = `
    <div class="toolbar">
      <button id="${rootId}-boldBtn" title="굵게"><b>B</b></button>
      <button id="${rootId}-italicBtn" title="기울이기"><i>I</i></button>
      <button id="${rootId}-underLineBtn" title="밑줄"><u>U</u></button>

      <div style="width:1px; height:20px; background:#ddd; margin:0 6px;"></div>

      <button id="${rootId}-alignLeftBtn" title="왼쪽 정렬">
        <div class="align-icon align-left"><div></div><div></div><div></div><div></div></div>
      </button>

      <button id="${rootId}-alignCenterBtn" title="가운데 정렬">
        <div class="align-icon align-center"><div></div><div></div><div></div><div></div></div>
      </button>

      <button id="${rootId}-alignRightBtn" title="오른쪽 정렬">
        <div class="align-icon align-right"><div></div><div></div><div></div><div></div></div>
      </button>

      <button id="${rootId}-addVideoBtn" title="동영상 추가">
        <div class="video-icon"></div>
      </button>
    </div>

    <div id="${rootId}-content" contenteditable="true" class="sparrow-contents"></div>
  `;
}

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

      <!-- 글자 크기 콤보박스 추가 -->
      <select id="${rootId}-fontSizeSelect" class="font-size-select" title="글자 크기">
        <option value="10px">10</option>
        <option value="12px" selected>12</option>
        <option value="14px">14</option>
        <option value="16px">16</option>
        <option value="18px">18</option>
        <option value="20px">20</option>
        <option value="24px">24</option>
      </select>

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

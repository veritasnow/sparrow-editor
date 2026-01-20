export function createDOMCreateService(rootId) {
  const root = document.getElementById(rootId);
  if (!root) {
    console.error(`❌ rootId "${rootId}"를 찾을 수 없습니다.`);
    return;
  }

  function create() {

    root.innerHTML = `
      <div class="sparrow-toolbar">
        <button id="${rootId}-boldBtn" title="굵게"><b>B</b></button>
        <button id="${rootId}-italicBtn" title="기울이기"><i>I</i></button>
        <button id="${rootId}-underLineBtn" title="밑줄"><u>U</u></button>

        <!-- 글자 색상 -->
        <button id="${rootId}-textColorBtn" title="글자 색상" class="color-btn">
          <span class="color-preview"></span>
          <span class="color-text">C</span>
          <input type="color" id="${rootId}-textColorInput" class="color-input" />
        </button>

        <!-- 글자 크기 -->
        <select id="${rootId}-fontSizeSelect" class="font-size-select" title="글자 크기">
          <option value="10px">10</option>
          <option value="12px">12</option>
          <option value="14px" selected>14</option>
          <option value="16px">16</option>
          <option value="18px">18</option>
          <option value="20px">20</option>
          <option value="24px">24</option>
        </select>

        <div style="width:1px; height:20px; background:#ddd; margin:0 6px;"></div>

        <!-- 표 삽입 버튼 -->
        <button id="${rootId}-addTableBtn" class="table-btn" title="표 삽입">
          <span>▦</span>
        </button>

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

        <button id="${rootId}-addImageBtn" title="이미지 추가">
          <div class="image-icon"></div>
        </button>
      </div>

      <div id="${rootId}-content" contenteditable="true" data-container-id="${rootId}-content" class="sparrow-contents"></div>
    `;
  }

  function destroy() {
    root.innerHTML = ""; // DOM을 만든 놈이 제거
  }

  return {
    create,
    destroy
  };
}

import { FONT_FAMILY_LIST } from '../../constants/styleConstants.js';

export function createEditorLayoutBuilder(rootId) {
  const root = document.getElementById(rootId);
  if (!root) {
    console.error(`❌ rootId "${rootId}"를 찾을 수 없습니다.`);
    return;
  }

  function create() {

    const fontOptions = FONT_FAMILY_LIST.map(font => 
      `<option value="${font.value}">${font.name}</option>`
    ).join('');

    root.innerHTML = `
      <div class="sparrow-modal-layer" id="${rootId}-modal-layer"></div>

      <div class="sparrow-toolbar">
        <button id="${rootId}-boldBtn" data-command="fontWeight" data-value="bold" title="굵게"><b>B</b></button>
        <button id="${rootId}-italicBtn" data-command="fontStyle" data-value="italic" title="기울이기"><i>I</i></button>
        <button id="${rootId}-underLineBtn" data-command="textDecoration" data-value="underline"title="밑줄"><u>U</u></button>

        <!-- 글자 색상 -->
        <button id="${rootId}-textColorBtn" data-command="color-trigger" title="글자 색상" class="color-btn">
          <span class="color-preview"></span>
          <span class="color-text">C</span>
          <input type="color" 
                id="${rootId}-textColorInput" 
                data-command="color-input" 
                data-type="color" 
                class="color-input" />
        </button>
        
        <!-- 하이라이트 -->
        <button id="${rootId}-bgColorBtn" data-command="color-trigger" title="배경 색상" class="color-btn">
          <span class="color-preview" style="background: white;"></span>
          <span class="color-text">H</span>
          <input type="color" 
                id="${rootId}-bgColorInput" 
                data-command="color-input" 
                data-type="backgroundColor" 
                class="color-input" 
                value="#ffffff" />
        </button>

        <!-- 글자 크기 -->
        <select id="${rootId}-fontSizeSelect" class="font-size-select" data-command="fontSize" title="글자 크기">
          <option value="10px">10</option>
          <option value="12px">12</option>
          <option value="14px" selected>14</option>
          <option value="16px">16</option>
          <option value="18px">18</option>
          <option value="20px">20</option>
          <option value="24px">24</option>
        </select>

        <select id="${rootId}-fontFamilySelect" data-command="fontFamily" class="font-family-select" title="글꼴 변경">
          ${fontOptions}
        </select>      

        <div style="width:1px; height:20px; background:#ddd; margin:0 6px;"></div>

        <!-- 표 삽입 버튼 -->
        <button id="${rootId}-addTableBtn" data-command="addTable" class="table-btn" title="표 삽입">
          <span>▦</span>
        </button>

        <!-- 순서가 없는 길머리 기호 버튼 -->
        <button id="${rootId}-unorderedListBtn" data-command="insertUnorderedList" title="글머리 기호">
          <div class="sparrow-toolbar-list-wrapper">
            <div class="sparrow-toolbar-list-row">
              <div class="sparrow-toolbar-list-dot"></div>
              <div class="sparrow-toolbar-list-line"></div>
            </div>
            <div class="sparrow-toolbar-list-row">
              <div class="sparrow-toolbar-list-dot"></div>
              <div class="sparrow-toolbar-list-line"></div>
            </div>
            <div class="sparrow-toolbar-list-row">
              <div class="sparrow-toolbar-list-dot"></div>
              <div class="sparrow-toolbar-list-line"></div>
            </div>
          </div>
        </button>

        <button id="${rootId}-alignLeftBtn" data-command="textAlign" data-value="left" title="왼쪽 정렬">
          <div class="align-icon align-left"><div></div><div></div><div></div><div></div></div>
        </button>

        <button id="${rootId}-alignCenterBtn" data-command="textAlign" data-value="center" title="가운데 정렬">
          <div class="align-icon align-center"><div></div><div></div><div></div><div></div></div>
        </button>

        <button id="${rootId}-alignRightBtn" data-command="textAlign" data-value="right" title="오른쪽 정렬">
          <div class="align-icon align-right"><div></div><div></div><div></div><div></div></div>
        </button>

        <button id="${rootId}-addVideoBtn" data-command="addVideo" title="동영상 추가">
          <div class="video-icon"></div>
        </button>

        <button id="${rootId}-addImageBtn" data-command="addImage" title="이미지 추가">
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

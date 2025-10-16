/**
 * 🎥 유튜브 버튼 이벤트 바인딩
 */
export function bindVideoButton(videoBtn, getEditorState, saveEditorState, updateAndRestore) {
    const toolbar = document.querySelector('.toolbar');

    let popup = document.querySelector('.video-input-popup');
    if (!popup) {
    popup = document.createElement('div');
    popup.className = 'video-input-popup';
    popup.innerHTML = `
        <input type="text" placeholder="YouTube URL 입력..." id="videoUrlInput" />
        <button id="videoAddConfirmBtn">추가</button>
    `;
    toolbar.appendChild(popup);
    }

    const inputEl = popup.querySelector('#videoUrlInput');
    const confirmBtn = popup.querySelector('#videoAddConfirmBtn');

    // 🎥 버튼 클릭 시 팝업 토글
    videoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    popup.style.display = popup.style.display === 'block' ? 'none' : 'block';

    if (popup.style.display === 'block') {
        const rect = videoBtn.getBoundingClientRect();
        const toolbarRect = toolbar.getBoundingClientRect();
        popup.style.top = `${rect.bottom - toolbarRect.top + 6}px`;
        popup.style.left = `${rect.left - toolbarRect.left}px`;
        inputEl.focus();
    }
    });

    // 🎥 “추가” 버튼 클릭 시 영상 삽입
    confirmBtn.addEventListener('click', () => {
    const url = inputEl.value.trim();
    if (!url) return alert('유튜브 URL을 입력하세요.');

    const videoId = extractYouTubeId(url);
    if (!videoId) return alert('올바른 유튜브 URL이 아닙니다.');

    console.log('videoId : ', videoId);

    const newState = applyVideoBlock(getEditorState(), videoId);
    console.log('newState : ', newState);

    saveEditorState(newState);
    updateAndRestore({ lineIndex: newState.length - 1, offset: 0 });

    inputEl.value = '';
    popup.style.display = 'none';
    });

    document.addEventListener('click', (e) => {
    if (!popup.contains(e.target) && e.target !== videoBtn) {
        popup.style.display = 'none';
    }
    });
}

/**
 * 🎬 에디터 상태에 동영상 block 추가
 */
function applyVideoBlock(editorState, videoId) {
    const newState = [...editorState];

    newState.push({
    align: 'center',
    chunks: [
        {
        type: 'video',
        videoId,
        src: `https://www.youtube.com/embed/${videoId}`, // ✅ 추가
        text: '',
        style: {}
        }
    ]
    });

    return newState;
}

/**
 * 🔍 유튜브 URL에서 videoId 추출 (모든 패턴 대응)
 */
function extractYouTubeId(url) {
  // 유튜브 모든 형태 지원: watch?v=, embed/, shorts/, youtu.be/
  const regExp = /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  if (!match) return null;

  // ✅ videoId만 추출 (파라미터 제거)
  const videoId = match[1];
  return videoId;
}
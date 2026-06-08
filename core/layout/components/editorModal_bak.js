export function showEditorAlert(rootId, title, message) {
  // body가 아니라 미리 만들어둔 레이어에 넣습니다.
  const layer = document.getElementById(`${rootId}-modal-layer`);
  if (!layer) return;

  const modalHtml = `
    <div class="modal-overlay" id="${rootId}-alert-modal">
      <div class="modal-alert">
        <div class="modal-icon alert-warning">!</div>
        <div class="modal-body">
          <h2 class="modal-title">${title}</h2>
          <p class="modal-desc">${message}</p>
        </div>
        <div class="modal-actions">
          <button class="btn-primary" id="${rootId}-modal-close-btn">확인</button>
        </div>
      </div>
    </div>
  `;
  
  layer.innerHTML = modalHtml;

  // 닫기 이벤트 핸들러
  document.getElementById(`${rootId}-modal-close-btn`).onclick = () => {
    layer.innerHTML = ''; // 레이어를 비워서 모달 제거
  };
}
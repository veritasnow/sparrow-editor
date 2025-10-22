export function bindInputEvent(editorEl, app, ui) {
  let composing = false;
  let skipNextInput = false;

  editorEl.addEventListener('compositionstart', () => {
    composing = true;
  });

  editorEl.addEventListener('compositionend', () => {
    composing = false;
    skipNextInput = true; // 다음 input 이벤트 무시
    handleInput();
  });

  editorEl.addEventListener('input', () => {
    if (skipNextInput) {
      skipNextInput = false;
      return;
    }
    if (!composing) handleInput();
  });

  function handleInput() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    ui.ensureFirstLine();

    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    const cursorOffset = range.startOffset;

    const parentP = container.nodeType === Node.TEXT_NODE
      ? container.parentElement.closest('p')
      : container.closest('p');
    if (!parentP) return;

    const lineIndex = Array.prototype.indexOf.call(editorEl.children, parentP);
    if (lineIndex < 0) return;

    const currentState = app.getState().present.editorState;
    const currentLine = currentState[lineIndex] || { align: "left", chunks: [] };

    const activeNode = container.nodeType === Node.TEXT_NODE
      ? container.parentElement.closest('[data-index]')
      : container.closest('[data-index]');
    const dataIndex = activeNode ? parseInt(activeNode.dataset.index, 10) : null;

    const updatedLine = { ...currentLine, chunks: [...currentLine.chunks] };
    let isNewChunk = false;

    console.log("dataIndex : ", dataIndex);
    console.log("currentLine.chunks : ", currentLine.chunks);    

    let isChunkRendering = false;

    if (dataIndex !== null && updatedLine.chunks[dataIndex]) {
      const oldChunk = updatedLine.chunks[dataIndex];
      const newText = activeNode.textContent;

      if (oldChunk.text !== newText) {
        updatedLine.chunks[dataIndex] = { ...oldChunk, text: newText };
        isChunkRendering = true;
      }
    } else {
      // 새 chunk 또는 DOM에 없는 chunk
      const newText = container.textContent || '';
      updatedLine.chunks = [{ type: 'text', text: newText, style: {} }];
      isNewChunk = true;
    }

    const nextState = [...currentState];
    nextState[lineIndex] = updatedLine;
    app.saveEditorState(nextState);

    if (isNewChunk) {
      // 라인 단위 렌더링
      ui.renderLine(editorEl.id, lineIndex, updatedLine);
      // 새 chunk가 생성되면 커서는 항상 끝에
      ui.restoreSelectionPosition2222({ lineIndex, chunkIndex: 0, offset: updatedLine.chunks[0].text.length });
    } else if (isChunkRendering) {
      // 청크 단위 렌더링
      ui.renderChunk(editorEl.id, lineIndex, dataIndex, updatedLine.chunks[dataIndex]);
      // 커서 복원
      ui.restoreSelectionPosition2222({ lineIndex, chunkIndex: dataIndex, offset: cursorOffset });
    }
  }
}




/*
export function bindInputEvent(editorEl, app, ui) {
  let composing = false;
  let skipNextInput = false;

  // ---- ① 한글 조합 시작 ----
  editorEl.addEventListener('compositionstart', () => {
    composing = true;
  });

  // ---- ② 한글 조합 종료 ----
  editorEl.addEventListener('compositionend', () => {
    composing = false;
    skipNextInput = true; // 다음 input 이벤트 무시
    handleInput();        // 조합이 끝난 시점에만 상태 저장
  });

  // ---- ③ 일반 input 처리 ----
  editorEl.addEventListener('input', () => {
    if (skipNextInput) {
      skipNextInput = false;
      return; // compositionend 직후 input 무시
    }
    if (!composing) handleInput();
  });

  // ---- ④ 입력 로직 ----
  function handleInput() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    ui.ensureFirstLine();

    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    const cursorOffset = range.startOffset;

    // 현재 입력 중인 <p> 찾기
    const parentP = container.nodeType === Node.TEXT_NODE
      ? container.parentElement.closest('p')
      : container.closest('p');
    if (!parentP) return;

    // 라인 인덱스 추출
    const lineIndex = Array.prototype.indexOf.call(editorEl.children, parentP);
    if (lineIndex < 0) return;

    // 현재 상태 가져오기
    const currentState = app.getState().present.editorState;
    const currentLine = currentState[lineIndex] || { align: "left", chunks: [] };

    // ---- [핵심] 입력 대상 span 찾기 ----
    const activeNode = container.nodeType === Node.TEXT_NODE
      ? container.parentElement
      : container;
    const dataIndex = activeNode.dataset?.index
      ? parseInt(activeNode.dataset.index, 10)
      : null;

    console.log("dataIndex : ", dataIndex);
    console.log("currentLine.chunks : ", currentLine.chunks);    

    // ---- 상태 업데이트 ----
    const updatedLine = { ...currentLine, chunks: [...currentLine.chunks] };
    console.log("updatedLine : ", updatedLine);    
    console.log("updatedLine.chunks[dataIndex] : ", updatedLine.chunks[dataIndex]);    


    let flag = false;
    if (dataIndex !== null && updatedLine.chunks[dataIndex]) {
      const oldChunk = updatedLine.chunks[dataIndex];
      const newText = activeNode.textContent;

      console.log("oldChunk : ", oldChunk);
      console.log("newText : ", newText);


      // 변경 없음 → 상태 저장 X
      if (oldChunk.text === newText) return;

      updatedLine.chunks[dataIndex] = { ...oldChunk, text: newText };
    } else {
      // 혹시 data-index 없는 텍스트 노드 (초기 입력)
      const newText = container.textContent || '';
      updatedLine.chunks = [{ type: 'text', text: newText, style: {} }];
      console.log("설마 여기에 들어가...??");
      flag = true;
    }

    // ---- 상태 저장 ----
    const nextState = [...currentState];
    nextState[lineIndex] = updatedLine;
    app.saveEditorState(nextState);

    // ---- 리렌더 + 커서 복원 ----
    if(flag) {
      // 데이터 인덱스가 없는 노드일 때는 행단위로 해주긴 해야함.. 이땐 어쩌지?
      ui.renderLine(editorEl.id, lineIndex, updatedLine);
      ui.restoreSelectionPosition({ lineIndex, offset: cursorOffset });
    }
  }
}
*/

/*
export function bindInputEvent(editorEl, app, ui) {
  let composing = false;
  let skipNextInput = false;

  editorEl.addEventListener('compositionstart', () => {
    composing = true;
  });

  editorEl.addEventListener('compositionend', () => {
    composing = false;
    skipNextInput = true; // 다음 input 이벤트 무시
    handleInput();
  });

  editorEl.addEventListener('input', () => {
    if (skipNextInput) {
      skipNextInput = false;
      return; // compositionend 직후 input 무시
    }
    if (!composing) {
      handleInput();
    }
  });

  function handleInput() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    ui.ensureFirstLine();

    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    const cursorOffset = range.startOffset;

    const parentP = container.nodeType === Node.TEXT_NODE
      ? container.parentElement.closest('p')
      : container.closest('p');
    if (!parentP) return;

    const lineIndex = Array.prototype.indexOf.call(editorEl.children, parentP);
    if (lineIndex < 0) return;

    const currentState = app.getState().present.editorState;
    const currentLine = currentState[lineIndex] || { align: "left", chunks: [] };

    let updatedChunks = [];
    let acc = 0;
    let newCursorOffset = 0;

    parentP.childNodes.forEach((node, idx) => {
      const text = node.textContent || '';
      if (text === '') return;

      const chunk = currentLine.chunks[idax] || { type: 'text', text: '', style: {} };
      updatedChunks.push({ ...chunk, text });

      if (selection.anchorNode === node || node.contains(selection.anchorNode)) {
        newCursorOffset = acc + cursorOffset;
      }
      acc += text.length;
    });

    if (updatedChunks.length === 0) {
      updatedChunks.push({ type: 'text', text: '', style: {} });
    }

    // **중복 상태 저장 방지**
    // 브라우저 버튼 클릭하면 input호출함
    const isSame = currentLine.chunks.length === updatedChunks.length &&
      currentLine.chunks.every((c, i) => c.text === updatedChunks[i].text);

    if (isSame) return; // 변경 없으면 상태 저장 X

    const nextState = [...currentState];
    nextState[lineIndex] = { ...currentLine, chunks: updatedChunks };
    app.saveEditorState(nextState);

    ui.renderLine(editorEl.id, lineIndex, nextState[lineIndex]);
    ui.restoreSelectionPosition({ lineIndex, offset: newCursorOffset });
  }
}
*/




/*
export function bindInputEvent(editorEl, app, ui) {
  let composing = false;

  editorEl.addEventListener('compositionstart', () => {
    composing = true;
  });

  editorEl.addEventListener('compositionend', () => {
    composing = false;
    handleInput();
  });

  editorEl.addEventListener('input', () => {
    if (!composing) handleInput();
  });

  function handleInput() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    ui.ensureFirstLine();

    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    const cursorOffset = range.startOffset;

    const parentP = container.nodeType === Node.TEXT_NODE
      ? container.parentElement.closest('p')
      : container.closest('p');
    if (!parentP) return;

    const lineIndex = Array.prototype.indexOf.call(editorEl.children, parentP);
    if (lineIndex < 0) return;

    const currentState = app.getState().present.editorState;
    const currentLine = currentState[lineIndex] || { align: "left", chunks: [] };

    let updatedChunks = [];
    let acc = 0;
    let newCursorOffset = 0;

    parentP.childNodes.forEach((node, idx) => {
      const chunk = currentLine.chunks[idx] || { type: 'text', text: '', style: {} };
      const text = node.textContent || '';
      updatedChunks.push({ ...chunk, text });

      // 커서가 현재 노드에 있으면 offset 계산
      if (selection.anchorNode === node || node.contains(selection.anchorNode)) {
        newCursorOffset = acc + cursorOffset;
      }
      acc += text.length;
    });

    const nextState = [...currentState];
    nextState[lineIndex] = { ...currentLine, chunks: updatedChunks };
    app.saveEditorState(nextState);

    ui.renderLine(editorEl.id, lineIndex, nextState[lineIndex]);

    // 렌더링 후 커서 복원
    ui.restoreSelectionPosition({ lineIndex, offset: newCursorOffset });
  }
}
*/

/*
export function bindInputEvent(editorEl, app, ui) {
  editorEl.addEventListener('input', () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    ui.ensureFirstLine();

    const range = selection.getRangeAt(0);
    const container = range.startContainer;

    // 현재 입력이 속한 <p>
    const parentP = container.nodeType === Node.TEXT_NODE
      ? container.parentElement.closest('p')
      : container.closest('p');
    if (!parentP) return;

    const lineIndex = Array.prototype.indexOf.call(editorEl.children, parentP);
    if (lineIndex < 0) return;

    const currentState = app.getState().present.editorState;
    const currentLine = currentState[lineIndex] || { align: "left", chunks: [] };

    let updatedChunks = [...currentLine.chunks];
    let textNodeIndex = 0;
    let acc = 0;

    // <p> 안의 모든 자식 노드를 순회
    parentP.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const chunk = currentLine.chunks[textNodeIndex] || { type: 'text', text: '', style: {} };
        // chunk를 덮어쓰기 대신, 해당 텍스트 노드 내용으로 업데이트
        updatedChunks[textNodeIndex] = { ...chunk, text: node.textContent };
        textNodeIndex++;
      } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SPAN') {
        const chunk = currentLine.chunks[textNodeIndex] || { type: 'text', text: '', style: {} };
        updatedChunks[textNodeIndex] = { ...chunk, text: node.textContent };
        textNodeIndex++;
      } else {
        // iframe, img 등 non-text 요소는 chunk로 만들지 않고 패스
      }
    });

    const nextState = [...currentState];
    nextState[lineIndex] = { ...currentLine, chunks: updatedChunks };

    app.saveEditorState(nextState);
  });
}
*/
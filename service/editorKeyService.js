/**
 * 에디터의 Enter 및 Backspace 키다운 이벤트에 따른 핵심 상태 관리 로직을 처리하는 서비스 팩토리입니다.
 * @param {Object} app - Editor State Application
 * @param {Object} ui - UI Application (DOM/Selection/Rendering)
 * @returns {Object} processEnter, processBackspace 함수를 포함하는 객체
 */
export function createEditorKeyService(app, ui) {
    /**
     * 현재 커서 위치를 파악하고, 상태 및 DOM에 Enter 키 입력을 반영하여 줄바꿈을 수행합니다.
     * 키보드 이벤트로부터 독립적으로 호출됩니다.
     */
    function processEnter() {
        // DOM에서 현재 커서 위치와 LineIndex, Offset을 정확하게 파악합니다.
        const currentState = app.getState().present.editorState;
        const ranges = ui.getSelectionRangesInState(currentState);
        if (!ranges || ranges.length === 0) return;

        const { lineIndex, endIndex: offset } = ranges[0];
        const editorEl = document.getElementById(ui.rootId); // UI Root ID를 통해 에디터 엘리먼트 획득

        const nextState   = [...currentState];
        const currentLine = currentState[lineIndex];
        const lineChunks  = currentLine.chunks;

        const textBeforeCursor = [];
        const textAfterCursor = [];
        let acc = 0;

        // 청크 분할 로직 (기존 handleEnterKey 로직)
        lineChunks.forEach(chunk => {
            const start = acc;
            const end = acc + chunk.text.length;

            if (offset <= start) textAfterCursor.push({ ...chunk });
            else if (offset >= end) textBeforeCursor.push({ ...chunk });
            else {
                textBeforeCursor.push({ ...chunk, text: chunk.text.slice(0, offset - start) });
                textAfterCursor.push({ ...chunk, text: chunk.text.slice(offset - start) });
            }
            acc = end;
        });

        // 상태 업데이트
        nextState[lineIndex] = {
            align: currentLine.align,
            chunks: textBeforeCursor.length ? textBeforeCursor : [{ type: "text", text: "", style: {} }]
        };

        const newLineData = {
            align: currentLine.align,
            chunks: textAfterCursor.length ? textAfterCursor : [{ type: "text", text: "", style: {} }]
        };

        nextState.splice(lineIndex + 1, 0, newLineData);
        app.saveEditorState(nextState);

        // DOM 반영 및 렌더링
        const editorDomChildren = editorEl.children;
        const newP = document.createElement("p");
        newP.className = "text-block";
        newP.style.textAlign = newLineData.align || "left";
        if (editorDomChildren[lineIndex]) {
            editorEl.insertBefore(newP, editorDomChildren[lineIndex + 1] || null);
        } else {
            editorEl.appendChild(newP);
        }

        ui.renderLine(lineIndex, nextState[lineIndex]);
        ui.renderLine(lineIndex + 1, newLineData);

        // 커서 이동
        ui.restoreSelectionPosition({ lineIndex: lineIndex + 1, offset: 0 });
    }

    /**
     * 현재 커서 위치를 파악하고, 상태 및 DOM에 Backspace 키 입력을 반영하여 삭제/줄 병합을 수행합니다.
     * 키보드 이벤트로부터 독립적으로 호출됩니다.
     */
    function processBackspace() {
        // DOM에서 현재 커서 위치와 LineIndex, Offset을 정확하게 파악합니다.
        const currentState = app.getState().present.editorState;
        const ranges = ui.getSelectionRangesInState(currentState);
        if (!ranges || ranges.length === 0) return;

        const { lineIndex, endIndex: offset } = ranges[0];
        const editorEl = document.getElementById(ui.rootId); // UI Root ID를 통해 에디터 엘리먼트 획득

        const nextState = [...currentState];
        const currentLine = currentState[lineIndex];
        const lineChunks = currentLine.chunks.map(c => ({ ...c }));
        const editorDomChildren = editorEl.children;
        let newPos = null;

        // 1️⃣ 줄 병합 (커서가 라인 맨 앞에 있고, 0번째 줄이 아닐 때)
        if (offset === 0 && lineIndex > 0) {
            const prevLine = nextState[lineIndex - 1];
            const currLine = nextState[lineIndex];

            // 청크 병합
            const mergedChunks = [
                ...(prevLine.chunks || []).map(c => ({ ...c })),
                ...(currLine.chunks || []).map(c => ({ ...c }))
            ].filter(c => c && c.type === 'text'); // 텍스트 청크만 대상으로 가정

            // 병합 후 상태 업데이트
            const prevOffset = (prevLine.chunks || []).reduce((sum, c) => sum + c.text.length, 0);

            nextState[lineIndex - 1] = {
                align: prevLine.align,
                chunks: mergedChunks.length ? mergedChunks : [{ type: "text", text: "", style: {} }]
            };
            nextState.splice(lineIndex, 1);
            app.saveEditorState(nextState);

            // DOM 반영 및 렌더링
            ui.renderLine(lineIndex - 1, nextState[lineIndex - 1]);
            if (editorDomChildren[lineIndex]) editorEl.removeChild(editorDomChildren[lineIndex]);

            // 커서 이동: 이전 줄의 끝으로 이동
            ui.restoreSelectionPosition({ lineIndex: lineIndex - 1, offset: prevOffset });
            return;
        }

        // 2️⃣ 한 글자 삭제
        let acc = 0;
        const newChunks = [];
        let deleted = false;

        for (const chunk of lineChunks) {
            const start = acc;
            const end = acc + chunk.text.length;

            if (offset <= start) newChunks.push({ ...chunk });
            else if (offset > end) newChunks.push({ ...chunk });
            else {
                // 삭제가 발생할 청크
                const localOffset = offset - start;
                const newText = chunk.text.slice(0, localOffset - 1) + chunk.text.slice(localOffset);
                if (newText.length > 0) newChunks.push({ ...chunk, text: newText });
                
                newPos = { lineIndex, offset: offset - 1 };
                deleted = true;
            }
            acc = end;
        }

        // 3️⃣ 빈 줄 처리 (삭제 후 줄이 비었을 때)
        if (deleted && newChunks.length === 0) {
            if (lineIndex === 0) {
                // 0번째 줄이 비면, 빈 텍스트 청크 유지 (최소 상태 유지)
                nextState[0] = { align: nextState[0].align || "left", chunks: [{ type: "text", text: "", style: {} }] };
                app.saveEditorState(nextState);
                ui.renderLine(0, nextState[0]);
                ui.restoreSelectionPosition({ lineIndex: 0, offset: 0 });
                return;
            }

            // 빈 줄 삭제
            nextState.splice(lineIndex, 1);
            if (editorDomChildren[lineIndex]) editorEl.removeChild(editorDomChildren[lineIndex]);
            app.saveEditorState(nextState);

            // 커서 위치 조정: 이전 줄의 끝으로 이동
            const prevLine = nextState[lineIndex - 1];
            const prevOffset = prevLine.chunks.reduce((sum, c) => sum + c.text.length, 0);
            newPos = { lineIndex: lineIndex - 1, offset: prevOffset };
        } else if (deleted) {
            // 글자가 삭제되었고 줄이 남아있을 때 상태 업데이트
            nextState[lineIndex] = { ...currentLine, chunks: newChunks };
            app.saveEditorState(nextState);
            ui.renderLine(lineIndex, nextState[lineIndex]);
        }

        if (newPos) ui.restoreSelectionPosition(newPos);
    }

    return {
        processEnter,
        processBackspace
    };
}

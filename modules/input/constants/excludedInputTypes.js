// 1. 제외하고 싶은 inputType 정의
export const EXCLUDED_INPUT_TYPES = [
    'insertParagraph',      // Enter
    'insertLineBreak',      // Shift + Enter
    'deleteContentBackward', // Backspace
    'deleteContentForward',  // Delete
    'insertFromPaste',      // Paste
    'historyUndo',          // Undo
    'historyRedo'           // Redo
];
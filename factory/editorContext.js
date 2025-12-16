// factory/editorContext.js
export function createEditorContext({
  app,
  ui,
  inputApp,
  stateAPI,
  uiAPI,
  editorAPI,
  extensions
}) {
  return {
    app,
    ui,
    inputApp,
    stateAPI,
    uiAPI,
    editorAPI,
    extensions
  };
}

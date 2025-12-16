// factory/editorContext.js
export function createEditorContext({
  mount,
  destroy,
  getAPI
}) {
  let mounted = false;

  return {
    mount() {
      if (mounted) return;
      mounted = true;
      mount();
    },

    destroy() {
      if (!mounted) return;
      mounted = false;
      destroy();
    },

    getAPI() {
      return getAPI();
    }
  };
}

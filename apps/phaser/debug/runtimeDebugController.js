export function createRuntimeDebugController({
  onVisibilityChanged = null,
  initialEnabled = false,
} = {}) {
  const renderers = new Set();
  let enabled = Boolean(initialEnabled);

  function setRendererEnabled(renderer, nextEnabled) {
    if (typeof renderer?.setEnabled === "function") {
      renderer.setEnabled(nextEnabled);
      return;
    }
    if (!nextEnabled && typeof renderer?.clear === "function") {
      renderer.clear();
    }
  }

  function notifyVisibility() {
    if (typeof onVisibilityChanged === "function") {
      onVisibilityChanged(enabled);
    }
  }

  function addRenderer(renderer) {
    if (!renderer || renderers.has(renderer)) {
      return;
    }
    renderers.add(renderer);
    setRendererEnabled(renderer, enabled);
  }

  function removeRenderer(renderer) {
    if (!renderer || !renderers.has(renderer)) {
      return;
    }
    renderers.delete(renderer);
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    for (const renderer of renderers) {
      setRendererEnabled(renderer, enabled);
    }
    notifyVisibility();
  }

  function toggle() {
    setEnabled(!enabled);
    return enabled;
  }

  function isEnabled() {
    return enabled;
  }

  function renderFrame(frameState) {
    if (!enabled) {
      return;
    }
    for (const renderer of renderers) {
      if (typeof renderer?.renderFrame === "function") {
        renderer.renderFrame(frameState);
      }
    }
  }

  function destroy() {
    for (const renderer of renderers) {
      if (typeof renderer?.destroy === "function") {
        renderer.destroy();
      } else if (typeof renderer?.clear === "function") {
        renderer.clear();
      }
    }
    renderers.clear();
  }

  notifyVisibility();

  return {
    addRenderer,
    removeRenderer,
    setEnabled,
    toggle,
    isEnabled,
    renderFrame,
    destroy,
  };
}

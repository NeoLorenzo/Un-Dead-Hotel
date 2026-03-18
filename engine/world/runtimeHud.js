export function createRuntimeHud({
  element,
  seed,
  streamWidthChunks,
  streamHeightChunks,
} = {}) {
  function loadedSpan(min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return 0;
    }
    return max - min + 1;
  }

  function render({
    loadedChunkCount,
    loadedBounds,
    cameraChunk,
    viewportChunksDrawn,
    zoomTilePixels,
  }) {
    if (!element) {
      return;
    }

    const loadedWidth = loadedSpan(loadedBounds.minX, loadedBounds.maxX);
    const loadedHeight = loadedSpan(loadedBounds.minY, loadedBounds.maxY);
    const zoomLabel =
      typeof zoomTilePixels === "number" ? zoomTilePixels.toFixed(2) : "n/a";

    element.textContent =
      `Seed: ${seed} | Loaded chunks: ${loadedChunkCount} | Active stream window: ${streamWidthChunks}x${streamHeightChunks} | ` +
      `Loaded bounds: (${loadedBounds.minX},${loadedBounds.minY}) -> (${loadedBounds.maxX},${loadedBounds.maxY}) [${loadedWidth}x${loadedHeight}] | ` +
      `Viewport chunks drawn: ${viewportChunksDrawn} | Camera chunk: (${cameraChunk.x},${cameraChunk.y}) | ` +
      `Zoom(tile px): ${zoomLabel}`;
  }

  return {
    render,
  };
}

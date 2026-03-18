import { CHUNK_SIZE } from "../../engine/procgen.js";
import { createCameraController } from "../../engine/world/cameraController.js";
import { createWorldStore } from "../../engine/world/worldStore.js";

const CHUNK_PREVIEW_FILL_COLORS = [
  0x25282d,
  0x2c3138,
  0x313842,
  0x374049,
  0x3b4652,
  0x425061,
];
const CHUNK_PREVIEW_BORDER_COLOR = 0xb8b8b8;

export function createPhaserRuntimeAdapter({
  streamWidthChunks = 20,
  streamHeightChunks = 20,
} = {}) {
  const worldStore = createWorldStore();
  const camera = createCameraController({
    chunkSize: CHUNK_SIZE,
  });
  let lastStreamCenterChunk = null;

  function ensureStreamWindow() {
    const cameraChunk = camera.getChunkPosition();
    const streamCenterChanged =
      !lastStreamCenterChunk ||
      cameraChunk.x !== lastStreamCenterChunk.x ||
      cameraChunk.y !== lastStreamCenterChunk.y;
    if (streamCenterChanged) {
      worldStore.ensureWindow(
        cameraChunk.x,
        cameraChunk.y,
        streamWidthChunks,
        streamHeightChunks
      );
      lastStreamCenterChunk = { ...cameraChunk };
    }
    return cameraChunk;
  }

  function getVisibleChunkBounds(viewWidthPx, viewHeightPx, tilePixels) {
    const cameraTiles = camera.getTilePosition();
    const halfTilesX = viewWidthPx / tilePixels / 2;
    const halfTilesY = viewHeightPx / tilePixels / 2;

    const minTileX = Math.floor(cameraTiles.x - halfTilesX) - CHUNK_SIZE;
    const maxTileX = Math.ceil(cameraTiles.x + halfTilesX) + CHUNK_SIZE;
    const minTileY = Math.floor(cameraTiles.y - halfTilesY) - CHUNK_SIZE;
    const maxTileY = Math.ceil(cameraTiles.y + halfTilesY) + CHUNK_SIZE;

    return {
      minChunkX: Math.floor(minTileX / CHUNK_SIZE),
      maxChunkX: Math.floor(maxTileX / CHUNK_SIZE),
      minChunkY: Math.floor(minTileY / CHUNK_SIZE),
      maxChunkY: Math.floor(maxTileY / CHUNK_SIZE),
    };
  }

  function getVisibleChunks(viewWidthPx, viewHeightPx, tilePixels) {
    const bounds = getVisibleChunkBounds(viewWidthPx, viewHeightPx, tilePixels);
    const chunks = [];
    for (let chunkY = bounds.minChunkY; chunkY <= bounds.maxChunkY; chunkY += 1) {
      for (let chunkX = bounds.minChunkX; chunkX <= bounds.maxChunkX; chunkX += 1) {
        const rawChunk = worldStore.ensureChunk(chunkX, chunkY);
        chunks.push({
          chunkX,
          chunkY,
          chunk: buildChunkViewModel(chunkX, chunkY, rawChunk),
        });
      }
    }
    return {
      bounds,
      chunks,
    };
  }

  function buildChunkViewModel(chunkX, chunkY, rawChunk) {
    const assignmentTileId = Number(rawChunk.assignment?.tileId) || 0;
    const worldX = chunkX * CHUNK_SIZE;
    const worldY = chunkY * CHUNK_SIZE;
    const fillColor =
      CHUNK_PREVIEW_FILL_COLORS[
        assignmentTileId % CHUNK_PREVIEW_FILL_COLORS.length
      ];

    return {
      chunkX,
      chunkY,
      worldX,
      worldY,
      assignmentTileId,
      assignmentRotationTurns: rawChunk.assignment?.rotationTurns || 0,
      sockets: rawChunk.assignment?.sockets || { N: false, E: false, S: false, W: false },
      tileMap: rawChunk.tileMap,
      rooms: rawChunk.rooms || [],
      render: {
        fillColor,
        borderColor: CHUNK_PREVIEW_BORDER_COLOR,
        worldBounds: {
          x: worldX,
          y: worldY,
          w: CHUNK_SIZE,
          h: CHUNK_SIZE,
        },
      },
    };
  }

  function getFrameSnapshot(viewWidthPx, viewHeightPx, tilePixels) {
    const cameraTile = camera.getTilePosition();
    const cameraChunk = ensureStreamWindow();
    const visible = getVisibleChunks(viewWidthPx, viewHeightPx, tilePixels);
    const loadedBounds = worldStore.getLoadedBounds();
    const loadedChunkCount = worldStore.getLoadedChunkCount();
    const loadedWidth = Number.isFinite(loadedBounds.minX)
      ? loadedBounds.maxX - loadedBounds.minX + 1
      : 0;
    const loadedHeight = Number.isFinite(loadedBounds.minY)
      ? loadedBounds.maxY - loadedBounds.minY + 1
      : 0;

    return {
      chunkSize: CHUNK_SIZE,
      cameraTile,
      cameraChunk,
      visibleBounds: visible.bounds,
      visibleChunks: visible.chunks,
      visibleChunkCount: visible.chunks.length,
      loadedBounds,
      loadedChunkCount,
      loadedWidth,
      loadedHeight,
    };
  }

  function moveCameraBy(dxTiles, dyTiles) {
    return camera.moveBy(dxTiles, dyTiles);
  }

  function getCameraTilePosition() {
    return camera.getTilePosition();
  }

  function getLoadedBounds() {
    return worldStore.getLoadedBounds();
  }

  function getLoadedChunkCount() {
    return worldStore.getLoadedChunkCount();
  }

  return {
    chunkSize: CHUNK_SIZE,
    moveCameraBy,
    getCameraTilePosition,
    ensureStreamWindow,
    getVisibleChunkBounds,
    getVisibleChunks,
    getFrameSnapshot,
    getLoadedBounds,
    getLoadedChunkCount,
  };
}

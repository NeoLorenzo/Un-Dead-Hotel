import { CHUNK_SIZE } from "../../engine/procgen.js";
import {
  NEXTGEN_SEED,
  SPECIAL_SPACE_DEFS,
  TILE_ACCESS_RESERVED,
  TILE_ROOM_DOOR,
  TILE_ROOM_FLOOR,
  TILE_ROOM_WALL,
} from "../../engine/generation/chunkGenerator.js";
import { createCameraController } from "../../engine/world/cameraController.js";
import { createKeyboardPanInput, createZoomInput } from "../../engine/world/inputController.js";
import { createRuntimeHud } from "../../engine/world/runtimeHud.js";
import { createWorldStore } from "../../engine/world/worldStore.js";
import { createWorldSurface } from "../../engine/world/worldSurface.js";

const STREAM_WIDTH_CHUNKS = 20;
const STREAM_HEIGHT_CHUNKS = 20;
const START_TILE_PIXELS = 2;
const MAX_ZOOM_OUT_TILE_PIXELS = START_TILE_PIXELS;
const MAX_ZOOM_IN_TILE_PIXELS = 100;
const BASE_ZOOM_STEP = 1;
const MIN_ZOOM_SENSITIVITY = 0.55;
const MAX_ZOOM_SENSITIVITY = 2.6;
const ZOOM_SENSITIVITY_CURVE_POWER = 0.6;
const CAMERA_PAN_TILES_PER_SECOND = 42;
const PAN_SPEED_MULTIPLIER_AT_MAX_ZOOM_OUT = 3;
const PAN_SPEED_MULTIPLIER_AT_QUARTER_ZOOM = 0.9;
const PAN_SPEED_MULTIPLIER_AT_HALF_ZOOM = 0.5;
const PAN_SPEED_MULTIPLIER_AT_MAX_ZOOM_IN = 0.2;
const PAN_SPEED_ZOOM_CURVE_POWER = 0.85;
const ROOM_THIN_WALL_RATIO = 0.2;
let zoomStepAccumulator = 0;

function zoomSensitivity(tilePixels) {
  const range = MAX_ZOOM_IN_TILE_PIXELS - START_TILE_PIXELS;
  if (range <= 0) {
    return MIN_ZOOM_SENSITIVITY;
  }
  const normalized = (tilePixels - START_TILE_PIXELS) / range;
  const clamped = Math.max(0, Math.min(1, normalized));
  const shaped = clamped ** ZOOM_SENSITIVITY_CURVE_POWER;
  const ratio = MAX_ZOOM_SENSITIVITY / MIN_ZOOM_SENSITIVITY;
  return MIN_ZOOM_SENSITIVITY * ratio ** shaped;
}

function panSpeedMultiplier(tilePixels) {
  const range = MAX_ZOOM_IN_TILE_PIXELS - START_TILE_PIXELS;
  if (range <= 0) {
    return PAN_SPEED_MULTIPLIER_AT_MAX_ZOOM_OUT;
  }
  const normalized = (tilePixels - START_TILE_PIXELS) / range;
  const clamped = Math.max(0, Math.min(1, normalized));

  if (clamped <= 0.25) {
    const local = clamped / 0.25;
    const shaped = local ** PAN_SPEED_ZOOM_CURVE_POWER;
    return (
      PAN_SPEED_MULTIPLIER_AT_MAX_ZOOM_OUT -
      shaped * (PAN_SPEED_MULTIPLIER_AT_MAX_ZOOM_OUT - PAN_SPEED_MULTIPLIER_AT_QUARTER_ZOOM)
    );
  }

  if (clamped <= 0.5) {
    const local = (clamped - 0.25) / 0.25;
    const shaped = local ** PAN_SPEED_ZOOM_CURVE_POWER;
    return (
      PAN_SPEED_MULTIPLIER_AT_QUARTER_ZOOM -
      shaped * (PAN_SPEED_MULTIPLIER_AT_QUARTER_ZOOM - PAN_SPEED_MULTIPLIER_AT_HALF_ZOOM)
    );
  }

  const local = (clamped - 0.5) / 0.5;
  const shaped = local ** PAN_SPEED_ZOOM_CURVE_POWER;
  return (
    PAN_SPEED_MULTIPLIER_AT_HALF_ZOOM -
    shaped * (PAN_SPEED_MULTIPLIER_AT_HALF_ZOOM - PAN_SPEED_MULTIPLIER_AT_MAX_ZOOM_IN)
  );
}

const gameCanvas = document.getElementById("game-canvas");
const gameMeta = document.getElementById("game-meta");

if (!gameCanvas) {
  throw new Error("Game canvas not found.");
}

const worldStore = createWorldStore();
const worldSurface = createWorldSurface({
  canvas: gameCanvas,
  chunkSize: CHUNK_SIZE,
  tilePixels: START_TILE_PIXELS,
  roomThinWallRatio: ROOM_THIN_WALL_RATIO,
  specialSpaceDefs: SPECIAL_SPACE_DEFS,
  tileTypes: {
    corridor: 1,
    accessReserved: TILE_ACCESS_RESERVED,
    roomFloor: TILE_ROOM_FLOOR,
    roomWall: TILE_ROOM_WALL,
    roomDoor: TILE_ROOM_DOOR,
  },
});
const camera = createCameraController({
  chunkSize: CHUNK_SIZE,
});
const keyboardInput = createKeyboardPanInput({
  speedTilesPerSecond: CAMERA_PAN_TILES_PER_SECOND,
  onMove: (move) => {
    const multiplier = panSpeedMultiplier(worldSurface.getTilePixels());
    camera.moveBy(move.dx * multiplier, move.dy * multiplier);
    render();
  },
});
const zoomInput = createZoomInput({
  wheelTarget: gameCanvas,
  zoomStep: 1,
  onZoom: ({ delta }) => {
    const current = worldSurface.getTilePixels();
    const sensitivity = zoomSensitivity(current);
    zoomStepAccumulator += delta * BASE_ZOOM_STEP * sensitivity;

    const wholeSteps = zoomStepAccumulator > 0
      ? Math.floor(zoomStepAccumulator)
      : Math.ceil(zoomStepAccumulator);
    if (wholeSteps === 0) {
      return;
    }
    zoomStepAccumulator -= wholeSteps;

    const proposed = current + wholeSteps;
    const next = Math.max(
      MAX_ZOOM_OUT_TILE_PIXELS,
      Math.min(MAX_ZOOM_IN_TILE_PIXELS, proposed)
    );
    if (Math.abs(next - current) < 0.0001) {
      if (next === MAX_ZOOM_OUT_TILE_PIXELS || next === MAX_ZOOM_IN_TILE_PIXELS) {
        zoomStepAccumulator = 0;
      }
      return;
    }
    worldSurface.setTilePixels(next);
    render();
  },
});
const runtimeHud = createRuntimeHud({
  element: gameMeta,
  seed: NEXTGEN_SEED,
  streamWidthChunks: STREAM_WIDTH_CHUNKS,
  streamHeightChunks: STREAM_HEIGHT_CHUNKS,
});
let lastStreamCenterChunk = null;

function resizeCanvas() {
  worldSurface.resizeToWindow({
    margin: 24,
    reservedHeight: 150,
    minWidth: 640,
    minHeight: 400,
  });
}

function render() {
  const cameraChunk = camera.getChunkPosition();
  const streamCenterChanged =
    !lastStreamCenterChunk ||
    cameraChunk.x !== lastStreamCenterChunk.x ||
    cameraChunk.y !== lastStreamCenterChunk.y;
  if (streamCenterChanged) {
    worldStore.ensureWindow(cameraChunk.x, cameraChunk.y, STREAM_WIDTH_CHUNKS, STREAM_HEIGHT_CHUNKS);
    lastStreamCenterChunk = { ...cameraChunk };
  }

  const cameraTiles = camera.getTilePosition();
  const frame = worldSurface.render({
    cameraTileX: cameraTiles.x,
    cameraTileY: cameraTiles.y,
    ensureChunk: (chunkX, chunkY) => worldStore.ensureChunk(chunkX, chunkY),
  });

  const loadedBounds = worldStore.getLoadedBounds();
  runtimeHud.render({
    loadedChunkCount: worldStore.getLoadedChunkCount(),
    loadedBounds,
    cameraChunk,
    viewportChunksDrawn: frame.drawnChunks,
    zoomTilePixels: worldSurface.getTilePixels(),
  });
}

window.addEventListener("resize", () => {
  resizeCanvas();
  render();
});
keyboardInput.start();
zoomInput.start();

resizeCanvas();
worldStore.ensureWindow(0, 0, STREAM_WIDTH_CHUNKS, STREAM_HEIGHT_CHUNKS);
lastStreamCenterChunk = { x: 0, y: 0 };
render();

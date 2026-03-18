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
import { createKeyboardPanInput } from "../../engine/world/inputController.js";
import { createRuntimeHud } from "../../engine/world/runtimeHud.js";
import { createWorldStore } from "../../engine/world/worldStore.js";
import { createWorldSurface } from "../../engine/world/worldSurface.js";

const STREAM_WIDTH_CHUNKS = 20;
const STREAM_HEIGHT_CHUNKS = 20;
const TILE_PIXELS = 2;
const CAMERA_PAN_TILES = 8;
const ROOM_THIN_WALL_RATIO = 0.2;

const gameCanvas = document.getElementById("game-canvas");
const gameMeta = document.getElementById("game-meta");

if (!gameCanvas) {
  throw new Error("Game canvas not found.");
}

const worldStore = createWorldStore();
const worldSurface = createWorldSurface({
  canvas: gameCanvas,
  chunkSize: CHUNK_SIZE,
  tilePixels: TILE_PIXELS,
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
  stepTiles: CAMERA_PAN_TILES,
  onMove: (move) => {
    camera.moveBy(move.dx, move.dy);
    render();
  },
});
const runtimeHud = createRuntimeHud({
  element: gameMeta,
  seed: NEXTGEN_SEED,
  streamWidthChunks: STREAM_WIDTH_CHUNKS,
  streamHeightChunks: STREAM_HEIGHT_CHUNKS,
});

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
  worldStore.ensureWindow(cameraChunk.x, cameraChunk.y, STREAM_WIDTH_CHUNKS, STREAM_HEIGHT_CHUNKS);

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
  });
}

window.addEventListener("resize", () => {
  resizeCanvas();
  render();
});
keyboardInput.start();

resizeCanvas();
worldStore.ensureWindow(0, 0, STREAM_WIDTH_CHUNKS, STREAM_HEIGHT_CHUNKS);
render();

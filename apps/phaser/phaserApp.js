import {
  NEXTGEN_SEED,
  SPECIAL_SPACE_DEFS,
  TILE_ACCESS_RESERVED,
  TILE_ROOM_DOOR,
  TILE_ROOM_FLOOR,
  TILE_ROOM_WALL,
} from "../../engine/generation/chunkGenerator.js";
import { createRuntimeHud } from "../../engine/world/runtimeHud.js";
import { createPhaserRuntimeAdapter } from "./phaserRuntimeAdapter.js";

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const START_TILE_PIXELS = 5;
const MIN_TILE_PIXELS = START_TILE_PIXELS;
const MAX_TILE_PIXELS = 24;
const CAMERA_PAN_TILES_PER_SECOND = 42;
const PAN_ACCEL_TILES_PER_SECOND_SQUARED = 280;
const PAN_DECEL_TILES_PER_SECOND_SQUARED = 320;
const STREAM_WIDTH_CHUNKS = 20;
const STREAM_HEIGHT_CHUNKS = 20;
const BASE_ZOOM_STEP = 0.2;
const MIN_ZOOM_SENSITIVITY = 0.55;
const MAX_ZOOM_SENSITIVITY = 2.6;
const ZOOM_SENSITIVITY_CURVE_POWER = 0.6;
const ZOOM_LERP_SPEED_PER_SECOND = 18;
const MAX_CHUNK_TEXTURE_REBUILDS_PER_FRAME = 8;
const ROOM_THIN_WALL_RATIO = 0.2;

const TILE_CORRIDOR = 1;
const TILE_COLOR_CORRIDOR = "#1f1f1f";
const TILE_COLOR_ACCESS_RESERVED = "#8f8f8f";
const TILE_COLOR_ROOM = "#efefef";
const TILE_COLOR_ROOM_DOOR = "#ff9100";
const TILE_COLOR_DEFAULT = "#8f8f8f";
const TILE_COLOR_ROOM_THIN_WALL = "#8f8f8f";

const metaElement = document.getElementById("phaser-meta");
const mountElement = document.getElementById("phaser-game-root");

if (!mountElement) {
  throw new Error("Phaser mount element not found.");
}

const runtimeHud = createRuntimeHud({
  element: metaElement,
  seed: NEXTGEN_SEED,
  streamWidthChunks: STREAM_WIDTH_CHUNKS,
  streamHeightChunks: STREAM_HEIGHT_CHUNKS,
});

function zoomSensitivity(tilePixels) {
  const range = MAX_TILE_PIXELS - START_TILE_PIXELS;
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
  const range = MAX_TILE_PIXELS - START_TILE_PIXELS;
  if (range <= 0) {
    return 1;
  }
  const normalized = (tilePixels - START_TILE_PIXELS) / range;
  const clamped = Math.max(0, Math.min(1, normalized));
  return 3 - clamped * 2.8;
}

function moveTowards(current, target, maxStep) {
  if (current < target) {
    return Math.min(current + maxStep, target);
  }
  return Math.max(current - maxStep, target);
}

function chunkKey(chunkX, chunkY) {
  return `${chunkX},${chunkY}`;
}

function tileColor(tile) {
  if (tile === TILE_CORRIDOR) {
    return TILE_COLOR_CORRIDOR;
  }
  if (tile === TILE_ACCESS_RESERVED) {
    return TILE_COLOR_ACCESS_RESERVED;
  }
  if (tile === TILE_ROOM_FLOOR || tile === TILE_ROOM_WALL) {
    return TILE_COLOR_ROOM;
  }
  if (tile === TILE_ROOM_DOOR) {
    return TILE_COLOR_ROOM_DOOR;
  }
  if (tile >= 2 && tile < 2 + SPECIAL_SPACE_DEFS.length) {
    const special = SPECIAL_SPACE_DEFS[tile - 2];
    return special ? special.color : TILE_COLOR_DEFAULT;
  }
  return TILE_COLOR_DEFAULT;
}

function drawThinExteriorWallsForRooms(
  ctx,
  rooms,
  tileMap,
  mapWidth,
  tilePixels
) {
  const thickness = Math.max(1, Math.round(tilePixels * ROOM_THIN_WALL_RATIO));
  ctx.fillStyle = TILE_COLOR_ROOM_THIN_WALL;

  for (const room of rooms) {
    const xMin = room.x;
    const xMax = room.x + room.w - 1;
    const yMin = room.y;
    const yMax = room.y + room.h - 1;

    for (let x = xMin; x <= xMax; x += 1) {
      const topIdx = yMin * mapWidth + x;
      if (tileMap[topIdx] === TILE_ROOM_WALL && tileMap[topIdx] !== TILE_ROOM_DOOR) {
        ctx.fillRect(x * tilePixels, yMin * tilePixels, tilePixels, thickness);
      }

      const bottomIdx = yMax * mapWidth + x;
      if (tileMap[bottomIdx] === TILE_ROOM_WALL && tileMap[bottomIdx] !== TILE_ROOM_DOOR) {
        ctx.fillRect(
          x * tilePixels,
          (yMax + 1) * tilePixels - thickness,
          tilePixels,
          thickness
        );
      }
    }

    for (let y = yMin; y <= yMax; y += 1) {
      const leftIdx = y * mapWidth + xMin;
      if (tileMap[leftIdx] === TILE_ROOM_WALL && tileMap[leftIdx] !== TILE_ROOM_DOOR) {
        ctx.fillRect(xMin * tilePixels, y * tilePixels, thickness, tilePixels);
      }

      const rightIdx = y * mapWidth + xMax;
      if (tileMap[rightIdx] === TILE_ROOM_WALL && tileMap[rightIdx] !== TILE_ROOM_DOOR) {
        ctx.fillRect(
          (xMax + 1) * tilePixels - thickness,
          y * tilePixels,
          thickness,
          tilePixels
        );
      }
    }
  }
}

function drawChunkToCanvas(canvas, chunk, chunkSize, tilePixels) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Chunk texture context is unavailable.");
  }
  ctx.imageSmoothingEnabled = false;

  const tileMap = chunk.tileMap;
  for (let y = 0; y < chunkSize; y += 1) {
    for (let x = 0; x < chunkSize; x += 1) {
      ctx.fillStyle = tileColor(tileMap[y * chunkSize + x]);
      ctx.fillRect(x * tilePixels, y * tilePixels, tilePixels, tilePixels);
    }
  }

  if (chunk.rooms && chunk.rooms.length > 0) {
    drawThinExteriorWallsForRooms(ctx, chunk.rooms, tileMap, chunkSize, tilePixels);
  }
}

async function loadPhaserModule() {
  const urls = [
    "https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.esm.js",
    "https://unpkg.com/phaser@3.90.0/dist/phaser.esm.js",
  ];

  for (const url of urls) {
    try {
      const module = await import(url);
      return module.default || module;
    } catch (_error) {
      // Try next CDN.
    }
  }

  throw new Error("Unable to load Phaser from configured CDNs.");
}

function createRuntimeScene(Phaser) {
  return class RuntimeScene extends Phaser.Scene {
    constructor() {
      super("runtime");
      this.runtime = null;
      this.tilePixels = START_TILE_PIXELS;
      this.targetTilePixels = START_TILE_PIXELS;
      this.keys = null;
      this.panVelocity = { x: 0, y: 0 };
      this.dirty = true;
      this.chunkImages = new Map();
      this.chunkTextures = new Map();
      this.chunkTextureSerial = 0;
      this.chunkFallbackGraphics = null;
      this.chunkBorderGraphics = null;
      this.pendingChunkTextures = 0;
    }

    create() {
      this.runtime = createPhaserRuntimeAdapter({
        streamWidthChunks: STREAM_WIDTH_CHUNKS,
        streamHeightChunks: STREAM_HEIGHT_CHUNKS,
      });
      this.runtime.ensureStreamWindow();

      this.cameras.main.setBackgroundColor("#101015");
      this.cameras.main.roundPixels = true;

      this.chunkFallbackGraphics = this.add.graphics();
      this.chunkBorderGraphics = this.add.graphics();

      this.keys = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
      });

      this.input.on("wheel", (_pointer, _go, _dx, dy) => {
        const direction = Math.sign(-dy);
        const magnitude = Math.min(Math.abs(dy), 120) / 120;
        const sensitivity = zoomSensitivity(this.targetTilePixels);
        const zoomDelta = direction * magnitude * BASE_ZOOM_STEP * sensitivity;
        const next = Phaser.Math.Clamp(
          this.targetTilePixels + zoomDelta,
          MIN_TILE_PIXELS,
          MAX_TILE_PIXELS
        );
        if (Math.abs(next - this.targetTilePixels) > 0.0001) {
          this.targetTilePixels = next;
          this.dirty = true;
        }
      });

      this.scale.on("resize", () => {
        this.dirty = true;
      });

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        for (const [, image] of this.chunkImages) {
          image.destroy();
        }
        for (const [, entry] of this.chunkTextures) {
          if (this.textures.exists(entry.textureKey)) {
            this.textures.remove(entry.textureKey);
          }
        }
        this.chunkImages.clear();
        this.chunkTextures.clear();
      });

      this.dirty = true;
    }

    update(_time, delta) {
      const dt = Math.min(delta / 1000, 0.05);
      let dx = 0;
      let dy = 0;

      if (this.keys.left.isDown) {
        dx -= 1;
      }
      if (this.keys.right.isDown) {
        dx += 1;
      }
      if (this.keys.up.isDown) {
        dy -= 1;
      }
      if (this.keys.down.isDown) {
        dy += 1;
      }

      let targetVx = 0;
      let targetVy = 0;
      if (dx !== 0 || dy !== 0) {
        const length = Math.hypot(dx, dy);
        const speed = CAMERA_PAN_TILES_PER_SECOND * panSpeedMultiplier(this.tilePixels);
        targetVx = (dx / length) * speed;
        targetVy = (dy / length) * speed;
      }

      const accelerating = dx !== 0 || dy !== 0;
      const accel = accelerating
        ? PAN_ACCEL_TILES_PER_SECOND_SQUARED
        : PAN_DECEL_TILES_PER_SECOND_SQUARED;
      const maxStep = accel * dt;
      const nextVx = moveTowards(this.panVelocity.x, targetVx, maxStep);
      const nextVy = moveTowards(this.panVelocity.y, targetVy, maxStep);
      if (
        Math.abs(nextVx - this.panVelocity.x) > 0.0001 ||
        Math.abs(nextVy - this.panVelocity.y) > 0.0001
      ) {
        this.panVelocity.x = nextVx;
        this.panVelocity.y = nextVy;
        this.dirty = true;
      }

      if (Math.abs(this.panVelocity.x) > 0.0001 || Math.abs(this.panVelocity.y) > 0.0001) {
        this.runtime.moveCameraBy(this.panVelocity.x * dt, this.panVelocity.y * dt);
        this.dirty = true;
      }

      const zoomBlend = 1 - Math.exp(-ZOOM_LERP_SPEED_PER_SECOND * dt);
      const nextTilePixels = Phaser.Math.Linear(
        this.tilePixels,
        this.targetTilePixels,
        zoomBlend
      );
      if (Math.abs(nextTilePixels - this.tilePixels) > 0.0001) {
        this.tilePixels = nextTilePixels;
        this.dirty = true;
      } else if (this.tilePixels !== this.targetTilePixels) {
        this.tilePixels = this.targetTilePixels;
        this.dirty = true;
      }

      if (this.dirty) {
        this.renderRuntimeFrame();
        this.dirty = false;
      }
    }

    buildChunkTexture(chunkKeyValue, chunk, pixelSize, chunkSize) {
      const tilePixels = pixelSize / chunkSize;
      const canvas = document.createElement("canvas");
      canvas.width = pixelSize;
      canvas.height = pixelSize;
      drawChunkToCanvas(canvas, chunk, chunkSize, tilePixels);

      const textureKey = `chunk-${chunkKeyValue}-${pixelSize}-${this.chunkTextureSerial}`;
      this.chunkTextureSerial += 1;

      if (this.textures.exists(textureKey)) {
        this.textures.remove(textureKey);
      }
      this.textures.addCanvas(textureKey, canvas);

      return {
        textureKey,
        pixelSize,
      };
    }

    ensureChunkImage(chunkKeyValue, textureKey) {
      let image = this.chunkImages.get(chunkKeyValue);
      if (!image) {
        image = this.add.image(0, 0, textureKey);
        image.setOrigin(0, 0);
        image.setVisible(true);
        this.chunkImages.set(chunkKeyValue, image);
      } else if (image.texture.key !== textureKey) {
        image.setTexture(textureKey);
      }
      return image;
    }

    renderRuntimeFrame() {
      const width = this.scale.width;
      const height = this.scale.height;
      const snapshot = this.runtime.getFrameSnapshot(width, height, this.tilePixels);
      const visibleKeys = new Set();
      const expectedPixelSize = Math.max(1, Math.round(snapshot.chunkSize * this.tilePixels));
      const displayPixels = Math.max(
        1,
        Math.ceil(snapshot.chunkSize * this.tilePixels) + 1
      );
      let rebuildBudget = MAX_CHUNK_TEXTURE_REBUILDS_PER_FRAME;
      let pendingChunkTextures = 0;

      this.chunkFallbackGraphics.clear();
      this.chunkBorderGraphics.clear();
      this.chunkFallbackGraphics.fillStyle(0x2d333b, 0.55);
      this.chunkBorderGraphics.lineStyle(1, 0x888888, 0.35);

      for (const item of snapshot.visibleChunks) {
        const key = chunkKey(item.chunkX, item.chunkY);
        const screenX = Math.round(
          (item.chunk.worldX - snapshot.cameraTile.x) * this.tilePixels + width / 2
        );
        const screenY = Math.round(
          (item.chunk.worldY - snapshot.cameraTile.y) * this.tilePixels + height / 2
        );
        let cache = this.chunkTextures.get(key);
        let oldTextureKey = null;

        if (!cache || cache.pixelSize !== expectedPixelSize) {
          if (rebuildBudget > 0) {
            oldTextureKey = cache ? cache.textureKey : null;
            cache = this.buildChunkTexture(key, item.chunk, expectedPixelSize, snapshot.chunkSize);
            this.chunkTextures.set(key, cache);
            rebuildBudget -= 1;
          } else {
            pendingChunkTextures += 1;
          }
        }

        if (cache) {
          const image = this.ensureChunkImage(key, cache.textureKey);
          image.setPosition(screenX, screenY);
          image.setDisplaySize(displayPixels, displayPixels);
          image.setVisible(true);

          if (
            oldTextureKey &&
            oldTextureKey !== cache.textureKey &&
            this.textures.exists(oldTextureKey)
          ) {
            this.textures.remove(oldTextureKey);
          }
        } else {
          this.chunkFallbackGraphics.fillRect(screenX, screenY, displayPixels, displayPixels);
        }

        this.chunkBorderGraphics.strokeRect(
          screenX + 0.5,
          screenY + 0.5,
          displayPixels - 1,
          displayPixels - 1
        );

        visibleKeys.add(key);
      }

      for (const [key, image] of this.chunkImages) {
        if (!visibleKeys.has(key)) {
          image.setVisible(false);
        }
      }

      this.chunkBorderGraphics.lineStyle(1, 0xffffff, 0.4);
      this.chunkBorderGraphics.beginPath();
      this.chunkBorderGraphics.moveTo(width / 2 - 12, height / 2);
      this.chunkBorderGraphics.lineTo(width / 2 + 12, height / 2);
      this.chunkBorderGraphics.moveTo(width / 2, height / 2 - 12);
      this.chunkBorderGraphics.lineTo(width / 2, height / 2 + 12);
      this.chunkBorderGraphics.strokePath();

      this.pendingChunkTextures = pendingChunkTextures;
      if (pendingChunkTextures > 0) {
        this.dirty = true;
      }

      runtimeHud.render({
        loadedChunkCount: snapshot.loadedChunkCount,
        loadedBounds: snapshot.loadedBounds,
        cameraChunk: snapshot.cameraChunk,
        viewportChunksDrawn: snapshot.visibleChunkCount,
        zoomTilePixels: this.tilePixels,
      });
      if (metaElement) {
        metaElement.textContent +=
          ` | Pending chunk textures: ${pendingChunkTextures} | Phaser: ${Phaser.VERSION}`;
      }
    }
  };
}

async function bootPhaserRuntime() {
  try {
    const Phaser = await loadPhaserModule();
    const RuntimeScene = createRuntimeScene(Phaser);

    new Phaser.Game({
      type: Phaser.AUTO,
      parent: "phaser-game-root",
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      pixelArt: true,
      backgroundColor: "#101015",
      scene: [RuntimeScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });
  } catch (error) {
    if (metaElement) {
      metaElement.textContent = `Phaser runtime failed to load: ${error.message}`;
    }
    mountElement.textContent =
      "Unable to load Phaser runtime. Check internet access or CDN blocking.";
  }
}

bootPhaserRuntime();

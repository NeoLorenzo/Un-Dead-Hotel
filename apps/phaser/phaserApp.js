import {
  NEXTGEN_SEED,
  SPECIAL_SPACE_DEFS,
  TILE_ACCESS_RESERVED,
  TILE_ROOM_DOOR,
  TILE_ROOM_FLOOR,
  TILE_ROOM_WALL,
} from "../../engine/generation/chunkGenerator.js";
import { createSubTilePathfinder } from "../../engine/world/subTilePathfinder.js";
import { createRuntimeHud } from "../../engine/world/runtimeHud.js";
import { createPhaserRuntimeAdapter } from "./phaserRuntimeAdapter.js";
import { createHumanDebugOverlay } from "./debug/humanDebugOverlay.js";
import { createFirstContactDiagnosticsPanel } from "./debug/firstContactDiagnosticsPanel.js";
import { createRuntimeDebugController } from "./debug/runtimeDebugController.js";
import { createZombieDebugOverlay } from "./debug/zombieDebugOverlay.js";
import { createHumanCommandController } from "./human/humanCommandController.js";
import { createGuestMentalModelConfig } from "./human/guestMentalModel.js";
import { createHumanManager } from "./human/humanManager.js";
import { createHumanSelectionController } from "./human/humanSelectionController.js";
import { createAgentHpBarOverlay } from "./ui/agentHpBarOverlay.js";
import { createGameOverOverlay } from "./ui/gameOverOverlay.js";
import { createZombieManager } from "./zombie/zombieManager.js";
import { createFurnitureCatalog } from "./furniture/furnitureCatalog.js";
import {
  createDeterministicFurnitureId,
  createFurnitureStateStore,
} from "./furniture/furnitureStateStore.js";

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const START_TILE_PIXELS = 5;
const MIN_TILE_PIXELS = START_TILE_PIXELS;
const MAX_TILE_PIXELS = 60;
const CAMERA_PAN_TILES_PER_SECOND = 42;
const PAN_ACCEL_TILES_PER_SECOND_SQUARED = 280;
const PAN_DECEL_TILES_PER_SECOND_SQUARED = 320;
const STREAM_WIDTH_CHUNKS = 20;
const STREAM_HEIGHT_CHUNKS = 20;
const BASE_ZOOM_STEP = 0.2;
const MIN_ZOOM_SENSITIVITY = 1.0;
const MAX_ZOOM_SENSITIVITY = 50.0;
const ZOOM_SENSITIVITY_CURVE_POWER = 0.6;
const ZOOM_LERP_SPEED_PER_SECOND = 18;
const MAX_CHUNK_TEXTURE_REBUILDS_PER_FRAME = 8;
const CHUNK_TEXTURE_TILE_PIXEL_TIERS = [
  ...Array.from({ length: 16 }, (_, i) => START_TILE_PIXELS + i),
  24,
  28,
  32,
  36,
  40,
  44,
  48,
  52,
  56,
  60,
];
const CHUNK_TEXTURE_SWITCH_HYSTERESIS_PX = 0.75;
const CHUNK_TEXTURE_REBUILD_DEBOUNCE_MS = 100;
const CHUNK_TEXTURE_ZOOM_SETTLE_EPSILON = 0.02;
const ROOM_THIN_WALL_RATIO = 0.2;
const HUMAN_MOVE_SPEED_TILES_PER_SECOND = 2.4;
const HUMAN_SPAWN_SEARCH_RADIUS_TILES = 10;
const HUMAN_COMMAND_MAX_PATH_NODES = 32000;
const HUMAN_COMMAND_NAV_PADDING_EXPANSION_FACTORS = [1, 2, 4, 8];
const HUMAN_COMMAND_MAX_DYNAMIC_EXPANSION_ATTEMPTS = 7;
const HUMAN_COMMAND_MAX_AUTO_PADDING_TILES = 1536;
const ZOMBIE_SPAWN_SEARCH_RADIUS_TILES = 3;
const FIRST_CONTACT_ZOMBIE_SPEED_RATIO_OF_HUMAN = 0.5;
const FIRST_CONTACT_ZOMBIE_MOVE_SPEED_TILES_PER_SECOND =
  HUMAN_MOVE_SPEED_TILES_PER_SECOND * FIRST_CONTACT_ZOMBIE_SPEED_RATIO_OF_HUMAN;
const FIRST_CONTACT_ZOMBIE_TARGET_COUNT = 100;
const FIRST_CONTACT_ZOMBIE_MIN_SPAWN_RADIUS_TILES = 10;
const FIRST_CONTACT_ZOMBIE_MAX_SPAWN_RADIUS_TILES = 100;
const FIRST_CONTACT_GUEST_TARGET_RATIO_OF_ZOMBIES = 0.1;
const FIRST_CONTACT_GUEST_TARGET_COUNT = Math.max(
  0,
  Math.floor(
    FIRST_CONTACT_ZOMBIE_TARGET_COUNT * FIRST_CONTACT_GUEST_TARGET_RATIO_OF_ZOMBIES
  )
);
const FIRST_CONTACT_GUEST_MIN_SPAWN_RADIUS_TILES =
  FIRST_CONTACT_ZOMBIE_MIN_SPAWN_RADIUS_TILES;
const FIRST_CONTACT_GUEST_MAX_SPAWN_RADIUS_TILES =
  FIRST_CONTACT_ZOMBIE_MAX_SPAWN_RADIUS_TILES;
const DEBUG_TOGGLE_KEYS = new Set(["`", "~"]);
const PAUSE_TOGGLE_CODES = new Set(["Space"]);
const RUNTIME_MODE_ZOMBIE_WANDER = "zombie_wander";
const RUNTIME_MODE_FIRST_CONTACT = "first_contact";
const RUNTIME_MODE = RUNTIME_MODE_FIRST_CONTACT;
const HUMAN_SYSTEMS_ENABLED = RUNTIME_MODE === RUNTIME_MODE_FIRST_CONTACT;
const ZOMBIE_SYSTEMS_ENABLED =
  RUNTIME_MODE === RUNTIME_MODE_ZOMBIE_WANDER ||
  RUNTIME_MODE === RUNTIME_MODE_FIRST_CONTACT;
const ZOMBIE_MANUAL_SPAWN_ENABLED = RUNTIME_MODE === RUNTIME_MODE_ZOMBIE_WANDER;

const TILE_CORRIDOR = 1;
const TILE_COLOR_CORRIDOR = "#1f1f1f";
const TILE_COLOR_ACCESS_RESERVED = "#8f8f8f";
const TILE_COLOR_ROOM = "#efefef";
const TILE_COLOR_ROOM_DOOR = "#ff9100";
const TILE_COLOR_DEFAULT = "#8f8f8f";
const TILE_COLOR_ROOM_THIN_WALL = "#8f8f8f";
const runtimeFurnitureCatalog = createFurnitureCatalog();

const metaElement = document.getElementById("game-meta");
const mountElement = document.getElementById("game-root");
const runtimeOverlayElement = document.getElementById("runtime-overlay");
const gameClockElement = document.getElementById("game-clock");
const diagnosticsTextToggleElement = document.getElementById("toggle-diagnostics-text");
const visionDebugToggleElement = document.getElementById("toggle-debug-vision");
const trackInspectedGuestToggleElement = document.getElementById(
  "toggle-track-inspected-guest"
);

if (!mountElement) {
  throw new Error("Game runtime mount element not found.");
}

function setRuntimeOverlayVisible(visible) {
  if (!runtimeOverlayElement) {
    return;
  }
  runtimeOverlayElement.hidden = !visible;
}

function resolveRuntimeOverlayBottomInsetPx() {
  if (!runtimeOverlayElement || runtimeOverlayElement.hidden) {
    return 0;
  }
  const overlayRect = runtimeOverlayElement.getBoundingClientRect();
  if (overlayRect.width <= 0 || overlayRect.height <= 0) {
    return 0;
  }
  const mountRect = mountElement?.getBoundingClientRect?.();
  const mountTop = Number.isFinite(mountRect?.top) ? mountRect.top : 0;
  return Math.max(0, Math.round(overlayRect.bottom - mountTop + 8));
}

setRuntimeOverlayVisible(false);

const runtimeHud = createRuntimeHud({
  element: metaElement,
  clockElement: gameClockElement,
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

function loadedBoundsKey(loadedBounds) {
  const minX = Number(loadedBounds?.minX);
  const maxX = Number(loadedBounds?.maxX);
  const minY = Number(loadedBounds?.minY);
  const maxY = Number(loadedBounds?.maxY);
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxY)
  ) {
    return "none";
  }
  return `${minX},${minY},${maxX},${maxY}`;
}

function nearestChunkTextureTilePixels(tilePixels) {
  if (CHUNK_TEXTURE_TILE_PIXEL_TIERS.length === 0) {
    return Math.max(MIN_TILE_PIXELS, Math.min(MAX_TILE_PIXELS, Math.round(tilePixels)));
  }

  let nearest = CHUNK_TEXTURE_TILE_PIXEL_TIERS[0];
  let bestDistance = Math.abs(tilePixels - nearest);

  for (let i = 1; i < CHUNK_TEXTURE_TILE_PIXEL_TIERS.length; i += 1) {
    const candidate = CHUNK_TEXTURE_TILE_PIXEL_TIERS[i];
    const distance = Math.abs(tilePixels - candidate);
    if (distance < bestDistance) {
      nearest = candidate;
      bestDistance = distance;
    }
  }

  return nearest;
}

function resolveChunkTextureTilePixels(tilePixels, currentTierTilePixels) {
  const clampedTilePixels = Math.max(MIN_TILE_PIXELS, Math.min(MAX_TILE_PIXELS, tilePixels));
  const nearest = nearestChunkTextureTilePixels(clampedTilePixels);
  if (!Number.isFinite(currentTierTilePixels)) {
    return nearest;
  }
  if (nearest === currentTierTilePixels) {
    return currentTierTilePixels;
  }
  if (!CHUNK_TEXTURE_TILE_PIXEL_TIERS.includes(currentTierTilePixels)) {
    return nearest;
  }

  const midpoint = (nearest + currentTierTilePixels) * 0.5;
  if (nearest > currentTierTilePixels) {
    return clampedTilePixels >= midpoint + CHUNK_TEXTURE_SWITCH_HYSTERESIS_PX
      ? nearest
      : currentTierTilePixels;
  }

  return clampedTilePixels <= midpoint - CHUNK_TEXTURE_SWITCH_HYSTERESIS_PX
    ? nearest
    : currentTierTilePixels;
}

function screenToWorldTileSpace(screenX, screenY, cameraTile, tilePixels, width, height) {
  return {
    x: cameraTile.x + (screenX - width * 0.5) / tilePixels,
    y: cameraTile.y + (screenY - height * 0.5) / tilePixels,
  };
}

function resolveRendererLabel(Phaser, rendererType) {
  if (rendererType === Phaser.WEBGL) {
    return "WEBGL";
  }
  if (rendererType === Phaser.CANVAS) {
    return "CANVAS";
  }
  if (Number.isFinite(rendererType)) {
    return `TYPE_${rendererType}`;
  }
  return "UNKNOWN";
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

function furnitureTypeColor(typeId) {
  if (typeId === "bed") {
    return "#5e8fcb";
  }
  if (typeId === "nightstand") {
    return "#d49f64";
  }
  if (typeId === "closet") {
    return "#8f6bd1";
  }
  if (typeId === "sink") {
    return "#5cc4d6";
  }
  if (typeId === "mini_bar") {
    return "#f08aa9";
  }
  if (typeId === "chair") {
    return "#7ba95f";
  }
  if (typeId === "table") {
    return "#be8b5f";
  }
  return "#666666";
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

  const furnitureDescriptors = Array.isArray(chunk?.furnitureDescriptors)
    ? chunk.furnitureDescriptors
    : [];
  for (const descriptor of furnitureDescriptors) {
    const typeId = String(descriptor?.typeId || "");
    const typeDef = runtimeFurnitureCatalog[typeId];
    if (!typeDef) {
      continue;
    }
    const tileX = Math.floor(Number(descriptor?.tileX));
    const tileY = Math.floor(Number(descriptor?.tileY));
    if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
      continue;
    }
    const widthTiles = Math.max(1, Number(typeDef?.footprint?.widthTiles) || 1);
    const heightTiles = Math.max(1, Number(typeDef?.footprint?.heightTiles) || 1);
    const leftPx = tileX * tilePixels;
    const topPx = tileY * tilePixels;
    const widthPx = widthTiles * tilePixels;
    const heightPx = heightTiles * tilePixels;
    const color = furnitureTypeColor(typeId);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(leftPx, topPx, widthPx, heightPx);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 1;
    ctx.strokeRect(leftPx + 0.5, topPx + 0.5, widthPx - 1, heightPx - 1);
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
      this.chunkTextureTilePixels = START_TILE_PIXELS;
      this.chunkTextureTierLocked = false;
      this.lastZoomInputAtMs = -Infinity;
      this.pendingChunkTextures = 0;
      this.humanController = null;
      this.humanManager = null;
      this.humanSelectionController = null;
      this.humanCommandController = null;
      this.humanDebugOverlay = null;
      this.zombieManager = null;
      this.zombieDebugOverlay = null;
      this.firstContactDiagnosticsPanel = null;
      this.debugController = null;
      this.agentHpBarOverlay = null;
      this.gameOverOverlay = null;
      this.gameOverActive = false;
      this.furnitureStateStore = null;
      this.lastFurnitureHydrationBoundsKey = "none";
      this.furnitureHydratedRecordCount = 0;
      this.furnitureHydratedTileCount = 0;
      this.furnitureHydratedChunkCount = 0;
      this.furnitureHydrationError = null;
      this.clockDisplay = { dayLabel: "Day 1", timeLabel: "00:00" };
      this.humanCommandDebugBridge = null;
      this.humanManagerDebugBridge = null;
      this.zombieManagerDebugBridge = null;
      this.debugOverlayEnabled = false;
      this.simulationPaused = false;
      this.diagnosticsTextVisible = false;
      this.debugVisionEnabled = true;
      this.trackInspectedGuestEnabled = false;
      this.handlePointerDown = null;
      this.handlePointerMove = null;
      this.handlePointerUp = null;
      this.handleDebugKeyDown = null;
      this.handlePauseKeyDown = null;
      this.handleDiagnosticsTextToggleClick = null;
      this.handleVisionDebugToggleClick = null;
      this.handleTrackInspectedGuestToggleClick = null;
    }

    applyDebugUiSettings() {
      if (
        this.firstContactDiagnosticsPanel &&
        typeof this.firstContactDiagnosticsPanel.setTextVisible === "function"
      ) {
        this.firstContactDiagnosticsPanel.setTextVisible(this.diagnosticsTextVisible);
      }

      if (
        this.humanDebugOverlay &&
        typeof this.humanDebugOverlay.setVisionDebugEnabled === "function"
      ) {
        this.humanDebugOverlay.setVisionDebugEnabled(this.debugVisionEnabled);
      }

      if (
        this.zombieDebugOverlay &&
        typeof this.zombieDebugOverlay.setVisionDebugEnabled === "function"
      ) {
        this.zombieDebugOverlay.setVisionDebugEnabled(this.debugVisionEnabled);
      }
    }

    refreshDebugControlButtons() {
      if (diagnosticsTextToggleElement) {
        const diagnosticsSupported =
          this.firstContactDiagnosticsPanel &&
          typeof this.firstContactDiagnosticsPanel.setTextVisible === "function";
        diagnosticsTextToggleElement.disabled = !diagnosticsSupported;
        diagnosticsTextToggleElement.textContent = diagnosticsSupported
          ? `Diagnostics Text: ${this.diagnosticsTextVisible ? "On" : "Off"}`
          : "Diagnostics Text: Unavailable";
        diagnosticsTextToggleElement.setAttribute(
          "aria-pressed",
          this.diagnosticsTextVisible ? "true" : "false"
        );
      }

      if (visionDebugToggleElement) {
        const visionSupported =
          (this.humanDebugOverlay &&
            typeof this.humanDebugOverlay.setVisionDebugEnabled === "function") ||
          (this.zombieDebugOverlay &&
            typeof this.zombieDebugOverlay.setVisionDebugEnabled === "function");
        visionDebugToggleElement.disabled = !visionSupported;
        visionDebugToggleElement.textContent = visionSupported
          ? `Vision Cones/Rays: ${this.debugVisionEnabled ? "On" : "Off"}`
          : "Vision Cones/Rays: Unavailable";
        visionDebugToggleElement.setAttribute(
          "aria-pressed",
          this.debugVisionEnabled ? "true" : "false"
        );
      }

      if (trackInspectedGuestToggleElement) {
        const trackingSupported =
          this.humanDebugOverlay &&
          typeof this.humanDebugOverlay.getInspectedGuestWorld === "function";
        if (!trackingSupported && this.trackInspectedGuestEnabled) {
          this.trackInspectedGuestEnabled = false;
        }
        trackInspectedGuestToggleElement.disabled = !trackingSupported;
        trackInspectedGuestToggleElement.textContent = trackingSupported
          ? `Track Inspected Guest: ${this.trackInspectedGuestEnabled ? "On" : "Off"}`
          : "Track Inspected Guest: Unavailable";
        trackInspectedGuestToggleElement.setAttribute(
          "aria-pressed",
          this.trackInspectedGuestEnabled ? "true" : "false"
        );
      }
    }

    buildFrameDebugSnapshot() {
      return {
        humanManager:
          typeof this.humanManager?.getDebugState === "function"
            ? this.humanManager.getDebugState()
            : null,
        zombieManager:
          typeof this.zombieManager?.getDebugState === "function"
            ? this.zombieManager.getDebugState()
            : null,
        humanCommand:
          typeof this.humanCommandController?.getDebugState === "function"
            ? this.humanCommandController.getDebugState()
            : null,
        primaryHuman:
          typeof this.humanController?.getDebugState === "function"
            ? this.humanController.getDebugState()
            : null,
        furniture: this.buildFurnitureDebugSnapshot(),
      };
    }

    buildFurnitureDebugSnapshot() {
      if (!this.furnitureStateStore) {
        return null;
      }
      const records = this.furnitureStateStore.getFurnitureRecords();
      const occupiedTiles = this.furnitureStateStore.getOccupiedTileEntries();
      const typeCounts = {};
      for (const record of records) {
        const typeId = String(record?.typeId || "unknown");
        typeCounts[typeId] = (typeCounts[typeId] || 0) + 1;
      }
      return {
        recordCount: records.length,
        occupiedTileCount: occupiedTiles.length,
        occupiedTiles,
        typeCounts,
        sampleFurnitureIds: records.slice(0, 5).map((record) => String(record.furnitureId)),
        sampleOccupiedTiles: occupiedTiles
          .slice(0, 5)
          .map((entry) => `${entry.tileKey}=>${entry.furnitureId}`),
      };
    }

    hydrateFurnitureStateFromLoadedChunks(loadedChunkViewModels) {
      if (!this.furnitureStateStore) {
        return;
      }

      try {
        const chunkSize = Number(this.runtime?.chunkSize) || 32;
        const records = [];

        for (const item of loadedChunkViewModels || []) {
          const chunkX = Number(item?.chunkX);
          const chunkY = Number(item?.chunkY);
          if (!Number.isFinite(chunkX) || !Number.isFinite(chunkY)) {
            continue;
          }

          const furnitureDescriptors = Array.isArray(item?.chunk?.furnitureDescriptors)
            ? item.chunk.furnitureDescriptors
            : [];

          for (const descriptor of furnitureDescriptors) {
            const typeId = String(descriptor?.typeId || "");
            const roomId = String(descriptor?.roomId || "");
            const spawnSlotId = String(descriptor?.spawnSlotId || "");
            const orientation = String(descriptor?.orientation || "north");
            const localTileX = Math.floor(Number(descriptor?.tileX));
            const localTileY = Math.floor(Number(descriptor?.tileY));

            if (
              !typeId ||
              !roomId ||
              !spawnSlotId ||
              !Number.isFinite(localTileX) ||
              !Number.isFinite(localTileY)
            ) {
              continue;
            }

            const worldTileX = chunkX * chunkSize + localTileX;
            const worldTileY = chunkY * chunkSize + localTileY;
            const furnitureId = createDeterministicFurnitureId({
              chunkX,
              chunkY,
              roomId,
              spawnSlotId,
              typeId,
            });

            records.push({
              furnitureId,
              typeId,
              tileX: worldTileX,
              tileY: worldTileY,
              orientation,
              chunkX,
              chunkY,
              roomId,
              spawnSlotId,
              inventory: [],
              resourceState: {},
            });
          }
        }

        this.furnitureStateStore.setFurnitureRecords(records, { replace: true });
        this.furnitureHydratedRecordCount = this.furnitureStateStore.getFurnitureRecords().length;
        this.furnitureHydratedTileCount = this.furnitureStateStore.getOccupiedTileEntries().length;
        this.furnitureHydratedChunkCount = Array.isArray(loadedChunkViewModels)
          ? loadedChunkViewModels.length
          : 0;
        this.furnitureHydrationError = null;
      } catch (error) {
        this.furnitureHydrationError =
          error instanceof Error ? error.message : "Unknown furniture hydration error.";
      }
    }

    create() {
      this.runtime = createPhaserRuntimeAdapter({
        streamWidthChunks: STREAM_WIDTH_CHUNKS,
        streamHeightChunks: STREAM_HEIGHT_CHUNKS,
      });
      this.runtime.ensureStreamWindow();
      this.furnitureStateStore = createFurnitureStateStore();
      this.clockDisplay = this.furnitureStateStore.formatClockDisplay();
      this.lastFurnitureHydrationBoundsKey = loadedBoundsKey(this.runtime.getLoadedBounds());
      this.hydrateFurnitureStateFromLoadedChunks(this.runtime.getLoadedChunkViewModels());
      this.debugController = createRuntimeDebugController({
        onVisibilityChanged: setRuntimeOverlayVisible,
        initialEnabled: this.debugOverlayEnabled,
      });
      if (HUMAN_SYSTEMS_ENABLED) {
        const getZombiePerceptionTargets = () => {
          if (
            !this.zombieManager ||
            typeof this.zombieManager.getPerceptionTargets !== "function"
          ) {
            return [];
          }
          return this.zombieManager.getPerceptionTargets();
        };
        const naturalGuestPolicy =
          RUNTIME_MODE === RUNTIME_MODE_FIRST_CONTACT
            ? {
                enabled: true,
                targetGuestCount: FIRST_CONTACT_GUEST_TARGET_COUNT,
                minSpawnRadiusTiles: FIRST_CONTACT_GUEST_MIN_SPAWN_RADIUS_TILES,
                maxSpawnRadiusTiles: FIRST_CONTACT_GUEST_MAX_SPAWN_RADIUS_TILES,
                getPerimeterAnchors: () => {
                  if (!this.humanManager) {
                    return [];
                  }
                  const entries = this.humanManager.getHumanEntries({
                    livingOnly: true,
                  });
                  const anchors = [];
                  for (const entry of entries) {
                    if (entry.role !== "survivor") {
                      continue;
                    }
                    if (
                      typeof entry.controller?.getCurrentWorldPosition !== "function"
                    ) {
                      continue;
                    }
                    const world = entry.controller.getCurrentWorldPosition();
                    if (!Number.isFinite(world?.x) || !Number.isFinite(world?.y)) {
                      continue;
                    }
                    anchors.push({
                      x: world.x,
                      y: world.y,
                    });
                  }
                  return anchors;
                },
              }
            : null;
        const guestPerceptionPolicy =
          RUNTIME_MODE === RUNTIME_MODE_FIRST_CONTACT
            ? {
                enabled: true,
                lineCheckStepTiles: 0.2,
                getTargets: getZombiePerceptionTargets,
              }
            : null;
        const guestBehaviorPolicy =
          RUNTIME_MODE === RUNTIME_MODE_FIRST_CONTACT
            ? {
                fleeReplanSeconds: 0.35,
                wanderReplanSeconds: 1.1,
                shelterReplanSeconds: 1.1,
                shelterSearchRadiusTiles: 24,
                shelterMaxRoomCandidates: 48,
                shelterNavPaddingTiles: 14,
                shelterMaxPathNodes: 12000,
                objectivePlanning: {
                  enforceBrainObjectiveAuthority: true,
                  allowRoomDangerOverride: false,
                },
              }
            : null;
        const guestDangerPolicy =
          RUNTIME_MODE === RUNTIME_MODE_FIRST_CONTACT
            ? {
                dangerMemoryExpirySeconds: 20.0,
                dangerRememberedSignalMultiplier: 0.6,
                dangerLiveDistanceMinTiles: 1.5,
                dangerLiveDistanceMaxTiles: 8.0,
                dangerReplanTargetShiftTiles: 1.0,
              }
            : null;
        const guestMentalModelConfig =
          RUNTIME_MODE === RUNTIME_MODE_FIRST_CONTACT
            ? createGuestMentalModelConfig()
            : null;
        this.humanManager = createHumanManager({
          scene: this,
          runtime: this.runtime,
          moveSpeedTilesPerSecond: HUMAN_MOVE_SPEED_TILES_PER_SECOND,
          spawnSearchRadiusTiles: HUMAN_SPAWN_SEARCH_RADIUS_TILES,
          naturalGuestPolicy,
          guestPerceptionPolicy,
          guestBehaviorPolicy,
          guestDangerPolicy,
          guestMentalModelConfig,
        });
        this.humanController = this.humanManager.getPrimaryHumanController();
        this.humanSelectionController = createHumanSelectionController({
          scene: this,
          humanController: this.humanController,
          getHumanControllers: () =>
            this.humanManager
              ? this.humanManager.getHumanControllers({ livingOnly: true })
              : [],
        });
        this.humanCommandController = createHumanCommandController({
          scene: this,
          runtime: this.runtime,
          humanController: this.humanController,
          getSelectedHumanControllers: () =>
            this.humanSelectionController
              ? this.humanSelectionController.getSelectedControllers()
              : [],
          pathfinder: createSubTilePathfinder(),
          maxPathNodes: HUMAN_COMMAND_MAX_PATH_NODES,
          navPaddingExpansionFactors: HUMAN_COMMAND_NAV_PADDING_EXPANSION_FACTORS,
          maxDynamicExpansionAttempts: HUMAN_COMMAND_MAX_DYNAMIC_EXPANSION_ATTEMPTS,
          maxAutoPaddingTiles: HUMAN_COMMAND_MAX_AUTO_PADDING_TILES,
        });
        this.humanDebugOverlay = createHumanDebugOverlay({
          scene: this,
          runtime: this.runtime,
          humanManager: this.humanManager,
          humanController: this.humanController,
          commandController: this.humanCommandController,
          renderBackdrop: !ZOMBIE_SYSTEMS_ENABLED,
          renderCollisionObstacles: !ZOMBIE_SYSTEMS_ENABLED,
          getTopLeftUiInsetPx: resolveRuntimeOverlayBottomInsetPx,
        });
        this.humanCommandDebugBridge = {
          setEnabled: (enabled) => {
            if (this.humanCommandController) {
              this.humanCommandController.setDebugEnabled(enabled);
            }
          },
        };
        this.humanManagerDebugBridge = {
          setEnabled: (enabled) => {
            if (this.humanManager && typeof this.humanManager.setDebugEnabled === "function") {
              this.humanManager.setDebugEnabled(enabled);
            }
          },
        };
        this.debugController.addRenderer(this.humanDebugOverlay);
        this.debugController.addRenderer(this.humanCommandDebugBridge);
        this.debugController.addRenderer(this.humanManagerDebugBridge);
      }

      if (ZOMBIE_SYSTEMS_ENABLED) {
        const getFirstContactHumanTargets = () => {
          if (!this.humanManager) {
            return [];
          }
          const entries = this.humanManager.getHumanEntries({ livingOnly: true });
          const targets = [];
          for (const entry of entries) {
            const humanController = entry.controller;
            if (typeof humanController?.getCurrentWorldPosition !== "function") {
              continue;
            }
            const world = humanController.getCurrentWorldPosition();
            if (!Number.isFinite(world?.x) || !Number.isFinite(world?.y)) {
              continue;
            }
            const bounds =
              typeof humanController.getBoundsWorld === "function"
                ? humanController.getBoundsWorld()
                : null;
            const touchRadiusTiles =
              Number.isFinite(bounds?.w) && Number.isFinite(bounds?.h)
                ? Math.max(0.01, Math.min(bounds.w, bounds.h) * 0.5)
                : 0.29;
            targets.push({
              id: entry.id,
              world: {
                x: world.x,
                y: world.y,
              },
              touchRadiusTiles,
              isDead: () =>
                typeof humanController.isDead === "function"
                  ? humanController.isDead()
                  : false,
              applyDamage: (amount, attackContext = null) => {
                const damageResult =
                  typeof humanController.applyDamage === "function"
                    ? humanController.applyDamage(amount)
                    : { changed: false, becameDead: false };
                if (
                  damageResult?.changed === true &&
                  entry.role === "guest" &&
                  this.humanManager &&
                  typeof this.humanManager.reportGuestDamageDangerEvent === "function"
                ) {
                  const impactWorld =
                    typeof humanController.getCurrentWorldPosition === "function"
                      ? humanController.getCurrentWorldPosition()
                      : world;
                  this.humanManager.reportGuestDamageDangerEvent({
                    guestId: entry.id,
                    damageAmount: amount,
                    sourceId: attackContext?.sourceId ?? attackContext?.attackerId ?? null,
                    sourceWorld: attackContext?.sourceWorld || null,
                    impactWorld,
                    reason: attackContext?.reason || "zombie_attack",
                  });
                }
                return damageResult;
              },
            });
          }
          return targets;
        };
        const firstContactPolicy =
          RUNTIME_MODE === RUNTIME_MODE_FIRST_CONTACT
            ? {
                enabled: true,
                targetZombieCount: FIRST_CONTACT_ZOMBIE_TARGET_COUNT,
                minSpawnRadiusTiles: FIRST_CONTACT_ZOMBIE_MIN_SPAWN_RADIUS_TILES,
                maxSpawnRadiusTiles: FIRST_CONTACT_ZOMBIE_MAX_SPAWN_RADIUS_TILES,
                getPerimeterAnchors: () => {
                  const targets = getFirstContactHumanTargets();
                  if (targets.length === 0) {
                    return [];
                  }
                  return [
                    {
                      x: targets[0].world.x,
                      y: targets[0].world.y,
                    },
                  ];
                },
              }
            : null;
        const pursuitPolicy =
          RUNTIME_MODE === RUNTIME_MODE_FIRST_CONTACT
            ? {
                enabled: true,
                getTargets: getFirstContactHumanTargets,
              }
            : null;
        const attackPolicy =
          RUNTIME_MODE === RUNTIME_MODE_FIRST_CONTACT
            ? {
                enabled: true,
                damagePerHit: 20,
                cooldownSeconds: 1.0,
                getTargets: getFirstContactHumanTargets,
              }
            : null;
        this.zombieManager = createZombieManager({
          scene: this,
          runtime: this.runtime,
          spawnSearchRadiusTiles: ZOMBIE_SPAWN_SEARCH_RADIUS_TILES,
          moveSpeedTilesPerSecond:
            RUNTIME_MODE === RUNTIME_MODE_FIRST_CONTACT
              ? FIRST_CONTACT_ZOMBIE_MOVE_SPEED_TILES_PER_SECOND
              : undefined,
          firstContactPolicy,
          pursuitPolicy,
          attackPolicy,
        });
        this.zombieDebugOverlay = createZombieDebugOverlay({
          scene: this,
          runtime: this.runtime,
          zombieManager: this.zombieManager,
        });
        this.zombieManagerDebugBridge = {
          setEnabled: (enabled) => {
            if (
              this.zombieManager &&
              typeof this.zombieManager.setDebugEnabled === "function"
            ) {
              this.zombieManager.setDebugEnabled(enabled);
            }
          },
        };
        this.debugController.addRenderer(this.zombieDebugOverlay);
        this.debugController.addRenderer(this.zombieManagerDebugBridge);
      }

      this.agentHpBarOverlay = createAgentHpBarOverlay({
        scene: this,
        humanManager: this.humanManager,
        humanController: this.humanController,
        zombieManager: this.zombieManager,
      });
      this.gameOverOverlay = createGameOverOverlay({
        parentElement: mountElement,
      });
      this.gameOverOverlay.setVisible(false);
      if (RUNTIME_MODE === RUNTIME_MODE_FIRST_CONTACT && runtimeOverlayElement) {
        this.firstContactDiagnosticsPanel = createFirstContactDiagnosticsPanel({
          parentElement: runtimeOverlayElement,
          humanManager: this.humanManager,
          humanController: this.humanController,
          humanCommandController: this.humanCommandController,
          zombieManager: this.zombieManager,
          getFurnitureDebugState: () => this.buildFurnitureDebugSnapshot(),
          getGameOverActive: () => this.gameOverActive,
        });
        this.debugController.addRenderer(this.firstContactDiagnosticsPanel);
      }
      this.applyDebugUiSettings();
      this.refreshDebugControlButtons();

      if (diagnosticsTextToggleElement) {
        this.handleDiagnosticsTextToggleClick = () => {
          this.diagnosticsTextVisible = !this.diagnosticsTextVisible;
          this.applyDebugUiSettings();
          this.refreshDebugControlButtons();
          this.dirty = true;
        };
        diagnosticsTextToggleElement.addEventListener(
          "click",
          this.handleDiagnosticsTextToggleClick
        );
      }

      if (visionDebugToggleElement) {
        this.handleVisionDebugToggleClick = () => {
          this.debugVisionEnabled = !this.debugVisionEnabled;
          this.applyDebugUiSettings();
          this.refreshDebugControlButtons();
          this.dirty = true;
        };
        visionDebugToggleElement.addEventListener("click", this.handleVisionDebugToggleClick);
      }

      if (trackInspectedGuestToggleElement) {
        this.handleTrackInspectedGuestToggleClick = () => {
          this.trackInspectedGuestEnabled = !this.trackInspectedGuestEnabled;
          this.refreshDebugControlButtons();
          this.dirty = true;
        };
        trackInspectedGuestToggleElement.addEventListener(
          "click",
          this.handleTrackInspectedGuestToggleClick
        );
      }

      if (HUMAN_SYSTEMS_ENABLED) {
        this.handlePointerDown = (pointer) => {
          const debugEnabled =
            this.debugController &&
            typeof this.debugController.isEnabled === "function" &&
            this.debugController.isEnabled();
          if (
            pointer.button === 0 &&
            pointer.event?.altKey &&
            debugEnabled &&
            this.humanDebugOverlay &&
            typeof this.humanDebugOverlay.handleInspectPointer === "function"
          ) {
            const handled = this.humanDebugOverlay.handleInspectPointer(
              pointer.x,
              pointer.y
            );
            if (handled) {
              pointer.event.preventDefault();
              this.dirty = true;
              return;
            }
          }
          if (pointer.button === 0 && pointer.event?.ctrlKey) {
            pointer.event.preventDefault();
            const cameraTile = this.runtime.getCameraTilePosition();
            const world = screenToWorldTileSpace(
              pointer.x,
              pointer.y,
              cameraTile,
              this.tilePixels,
              this.scale.width,
              this.scale.height
            );
            const commandResult = this.humanCommandController?.issueMoveCommand(
              world.x,
              world.y
            );
            if (
              commandResult &&
              (commandResult.accepted || commandResult.reason !== "not_selected")
            ) {
              this.dirty = true;
            }
            return;
          }
          if (this.humanSelectionController) {
            this.humanSelectionController.onPointerDown(pointer);
          }
        };
        this.handlePointerMove = (pointer) => {
          if (this.humanSelectionController) {
            this.humanSelectionController.onPointerMove(pointer);
          }
        };
        this.handlePointerUp = (pointer) => {
          if (this.humanSelectionController) {
            this.humanSelectionController.onPointerUp(pointer);
          }
        };
        this.input.on("pointerdown", this.handlePointerDown);
        this.input.on("pointermove", this.handlePointerMove);
        this.input.on("pointerup", this.handlePointerUp);
      } else if (ZOMBIE_MANUAL_SPAWN_ENABLED) {
        this.handlePointerDown = (pointer) => {
          if (pointer.button !== 0) {
            return;
          }
          const cameraTile = this.runtime.getCameraTilePosition();
          const world = screenToWorldTileSpace(
            pointer.x,
            pointer.y,
            cameraTile,
            this.tilePixels,
            this.scale.width,
            this.scale.height
          );
          const spawnResult = this.zombieManager?.spawnAtWorld(world.x, world.y);
          if (spawnResult?.accepted) {
            this.dirty = true;
          }
        };
        this.input.on("pointerdown", this.handlePointerDown);
      }

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
      this.handleDebugKeyDown = (event) => {
        const key = event?.key || "";
        if (!DEBUG_TOGGLE_KEYS.has(key) && event?.code !== "Backquote") {
          return;
        }
        event.preventDefault();
        if (this.debugController) {
          this.debugOverlayEnabled = this.debugController.toggle();
        } else {
          this.debugOverlayEnabled = !this.debugOverlayEnabled;
          setRuntimeOverlayVisible(this.debugOverlayEnabled);
        }
        this.dirty = true;
      };
      this.input.keyboard.on("keydown", this.handleDebugKeyDown);
      this.handlePauseKeyDown = (event) => {
        if (!PAUSE_TOGGLE_CODES.has(event?.code) || event?.repeat) {
          return;
        }
        event.preventDefault();
        this.simulationPaused = !this.simulationPaused;
        this.dirty = true;
      };
      this.input.keyboard.on("keydown", this.handlePauseKeyDown);

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
          this.lastZoomInputAtMs = this.time?.now ?? performance.now();
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
        if (this.handlePointerDown) {
          this.input.off("pointerdown", this.handlePointerDown);
          this.handlePointerDown = null;
        }
        if (this.handlePointerMove) {
          this.input.off("pointermove", this.handlePointerMove);
          this.handlePointerMove = null;
        }
        if (this.handlePointerUp) {
          this.input.off("pointerup", this.handlePointerUp);
          this.handlePointerUp = null;
        }
        if (this.handleDebugKeyDown) {
          this.input.keyboard.off("keydown", this.handleDebugKeyDown);
          this.handleDebugKeyDown = null;
        }
        if (this.handlePauseKeyDown) {
          this.input.keyboard.off("keydown", this.handlePauseKeyDown);
          this.handlePauseKeyDown = null;
        }
        if (this.handleDiagnosticsTextToggleClick && diagnosticsTextToggleElement) {
          diagnosticsTextToggleElement.removeEventListener(
            "click",
            this.handleDiagnosticsTextToggleClick
          );
          this.handleDiagnosticsTextToggleClick = null;
        }
        if (this.handleVisionDebugToggleClick && visionDebugToggleElement) {
          visionDebugToggleElement.removeEventListener(
            "click",
            this.handleVisionDebugToggleClick
          );
          this.handleVisionDebugToggleClick = null;
        }
        if (this.handleTrackInspectedGuestToggleClick && trackInspectedGuestToggleElement) {
          trackInspectedGuestToggleElement.removeEventListener(
            "click",
            this.handleTrackInspectedGuestToggleClick
          );
          this.handleTrackInspectedGuestToggleClick = null;
        }
        if (this.humanSelectionController) {
          this.humanSelectionController.destroy();
          this.humanSelectionController = null;
        }
        if (this.humanCommandController) {
          this.humanCommandController.destroy();
          this.humanCommandController = null;
        }
        if (this.humanManager) {
          this.humanManager.destroy();
          this.humanManager = null;
        }
        if (this.humanController) {
          this.humanController = null;
        }
        if (this.zombieManager) {
          this.zombieManager.destroy();
          this.zombieManager = null;
        }
        if (this.agentHpBarOverlay) {
          this.agentHpBarOverlay.destroy();
          this.agentHpBarOverlay = null;
        }
        if (this.gameOverOverlay) {
          this.gameOverOverlay.destroy();
          this.gameOverOverlay = null;
        }
        if (this.debugController) {
          this.debugController.destroy();
          this.debugController = null;
        }
        this.humanDebugOverlay = null;
        this.zombieDebugOverlay = null;
        this.firstContactDiagnosticsPanel = null;
        this.furnitureStateStore = null;
        this.lastFurnitureHydrationBoundsKey = "none";
        this.furnitureHydratedRecordCount = 0;
        this.furnitureHydratedTileCount = 0;
        this.furnitureHydratedChunkCount = 0;
        this.furnitureHydrationError = null;
        this.clockDisplay = { dayLabel: "Day 1", timeLabel: "00:00" };
        this.humanCommandDebugBridge = null;
        this.humanManagerDebugBridge = null;
        this.zombieManagerDebugBridge = null;
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

      if (this.humanCommandController && this.humanCommandController.update(dt)) {
        this.dirty = true;
      }
      if (!this.simulationPaused) {
        if (this.furnitureStateStore) {
          const previousClockDisplay = this.clockDisplay || { dayLabel: "Day 1", timeLabel: "00:00" };
          this.furnitureStateStore.advanceClock(dt);
          const nextClockDisplay = this.furnitureStateStore.formatClockDisplay();
          this.clockDisplay = nextClockDisplay;
          if (
            nextClockDisplay.dayLabel !== previousClockDisplay.dayLabel ||
            nextClockDisplay.timeLabel !== previousClockDisplay.timeLabel
          ) {
            this.dirty = true;
          }
        }
        if (this.humanManager && this.humanManager.update(dt)) {
          this.dirty = true;
        }
        if (this.zombieManager && this.zombieManager.update(dt)) {
          this.dirty = true;
        }

        const livingHumanCount = this.humanManager
          ? this.humanManager.getLivingHumanCount()
          : this.humanController &&
              typeof this.humanController.isDead === "function" &&
              !this.humanController.isDead()
            ? 1
            : 0;
        const shouldShowGameOver = livingHumanCount <= 0;
        if (shouldShowGameOver !== this.gameOverActive) {
          this.gameOverActive = shouldShowGameOver;
          if (this.gameOverOverlay) {
            this.gameOverOverlay.setVisible(this.gameOverActive);
          }
        }
      }

      if (
        this.trackInspectedGuestEnabled &&
        this.humanDebugOverlay &&
        typeof this.humanDebugOverlay.getInspectedGuestWorld === "function"
      ) {
        const target = this.humanDebugOverlay.getInspectedGuestWorld();
        if (Number.isFinite(target?.x) && Number.isFinite(target?.y)) {
          const cameraTile = this.runtime.getCameraTilePosition();
          const dxToGuest = target.x - cameraTile.x;
          const dyToGuest = target.y - cameraTile.y;
          if (Math.abs(dxToGuest) > 0.0001 || Math.abs(dyToGuest) > 0.0001) {
            this.runtime.moveCameraBy(dxToGuest, dyToGuest);
            this.panVelocity.x = 0;
            this.panVelocity.y = 0;
            this.dirty = true;
          }
        }
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

      const nowMs = this.time?.now ?? performance.now();
      const zoomRecentlyChanged =
        nowMs - this.lastZoomInputAtMs < CHUNK_TEXTURE_REBUILD_DEBOUNCE_MS;
      const zoomInFlight =
        Math.abs(this.targetTilePixels - this.tilePixels) > CHUNK_TEXTURE_ZOOM_SETTLE_EPSILON;
      const nextChunkTextureTierLocked = zoomRecentlyChanged || zoomInFlight;
      if (nextChunkTextureTierLocked !== this.chunkTextureTierLocked) {
        this.chunkTextureTierLocked = nextChunkTextureTierLocked;
        if (!nextChunkTextureTierLocked) {
          this.dirty = true;
        }
      }

      if (this.dirty) {
        this.dirty = false;
        this.renderRuntimeFrame();
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
      const currentLoadedBoundsKey = loadedBoundsKey(snapshot.loadedBounds);
      if (
        this.furnitureStateStore &&
        currentLoadedBoundsKey !== this.lastFurnitureHydrationBoundsKey
      ) {
        this.hydrateFurnitureStateFromLoadedChunks(this.runtime.getLoadedChunkViewModels());
        this.lastFurnitureHydrationBoundsKey = currentLoadedBoundsKey;
      }
      const debugSnapshot =
        this.debugController &&
        typeof this.debugController.isEnabled === "function" &&
        this.debugController.isEnabled()
          ? this.buildFrameDebugSnapshot()
          : null;
      const visibleKeys = new Set();
      if (!this.chunkTextureTierLocked) {
        this.chunkTextureTilePixels = resolveChunkTextureTilePixels(
          this.tilePixels,
          this.chunkTextureTilePixels
        );
      }
      const expectedPixelSize = Math.max(1, snapshot.chunkSize * this.chunkTextureTilePixels);
      let rebuildBudget = MAX_CHUNK_TEXTURE_REBUILDS_PER_FRAME;
      let pendingChunkTextures = 0;

      this.chunkFallbackGraphics.clear();
      this.chunkBorderGraphics.clear();
      this.chunkFallbackGraphics.fillStyle(0x2d333b, 0.55);
      this.chunkBorderGraphics.lineStyle(1, 0x888888, 0.35);

      for (const item of snapshot.visibleChunks) {
        const key = chunkKey(item.chunkX, item.chunkY);
        const left = Math.floor(
          (item.chunk.worldX - snapshot.cameraTile.x) * this.tilePixels + width / 2
        );
        const top = Math.floor(
          (item.chunk.worldY - snapshot.cameraTile.y) * this.tilePixels + height / 2
        );
        const right = Math.floor(
          (item.chunk.worldX + snapshot.chunkSize - snapshot.cameraTile.x) * this.tilePixels +
            width / 2
        );
        const bottom = Math.floor(
          (item.chunk.worldY + snapshot.chunkSize - snapshot.cameraTile.y) * this.tilePixels +
            height / 2
        );
        const displayWidth = Math.max(1, right - left);
        const displayHeight = Math.max(1, bottom - top);
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
          image.setPosition(left, top);
          image.setDisplaySize(displayWidth, displayHeight);
          image.setVisible(true);

          if (
            oldTextureKey &&
            oldTextureKey !== cache.textureKey &&
            this.textures.exists(oldTextureKey)
          ) {
            this.textures.remove(oldTextureKey);
          }
        } else {
          this.chunkFallbackGraphics.fillRect(left, top, displayWidth, displayHeight);
        }

        this.chunkBorderGraphics.strokeRect(
          left + 0.5,
          top + 0.5,
          displayWidth - 1,
          displayHeight - 1
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

      if (this.humanManager) {
        this.humanManager.syncToView({
          cameraTile: snapshot.cameraTile,
          tilePixels: this.tilePixels,
          viewWidthPx: width,
          viewHeightPx: height,
        });
      }
      if (this.humanSelectionController) {
        this.humanSelectionController.updateOverlay();
      }
      if (this.humanCommandController) {
        this.humanCommandController.syncToView({
          cameraTile: snapshot.cameraTile,
          tilePixels: this.tilePixels,
          viewWidthPx: width,
          viewHeightPx: height,
        });
      }
      if (this.debugController) {
        this.debugController.renderFrame({
          cameraTile: snapshot.cameraTile,
          tilePixels: this.tilePixels,
          viewWidthPx: width,
          viewHeightPx: height,
          debugSnapshot,
        });
      }
      if (this.zombieManager) {
        this.zombieManager.syncToView({
          cameraTile: snapshot.cameraTile,
          tilePixels: this.tilePixels,
          viewWidthPx: width,
          viewHeightPx: height,
        });
      }
      if (this.agentHpBarOverlay) {
        this.agentHpBarOverlay.renderFrame({
          cameraTile: snapshot.cameraTile,
          tilePixels: this.tilePixels,
          viewWidthPx: width,
          viewHeightPx: height,
          debugSnapshot,
        });
      }

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
        clockDisplay: this.clockDisplay,
      });
      if (metaElement) {
        const rendererType = this.game?.renderer?.type;
        const rendererLabel = resolveRendererLabel(Phaser, rendererType);
        const measuredFps = this.game?.loop?.actualFps;
        const fpsLabel = Number.isFinite(measuredFps)
          ? measuredFps.toFixed(1)
          : "n/a";
        metaElement.textContent +=
          ` | Renderer: ${rendererLabel} | Pending chunk textures: ${pendingChunkTextures} | Furniture: ${this.furnitureHydratedRecordCount} objs/${this.furnitureHydratedTileCount} tiles/${this.furnitureHydratedChunkCount} chunks | Phaser: ${Phaser.VERSION} | FPS: ${fpsLabel}`;
        if (this.furnitureHydrationError) {
          metaElement.textContent += ` | Furniture hydration error: ${this.furnitureHydrationError}`;
        }
      }
    }
  };
}

async function bootGameRuntime() {
  try {
    const Phaser = await loadPhaserModule();
    const RuntimeScene = createRuntimeScene(Phaser);

    new Phaser.Game({
      type: Phaser.AUTO,
      parent: "game-root",
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      pixelArt: true,
      backgroundColor: "#101015",
      scene: [RuntimeScene],
      physics: {
        default: "arcade",
        arcade: {
          gravity: { y: 0 },
          debug: false,
        },
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
      },
    });
  } catch (error) {
    if (metaElement) {
      metaElement.textContent = `Game runtime failed to load: ${error.message}`;
    }
    mountElement.textContent =
      "Unable to load game runtime. Check internet access or CDN blocking.";
  }
}

bootGameRuntime();

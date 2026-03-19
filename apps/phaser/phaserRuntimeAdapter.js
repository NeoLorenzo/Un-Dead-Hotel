import { CHUNK_SIZE } from "../../engine/procgen.js";
import { createCameraController } from "../../engine/world/cameraController.js";
import { createWorldStore } from "../../engine/world/worldStore.js";
import { isTileWalkableForHumans } from "../../engine/generation/chunkGenerator.js";

const CHUNK_PREVIEW_FILL_COLORS = [
  0x25282d,
  0x2c3138,
  0x313842,
  0x374049,
  0x3b4652,
  0x425061,
];
const CHUNK_PREVIEW_BORDER_COLOR = 0xb8b8b8;
const DEFAULT_SUB_TILE_CELL_SIZE_TILES = 0.25;

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeWorldBounds(minWorldX, minWorldY, maxWorldX, maxWorldY) {
  const minX = Math.min(Number(minWorldX) || 0, Number(maxWorldX) || 0);
  const maxX = Math.max(Number(minWorldX) || 0, Number(maxWorldX) || 0);
  const minY = Math.min(Number(minWorldY) || 0, Number(maxWorldY) || 0);
  const maxY = Math.max(Number(minWorldY) || 0, Number(maxWorldY) || 0);
  return { minX, minY, maxX, maxY };
}

function worldBoundsIntersect(a, b) {
  return !(
    a.maxX < b.minX ||
    a.minX > b.maxX ||
    a.maxY < b.minY ||
    a.minY > b.maxY
  );
}

function pointInsideRect(worldX, worldY, rect) {
  return (
    worldX >= rect.x &&
    worldX <= rect.x + rect.w &&
    worldY >= rect.y &&
    worldY <= rect.y + rect.h
  );
}

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

  function worldToTile(worldX, worldY) {
    return {
      x: Math.floor(worldX),
      y: Math.floor(worldY),
    };
  }

  function tileToWorldCenter(tileX, tileY) {
    return {
      x: tileX + 0.5,
      y: tileY + 0.5,
    };
  }

  function getTileAtWorld(tileX, tileY) {
    const worldTile = worldToTile(tileX, tileY);
    const chunkX = Math.floor(worldTile.x / CHUNK_SIZE);
    const chunkY = Math.floor(worldTile.y / CHUNK_SIZE);
    const localX = worldTile.x - chunkX * CHUNK_SIZE;
    const localY = worldTile.y - chunkY * CHUNK_SIZE;
    const chunk = worldStore.ensureChunk(chunkX, chunkY);
    const tileMap = chunk?.tileMap;
    if (!(tileMap instanceof Uint8Array)) {
      return 0;
    }
    return tileMap[localY * CHUNK_SIZE + localX] ?? 0;
  }

  function isWalkableTile(tileX, tileY) {
    const tile = getTileAtWorld(tileX, tileY);
    return isTileWalkableForHumans(tile);
  }

  function forEachVisibleTile(viewWidthPx, viewHeightPx, tilePixels, visitFn) {
    if (typeof visitFn !== "function" || !Number.isFinite(tilePixels) || tilePixels <= 0) {
      return;
    }

    const cameraTiles = camera.getTilePosition();
    const halfTilesX = viewWidthPx / tilePixels / 2;
    const halfTilesY = viewHeightPx / tilePixels / 2;
    const minTileX = Math.floor(cameraTiles.x - halfTilesX) - 1;
    const maxTileX = Math.ceil(cameraTiles.x + halfTilesX) + 1;
    const minTileY = Math.floor(cameraTiles.y - halfTilesY) - 1;
    const maxTileY = Math.ceil(cameraTiles.y + halfTilesY) + 1;

    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        const tile = getTileAtWorld(tileX, tileY);
        visitFn({
          tileX,
          tileY,
          tile,
          walkable: isTileWalkableForHumans(tile),
        });
      }
    }
  }

  function getChunkCollisionGeometry(chunkX, chunkY) {
    const rawChunk = worldStore.ensureChunk(chunkX, chunkY);
    const worldX = chunkX * CHUNK_SIZE;
    const worldY = chunkY * CHUNK_SIZE;
    const sourceGeometry = rawChunk?.collisionGeometry || null;
    const sourceObstacles = Array.isArray(sourceGeometry?.obstacles)
      ? sourceGeometry.obstacles
      : [];

    return {
      version: sourceGeometry?.version || 1,
      space: "world",
      units: sourceGeometry?.units || "tiles",
      chunkX,
      chunkY,
      roomThinWallRatio: Number(sourceGeometry?.roomThinWallRatio) || 0,
      sourceCounts: {
        roomThinWalls: Number(sourceGeometry?.sourceCounts?.roomThinWalls) || 0,
        tileOccupancy: Number(sourceGeometry?.sourceCounts?.tileOccupancy) || 0,
      },
      worldBounds: {
        x: worldX,
        y: worldY,
        w: CHUNK_SIZE,
        h: CHUNK_SIZE,
      },
      blockedTileCount: Number(sourceGeometry?.blockedTileCount) || 0,
      obstacles: sourceObstacles.map((obstacle) => ({
        type: obstacle?.type || "rect",
        x: worldX + (Number(obstacle?.x) || 0),
        y: worldY + (Number(obstacle?.y) || 0),
        w: Number(obstacle?.w) || 0,
        h: Number(obstacle?.h) || 0,
        source: obstacle?.source || "tile-occupancy",
        side: obstacle?.side || null,
        roomIndex: Number.isFinite(obstacle?.roomIndex) ? obstacle.roomIndex : null,
        chunkLocal: {
          x: Number(obstacle?.x) || 0,
          y: Number(obstacle?.y) || 0,
        },
      })),
    };
  }

  function getChunkNavigationData(chunkX, chunkY) {
    const rawChunk = worldStore.ensureChunk(chunkX, chunkY);
    const sourceNav = rawChunk?.navigationData || null;
    const walkableMask =
      sourceNav?.walkableMask instanceof Uint8Array
        ? sourceNav.walkableMask.slice()
        : new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

    return {
      version: sourceNav?.version || 1,
      backend: sourceNav?.backend || "tile-grid",
      gridWidth: Number(sourceNav?.gridWidth) || CHUNK_SIZE,
      gridHeight: Number(sourceNav?.gridHeight) || CHUNK_SIZE,
      cellSizeTiles: Number(sourceNav?.cellSizeTiles) || 1,
      walkableMask,
      walkableTileCount: Number(sourceNav?.walkableTileCount) || 0,
      blockedTileCount: Number(sourceNav?.blockedTileCount) || 0,
    };
  }

  function forEachCollisionObstacleInWorldBounds(minWorldX, minWorldY, maxWorldX, maxWorldY, visitFn) {
    if (typeof visitFn !== "function") {
      return;
    }

    const bounds = normalizeWorldBounds(minWorldX, minWorldY, maxWorldX, maxWorldY);
    const minChunkX = Math.floor(bounds.minX / CHUNK_SIZE);
    const maxChunkX = Math.floor(bounds.maxX / CHUNK_SIZE);
    const minChunkY = Math.floor(bounds.minY / CHUNK_SIZE);
    const maxChunkY = Math.floor(bounds.maxY / CHUNK_SIZE);

    const queryBounds = {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
    };

    for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += 1) {
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
        const collision = getChunkCollisionGeometry(chunkX, chunkY);
        for (const obstacle of collision.obstacles) {
          const obstacleBounds = {
            minX: obstacle.x,
            minY: obstacle.y,
            maxX: obstacle.x + obstacle.w,
            maxY: obstacle.y + obstacle.h,
          };
          if (!worldBoundsIntersect(queryBounds, obstacleBounds)) {
            continue;
          }
          visitFn({
            chunkX,
            chunkY,
            ...obstacle,
          });
        }
      }
    }
  }

  function isWalkableWorldPoint(worldX, worldY, agentRadiusTiles = 0) {
    if (!isFiniteNumber(worldX) || !isFiniteNumber(worldY)) {
      return false;
    }

    const radius = Math.max(0, Number(agentRadiusTiles) || 0);
    let blocked = false;

    forEachCollisionObstacleInWorldBounds(
      worldX - radius,
      worldY - radius,
      worldX + radius,
      worldY + radius,
      (obstacle) => {
        if (blocked) {
          return;
        }
        const expanded = {
          x: obstacle.x - radius,
          y: obstacle.y - radius,
          w: obstacle.w + radius * 2,
          h: obstacle.h + radius * 2,
        };
        if (pointInsideRect(worldX, worldY, expanded)) {
          blocked = true;
        }
      }
    );

    return !blocked;
  }

  function buildSubTileNavigationGrid({
    minWorldX,
    minWorldY,
    maxWorldX,
    maxWorldY,
    cellSizeTiles = DEFAULT_SUB_TILE_CELL_SIZE_TILES,
    agentRadiusTiles = 0,
  } = {}) {
    const normalizedCellSize = Number.isFinite(cellSizeTiles)
      ? clampNumber(cellSizeTiles, 0.05, 1)
      : DEFAULT_SUB_TILE_CELL_SIZE_TILES;
    const normalizedRadius = Math.max(0, Number(agentRadiusTiles) || 0);
    const rawBounds = normalizeWorldBounds(minWorldX, minWorldY, maxWorldX, maxWorldY);
    const originWorldX = Math.floor(rawBounds.minX / normalizedCellSize) * normalizedCellSize;
    const originWorldY = Math.floor(rawBounds.minY / normalizedCellSize) * normalizedCellSize;
    const endWorldX = Math.ceil(rawBounds.maxX / normalizedCellSize) * normalizedCellSize;
    const endWorldY = Math.ceil(rawBounds.maxY / normalizedCellSize) * normalizedCellSize;
    const cols = Math.max(1, Math.ceil((endWorldX - originWorldX) / normalizedCellSize));
    const rows = Math.max(1, Math.ceil((endWorldY - originWorldY) / normalizedCellSize));
    const walkableMask = new Uint8Array(cols * rows);
    const obstacles = [];

    forEachCollisionObstacleInWorldBounds(
      originWorldX - normalizedRadius,
      originWorldY - normalizedRadius,
      endWorldX + normalizedRadius,
      endWorldY + normalizedRadius,
      (obstacle) => {
        obstacles.push({
          x: obstacle.x - normalizedRadius,
          y: obstacle.y - normalizedRadius,
          w: obstacle.w + normalizedRadius * 2,
          h: obstacle.h + normalizedRadius * 2,
        });
      }
    );

    function worldToCell(worldX, worldY) {
      return {
        x: Math.floor((worldX - originWorldX) / normalizedCellSize),
        y: Math.floor((worldY - originWorldY) / normalizedCellSize),
      };
    }

    function cellToWorldCenter(cellX, cellY) {
      return {
        x: originWorldX + (cellX + 0.5) * normalizedCellSize,
        y: originWorldY + (cellY + 0.5) * normalizedCellSize,
      };
    }

    function isWalkableCell(cellX, cellY) {
      if (cellX < 0 || cellY < 0 || cellX >= cols || cellY >= rows) {
        return false;
      }
      return walkableMask[cellY * cols + cellX] === 1;
    }

    for (let cellY = 0; cellY < rows; cellY += 1) {
      for (let cellX = 0; cellX < cols; cellX += 1) {
        const world = cellToWorldCenter(cellX, cellY);
        let blocked = false;
        for (const obstacle of obstacles) {
          if (pointInsideRect(world.x, world.y, obstacle)) {
            blocked = true;
            break;
          }
        }
        walkableMask[cellY * cols + cellX] = blocked ? 0 : 1;
      }
    }

    let walkableCount = 0;
    for (let i = 0; i < walkableMask.length; i += 1) {
      if (walkableMask[i] === 1) {
        walkableCount += 1;
      }
    }

    return {
      backend: "sub-tile-grid",
      cellSizeTiles: normalizedCellSize,
      cols,
      rows,
      originWorldX,
      originWorldY,
      endWorldX,
      endWorldY,
      walkableMask,
      walkableCount,
      blockedCount: walkableMask.length - walkableCount,
      worldToCell,
      cellToWorldCenter,
      isWalkableCell,
      isWalkableWorld: (worldX, worldY) => {
        const cell = worldToCell(worldX, worldY);
        return isWalkableCell(cell.x, cell.y);
      },
    };
  }

  function forEachVisibleCollisionObstacle(viewWidthPx, viewHeightPx, tilePixels, visitFn) {
    if (typeof visitFn !== "function") {
      return;
    }

    const bounds = getVisibleChunkBounds(viewWidthPx, viewHeightPx, tilePixels);
    for (let chunkY = bounds.minChunkY; chunkY <= bounds.maxChunkY; chunkY += 1) {
      for (let chunkX = bounds.minChunkX; chunkX <= bounds.maxChunkX; chunkX += 1) {
        const collision = getChunkCollisionGeometry(chunkX, chunkY);
        for (const obstacle of collision.obstacles) {
          visitFn({
            chunkX,
            chunkY,
            ...obstacle,
          });
        }
      }
    }
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
      collisionGeometry: rawChunk.collisionGeometry || null,
      navigationData: rawChunk.navigationData || null,
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
    worldToTile,
    tileToWorldCenter,
    getTileAtWorld,
    isWalkableTile,
    forEachVisibleTile,
    getChunkCollisionGeometry,
    getChunkNavigationData,
    forEachCollisionObstacleInWorldBounds,
    forEachVisibleCollisionObstacle,
    isWalkableWorldPoint,
    buildSubTileNavigationGrid,
    ensureStreamWindow,
    getVisibleChunkBounds,
    getVisibleChunks,
    getFrameSnapshot,
    getLoadedBounds,
    getLoadedChunkCount,
  };
}

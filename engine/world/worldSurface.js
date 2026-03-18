export function createWorldSurface({
  canvas,
  chunkSize,
  tilePixels = 2,
  roomThinWallRatio = 0.2,
  specialSpaceDefs = [],
  tileTypes,
}) {
  const ctx = canvas ? canvas.getContext("2d") : null;
  if (!canvas || !ctx) {
    throw new Error("World surface canvas is not available.");
  }
  ctx.imageSmoothingEnabled = false;

  const {
    corridor = 1,
    accessReserved,
    roomFloor,
    roomWall,
    roomDoor,
  } = tileTypes;
  const chunkRenderCache = new Map();
  let currentTilePixels = Math.max(1, Math.round(tilePixels));

  function clearChunkRenderCache() {
    chunkRenderCache.clear();
  }

  function resizeToWindow({
    margin = 24,
    reservedHeight = 150,
    minWidth = 640,
    minHeight = 400,
  } = {}) {
    canvas.width = Math.max(minWidth, window.innerWidth - margin);
    canvas.height = Math.max(minHeight, window.innerHeight - reservedHeight);
    return {
      width: canvas.width,
      height: canvas.height,
    };
  }

  function drawThinExteriorWallsForRooms(targetCtx, originX, originY, rooms, tileMap, mapWidth) {
    const thickness = Math.max(1, Math.round(currentTilePixels * roomThinWallRatio));
    targetCtx.fillStyle = "#8f8f8f";

    for (const room of rooms) {
      const xMin = room.x;
      const xMax = room.x + room.w - 1;
      const yMin = room.y;
      const yMax = room.y + room.h - 1;

      for (let x = xMin; x <= xMax; x += 1) {
        const topIdx = yMin * mapWidth + x;
        if (tileMap[topIdx] === roomWall && tileMap[topIdx] !== roomDoor) {
          targetCtx.fillRect(
            originX + x * currentTilePixels,
            originY + yMin * currentTilePixels,
            currentTilePixels,
            thickness
          );
        }

        const bottomIdx = yMax * mapWidth + x;
        if (tileMap[bottomIdx] === roomWall && tileMap[bottomIdx] !== roomDoor) {
          targetCtx.fillRect(
            originX + x * currentTilePixels,
            originY + (yMax + 1) * currentTilePixels - thickness,
            currentTilePixels,
            thickness
          );
        }
      }

      for (let y = yMin; y <= yMax; y += 1) {
        const leftIdx = y * mapWidth + xMin;
        if (tileMap[leftIdx] === roomWall && tileMap[leftIdx] !== roomDoor) {
          targetCtx.fillRect(
            originX + xMin * currentTilePixels,
            originY + y * currentTilePixels,
            thickness,
            currentTilePixels
          );
        }

        const rightIdx = y * mapWidth + xMax;
        if (tileMap[rightIdx] === roomWall && tileMap[rightIdx] !== roomDoor) {
          targetCtx.fillRect(
            originX + (xMax + 1) * currentTilePixels - thickness,
            originY + y * currentTilePixels,
            thickness,
            currentTilePixels
          );
        }
      }
    }
  }

  function tileColor(tile) {
    if (tile === corridor) {
      return "#1f1f1f";
    }
    if (tile === accessReserved) {
      return "#8f8f8f";
    }
    if (tile === roomFloor || tile === roomWall) {
      return "#efefef";
    }
    if (tile === roomDoor) {
      return "#ff9100";
    }
    if (tile >= 2 && tile < 2 + specialSpaceDefs.length) {
      const special = specialSpaceDefs[tile - 2];
      return special ? special.color : "#ffffff";
    }
    return "#8f8f8f";
  }

  function buildChunkSprite(chunk) {
    const sprite = document.createElement("canvas");
    sprite.width = Math.max(1, Math.round(chunkSize * currentTilePixels));
    sprite.height = Math.max(1, Math.round(chunkSize * currentTilePixels));

    const spriteCtx = sprite.getContext("2d");
    if (!spriteCtx) {
      throw new Error("Chunk sprite context unavailable.");
    }
    spriteCtx.imageSmoothingEnabled = false;

    const tileMap = chunk.tileMap;

    for (let y = 0; y < chunkSize; y += 1) {
      for (let x = 0; x < chunkSize; x += 1) {
        spriteCtx.fillStyle = tileColor(tileMap[y * chunkSize + x]);
        spriteCtx.fillRect(
          x * currentTilePixels,
          y * currentTilePixels,
          currentTilePixels,
          currentTilePixels
        );
      }
    }

    if (chunk.rooms && chunk.rooms.length > 0) {
      drawThinExteriorWallsForRooms(spriteCtx, 0, 0, chunk.rooms, tileMap, chunkSize);
    }

    return sprite;
  }

  function getChunkSprite(chunkX, chunkY, chunk) {
    const key = `${chunkX},${chunkY}`;
    const existing = chunkRenderCache.get(key);
    if (existing) {
      return existing;
    }
    const sprite = buildChunkSprite(chunk);
    chunkRenderCache.set(key, sprite);
    return sprite;
  }

  function getViewportChunkBounds(cameraTileX, cameraTileY) {
    const halfTilesX = canvas.width / currentTilePixels / 2;
    const halfTilesY = canvas.height / currentTilePixels / 2;

    const minTileX = Math.floor(cameraTileX - halfTilesX) - chunkSize;
    const maxTileX = Math.ceil(cameraTileX + halfTilesX) + chunkSize;
    const minTileY = Math.floor(cameraTileY - halfTilesY) - chunkSize;
    const maxTileY = Math.ceil(cameraTileY + halfTilesY) + chunkSize;

    return {
      minChunkX: Math.floor(minTileX / chunkSize),
      maxChunkX: Math.floor(maxTileX / chunkSize),
      minChunkY: Math.floor(minTileY / chunkSize),
      maxChunkY: Math.floor(maxTileY / chunkSize),
    };
  }

  function render({ cameraTileX, cameraTileY, ensureChunk }) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const bounds = getViewportChunkBounds(cameraTileX, cameraTileY);
    let drawnChunks = 0;

    for (let chunkY = bounds.minChunkY; chunkY <= bounds.maxChunkY; chunkY += 1) {
      for (let chunkX = bounds.minChunkX; chunkX <= bounds.maxChunkX; chunkX += 1) {
        const chunk = ensureChunk(chunkX, chunkY);
        const worldX = chunkX * chunkSize;
        const worldY = chunkY * chunkSize;

        const screenX = Math.round((worldX - cameraTileX) * currentTilePixels + canvas.width / 2);
        const screenY = Math.round((worldY - cameraTileY) * currentTilePixels + canvas.height / 2);

        const chunkSprite = getChunkSprite(chunkX, chunkY, chunk);
        ctx.drawImage(chunkSprite, screenX, screenY);
        drawnChunks += 1;
      }
    }

    return {
      bounds,
      drawnChunks,
      width: canvas.width,
      height: canvas.height,
    };
  }

  function getTilePixels() {
    return currentTilePixels;
  }

  function setTilePixels(nextTilePixels) {
    const rounded = Math.max(1, Math.round(nextTilePixels));
    if (rounded === currentTilePixels) {
      return false;
    }
    currentTilePixels = rounded;
    clearChunkRenderCache();
    return true;
  }

  return {
    resizeToWindow,
    render,
    getViewportChunkBounds,
    getTilePixels,
    setTilePixels,
  };
}

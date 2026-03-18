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

  const {
    corridor = 1,
    accessReserved,
    roomFloor,
    roomWall,
    roomDoor,
  } = tileTypes;

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

  function drawThinExteriorWallsForRooms(originX, originY, rooms, tileMap, mapWidth) {
    const thickness = Math.max(1, Math.round(tilePixels * roomThinWallRatio));
    ctx.fillStyle = "#8f8f8f";

    for (const room of rooms) {
      const xMin = room.x;
      const xMax = room.x + room.w - 1;
      const yMin = room.y;
      const yMax = room.y + room.h - 1;

      for (let x = xMin; x <= xMax; x += 1) {
        const topIdx = yMin * mapWidth + x;
        if (tileMap[topIdx] === roomWall && tileMap[topIdx] !== roomDoor) {
          ctx.fillRect(originX + x * tilePixels, originY + yMin * tilePixels, tilePixels, thickness);
        }

        const bottomIdx = yMax * mapWidth + x;
        if (tileMap[bottomIdx] === roomWall && tileMap[bottomIdx] !== roomDoor) {
          ctx.fillRect(
            originX + x * tilePixels,
            originY + (yMax + 1) * tilePixels - thickness,
            tilePixels,
            thickness
          );
        }
      }

      for (let y = yMin; y <= yMax; y += 1) {
        const leftIdx = y * mapWidth + xMin;
        if (tileMap[leftIdx] === roomWall && tileMap[leftIdx] !== roomDoor) {
          ctx.fillRect(originX + xMin * tilePixels, originY + y * tilePixels, thickness, tilePixels);
        }

        const rightIdx = y * mapWidth + xMax;
        if (tileMap[rightIdx] === roomWall && tileMap[rightIdx] !== roomDoor) {
          ctx.fillRect(originX + (xMax + 1) * tilePixels - thickness, originY + y * tilePixels, thickness, tilePixels);
        }
      }
    }
  }

  function drawChunk(originX, originY, chunk) {
    const tileMap = chunk.tileMap;

    for (let y = 0; y < chunkSize; y += 1) {
      for (let x = 0; x < chunkSize; x += 1) {
        const tile = tileMap[y * chunkSize + x];
        let color = "#8f8f8f";

        if (tile === corridor) {
          color = "#1f1f1f";
        } else if (tile === accessReserved) {
          color = "#8f8f8f";
        } else if (tile === roomFloor || tile === roomWall) {
          color = "#efefef";
        } else if (tile === roomDoor) {
          color = "#ff9100";
        } else if (tile >= 2 && tile < 2 + specialSpaceDefs.length) {
          const special = specialSpaceDefs[tile - 2];
          color = special ? special.color : "#ffffff";
        }

        ctx.fillStyle = color;
        ctx.fillRect(originX + x * tilePixels, originY + y * tilePixels, tilePixels, tilePixels);
      }
    }

    if (chunk.rooms && chunk.rooms.length > 0) {
      drawThinExteriorWallsForRooms(originX, originY, chunk.rooms, tileMap, chunkSize);
    }
  }

  function getViewportChunkBounds(cameraTileX, cameraTileY) {
    const halfTilesX = canvas.width / tilePixels / 2;
    const halfTilesY = canvas.height / tilePixels / 2;

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

        const screenX = Math.round((worldX - cameraTileX) * tilePixels + canvas.width / 2);
        const screenY = Math.round((worldY - cameraTileY) * tilePixels + canvas.height / 2);

        drawChunk(screenX, screenY, chunk);
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

  return {
    resizeToWindow,
    render,
    getViewportChunkBounds,
  };
}

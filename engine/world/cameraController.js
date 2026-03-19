export function createCameraController({
  chunkSize,
  initialTileX = chunkSize * 0.5,
  initialTileY = chunkSize * 0.5,
} = {}) {
  let cameraTileX = initialTileX;
  let cameraTileY = initialTileY;

  function moveBy(dxTiles, dyTiles) {
    cameraTileX += dxTiles;
    cameraTileY += dyTiles;
    return getTilePosition();
  }

  function setTilePosition(tileX, tileY) {
    cameraTileX = tileX;
    cameraTileY = tileY;
    return getTilePosition();
  }

  function getTilePosition() {
    return {
      x: cameraTileX,
      y: cameraTileY,
    };
  }

  function getChunkPosition() {
    return {
      x: Math.floor(cameraTileX / chunkSize),
      y: Math.floor(cameraTileY / chunkSize),
    };
  }

  return {
    moveBy,
    setTilePosition,
    getTilePosition,
    getChunkPosition,
  };
}

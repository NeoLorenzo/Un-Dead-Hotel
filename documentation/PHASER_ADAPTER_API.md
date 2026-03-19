# Phaser Runtime Adapter API

## Purpose

Defines the app-level adapter contract between Phaser scene code and engine world systems.

This keeps Phaser scene code focused on input/render orchestration and keeps deterministic world logic in `engine/`.

## Factory

- `createPhaserRuntimeAdapter({ streamWidthChunks?, streamHeightChunks? })`

## Returned API

- `chunkSize: number`
- `moveCameraBy(dxTiles, dyTiles) -> { x: number, y: number }`
- `getCameraTilePosition() -> { x: number, y: number }`
- `worldToTile(worldX, worldY) -> { x: number, y: number }`
- `tileToWorldCenter(tileX, tileY) -> { x: number, y: number }`
- `getTileAtWorld(tileX, tileY) -> number`
- `isWalkableTile(tileX, tileY) -> boolean`
- `forEachVisibleTile(viewWidthPx, viewHeightPx, tilePixels, visitFn) -> void`
- `getChunkCollisionGeometry(chunkX, chunkY) -> ChunkCollisionGeometry`
- `getChunkNavigationData(chunkX, chunkY) -> ChunkNavigationData`
- `forEachCollisionObstacleInWorldBounds(minWorldX, minWorldY, maxWorldX, maxWorldY, visitFn) -> void`
- `forEachVisibleCollisionObstacle(viewWidthPx, viewHeightPx, tilePixels, visitFn) -> void`
- `isWalkableWorldPoint(worldX, worldY, agentRadiusTiles?) -> boolean`
- `isWalkableWorldRect(worldX, worldY, halfWidthTiles?, halfHeightTiles?) -> boolean`
- `resolveWorldRectMovement(params) -> WorldRectMovementResult`
- `buildSubTileNavigationGrid(params) -> SubTileNavigationGrid`
- `ensureStreamWindow() -> { x: number, y: number }`
- `getVisibleChunkBounds(viewWidthPx, viewHeightPx, tilePixels) -> ViewportBounds`
- `getVisibleChunks(viewWidthPx, viewHeightPx, tilePixels) -> { bounds: ViewportBounds, chunks: ChunkViewModelEntry[] }`
- `getFrameSnapshot(viewWidthPx, viewHeightPx, tilePixels) -> PhaserFrameSnapshot`
- `getLoadedBounds() -> { minX: number, maxX: number, minY: number, maxY: number }`
- `getLoadedChunkCount() -> number`

## Types

- `ViewportBounds`
  - `{ minChunkX: number, maxChunkX: number, minChunkY: number, maxChunkY: number }`

- `ChunkViewModelEntry`
  - `{ chunkX: number, chunkY: number, chunk: ChunkViewModel }`

- `ChunkViewModel`
  - `chunkX: number`
  - `chunkY: number`
  - `worldX: number`
  - `worldY: number`
  - `assignmentTileId: number`
  - `assignmentRotationTurns: number`
  - `sockets: { N: boolean, E: boolean, S: boolean, W: boolean }`
  - `tileMap: Uint8Array`
  - `rooms: Array<{ x: number, y: number, w: number, h: number }>`
  - `collisionGeometry: ChunkCollisionGeometry | null`
  - `navigationData: ChunkNavigationData | null`
  - `render:`
    - `fillColor: number`
    - `borderColor: number`
    - `worldBounds: { x: number, y: number, w: number, h: number }`

- `PhaserFrameSnapshot`
  - `chunkSize: number`
  - `cameraTile: { x: number, y: number }`
  - `cameraChunk: { x: number, y: number }`
  - `visibleBounds: ViewportBounds`
  - `visibleChunks: ChunkViewModelEntry[]`
  - `visibleChunkCount: number`
  - `loadedBounds: { minX: number, maxX: number, minY: number, maxY: number }`
  - `loadedChunkCount: number`
  - `loadedWidth: number`
  - `loadedHeight: number`

- `forEachVisibleTile visit payload`
  - `{ tileX: number, tileY: number, tile: number, walkable: boolean }`

- `ChunkCollisionGeometry`
  - `version: number`
  - `chunkX: number`
  - `chunkY: number`
  - `worldBounds: { x: number, y: number, w: number, h: number }`
  - `obstacles: Array<{ x: number, y: number, w: number, h: number, source?: string, side?: string | null, roomIndex?: number | null }>`

- `ChunkNavigationData`
  - `version: number`
  - `backend: string`
  - `gridWidth: number`
  - `gridHeight: number`
  - `cellSizeTiles: number`
  - `walkableMask: Uint8Array`
  - `walkableTileCount: number`
  - `blockedTileCount: number`

- `WorldRectMovementResult`
  - `{ worldX, worldY, moved, collided, blockedX, blockedY, appliedDeltaX, appliedDeltaY, steps }`

- `SubTileNavigationGrid`
  - `{ backend, cellSizeTiles, cols, rows, originWorldX, originWorldY, endWorldX, endWorldY, walkableMask, walkableCount, blockedCount, worldToCell, cellToWorldCenter, isWalkableCell, isWalkableWorld }`

## Contract Guarantees

- Deterministic chunk data is sourced from `engine/world/worldStore.js`.
- Scene code does not call generation functions directly.
- Scene code does not duplicate generator logic.
- Adapter is the only Phaser runtime path that touches world/camera engine modules.
- Stream window loading is idempotent per camera chunk (window refresh happens only when camera chunk center changes).
- Tile/walkability helpers centralize tile semantics so gameplay/debug modules avoid direct world-store access.
- Collision and navigation helpers centralize world-geometry access so gameplay modules avoid direct world-store coupling.

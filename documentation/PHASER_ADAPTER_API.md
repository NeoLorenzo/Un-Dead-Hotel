# Phaser Runtime Adapter API (Phase 3)

## Purpose

Defines the app-level adapter contract between Phaser scene code and engine world systems.

This keeps Phaser scene code focused on input/render orchestration and keeps deterministic world logic in `engine/`.

## Factory

- `createPhaserRuntimeAdapter({ streamWidthChunks?, streamHeightChunks? })`

## Returned API

- `chunkSize: number`
- `moveCameraBy(dxTiles, dyTiles) -> { x: number, y: number }`
- `getCameraTilePosition() -> { x: number, y: number }`
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

## Contract Guarantees

- Deterministic chunk data is sourced from `engine/world/worldStore.js`.
- Scene code does not call generation functions directly.
- Scene code does not duplicate generator logic.
- Adapter is the only Phaser runtime path that touches world/camera engine modules.
- Stream window loading is idempotent per camera chunk (window refresh happens only when camera chunk center changes).

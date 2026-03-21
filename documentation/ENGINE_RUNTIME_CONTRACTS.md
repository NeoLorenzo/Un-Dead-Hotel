# Engine Runtime Contracts (Phase 1)

## Purpose

This document freezes the runtime-facing contracts for engine modules in the game runtime architecture (Phaser-based).

Contract version: `v1`  
Frozen on: `March 18, 2026`  
Updated contract revision: `v1.1` on `March 21, 2026` (locomotion raster utility contract added)

## Contract Rules

- Engine modules under `engine/` must remain framework-agnostic.
- Engine modules must not import Phaser.
- Engine modules must not depend on DOM/canvas APIs.
- App runtimes are allowed to compose engine modules differently, but must consume these same contracts.

## World Store Contract

Factory:

- `createWorldStore(options?)`

Returned API:

- `ensureChunk(cx, cy) -> ChunkPayload`
- `ensureWindow(centerCx, centerCy, widthChunks, heightChunks) -> void`
- `getLoadedBounds() -> LoadedBounds`
- `getLoadedChunkCount() -> number`
- `getLoadedAssignmentCount() -> number`

Required return structures:

- `LoadedBounds`
  - `{ minX: number, maxX: number, minY: number, maxY: number }`
- `ChunkPayload` required fields used by runtimes:
  - `tileMap: Uint8Array`
  - `rooms: Array<{ x: number, y: number, w: number, h: number }>`
  - `assignment: { sockets: { N: boolean, E: boolean, S: boolean, W: boolean }, tileId: string, rotationTurns: number }`

Notes:

- `ChunkPayload` may include additional telemetry fields; runtimes should not rely on non-documented fields for core behavior.
- `tileMap.length` must equal `chunkSize * chunkSize`.

## Camera Contract

Factory:

- `createCameraController({ chunkSize, initialTileX?, initialTileY? })`

Returned API:

- `moveBy(dxTiles, dyTiles) -> { x: number, y: number }`
- `setTilePosition(tileX, tileY) -> { x: number, y: number }`
- `getTilePosition() -> { x: number, y: number }`
- `getChunkPosition() -> { x: number, y: number }`

Invariants:

- Camera state is tile-space (`number`, may be fractional).
- Chunk position is derived by flooring tile position with `chunkSize`.

## HUD Contract

Factory:

- `createRuntimeHud({ element, seed, streamWidthChunks, streamHeightChunks })`

Returned API:

- `render({ loadedChunkCount, loadedBounds, cameraChunk, viewportChunksDrawn, zoomTilePixels })`

## Runtime Composition Contract

Any runtime implementation must:

- Load/generate chunks only via world store contract.
- Use camera controller as source of camera tile/chunk truth.
- Keep engine generation deterministic.
- Treat HUD as display-only (no gameplay state ownership).

## Sub-Tile Line Raster Contract (`v1.1`)

Engine module:

- `engine/world/lineTileRasterizer.js`

Required exports consumed by runtime modules:

- `subTileCoordKey(cellX, cellY) -> string`
- `worldToSubTileCell(worldX, worldY, cellSizeTiles?) -> { x: number, y: number }`
- `subTileCellToWorldCenter(cellX, cellY, cellSizeTiles?) -> { x: number, y: number }`
- `buildOccupiedSubTileKeysFromWorldPoints(worldPoints, options?) -> Set<string>`
- `rasterizeSubTileLine(options) -> RasterResult`

`RasterResult` shape used by runtime modules:

- `status: "ok" | "blocked" | "invalid"`
- `startCell: { x, y } | null`
- `goalCell: { x, y } | null`
- `pathCells: Array<{ x, y }>`
- `pathWorld: Array<{ x, y }>`
- `blockedCell: { x, y } | null`
- `wasTrimmed: boolean`

Rules:

- Module must remain framework-agnostic (`engine/` contract rule still applies).
- Rasterization must support deterministic line stepping over sub-tile lattice.
- Runtime modules may provide `isBlockedCell(...)` callback for occupancy/collision policy.
- Runtime locomotion may execute trimmed prefix paths when `blockedCell` is present.

## Phase 1 Acceptance Status

- Runtime-facing APIs documented for chunk access/loading, camera state, and HUD inputs.
- Framework boundary constraints documented (`engine/` remains framework-agnostic).
- Runtime-facing raster locomotion utility contract documented (`v1.1`).

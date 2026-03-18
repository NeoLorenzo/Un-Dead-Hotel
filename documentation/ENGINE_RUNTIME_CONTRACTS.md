# Engine Runtime Contracts (Phase 1)

## Purpose

This document freezes the runtime-facing contracts for engine modules before Phaser integration.

Contract version: `v1`  
Frozen on: `March 18, 2026`

## Contract Rules

- Engine modules under `engine/` must remain framework-agnostic.
- Engine modules must not import Phaser.
- Engine modules must not depend on DOM/canvas APIs.
- App runtimes (`apps/game`, future `apps/phaser`) are allowed to compose engine modules differently, but must consume these same contracts.

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

## Surface Renderer Contract (Current Canvas Runtime)

Factory:

- `createWorldSurface(config)`

Returned API:

- `resizeToWindow(options?) -> { width: number, height: number }`
- `render({ cameraTileX, cameraTileY, ensureChunk }) -> RenderFrame`
- `getViewportChunkBounds(cameraTileX, cameraTileY) -> ViewportBounds`
- `getTilePixels() -> number`
- `setTilePixels(nextTilePixels) -> boolean`

Required structures:

- `ViewportBounds`
  - `{ minChunkX: number, maxChunkX: number, minChunkY: number, maxChunkY: number }`
- `RenderFrame`
  - `{ bounds: ViewportBounds, drawnChunks: number, pendingChunkSprites: number, width: number, height: number }`

## Input Contract

Pan input:

- `createKeyboardPanInput({ speedTilesPerSecond, onMove, target? })`
  - `start()`
  - `stop()`
  - movement callback payload: `{ dx: number, dy: number }`

Zoom input:

- `createZoomInput({ onZoom, target?, wheelTarget?, zoomStep? })`
  - `start()`
  - `stop()`
  - zoom callback payload: `{ delta: number, source: "wheel" | "key" }`

Current game runtime policy:

- Pan keys: `WASD`
- Zoom: mouse wheel only

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

## Phase 1 Acceptance Status

- Runtime-facing APIs documented for chunk access/loading, camera state, and HUD inputs.
- Framework boundary constraints documented (`engine/` remains framework-agnostic).
- Existing canvas runtime behavior unchanged by this phase.

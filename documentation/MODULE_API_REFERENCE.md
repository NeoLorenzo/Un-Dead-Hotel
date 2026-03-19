# Module API Reference

This document summarizes the primary runtime-facing APIs in the current architecture.

Canonical contract details now live in:

- `ENGINE_RUNTIME_CONTRACTS.md` (contract version `v1`, frozen March 18, 2026)

## Generation Layer

### `engine/generation/chunkGenerator.js`

Key exports used by runtime systems:

- `buildCorridorTilePatterns()`
- `buildAccessCorridorCatalogue(patterns)`
- `buildSeededCorridorAssignment(patterns, cx, cy, rerollIndex?)`
- `buildForcedCorridorAssignment(patterns, cx, cy, requiredSide, forceIndex?)`
- `hasConnectingNeighbor(assignments, cx, cy)`
- `generateChunkSpecialSpaces(sockets, cx, cy)`
- `placeChunkAccessCorridors(baseTileMap, cx, cy, accessCatalogue)`
- `generateChunkRooms(baseTileMap, cx, cy)`
- constants for tile semantics and seed/version metadata

## World Layer

### `engine/world/worldStore.js`

Factory:

- `createWorldStore(options?)`

Returned API:

- `ensureChunk(cx, cy)` -> returns generated chunk payload
- `ensureWindow(centerCx, centerCy, widthChunks, heightChunks)`
- `getLoadedBounds()` -> `{ minX, maxX, minY, maxY }`
- `getLoadedChunkCount()`
- `getLoadedAssignmentCount()`

### `engine/world/worldSurface.js`

Factory:

- `createWorldSurface(config)`

Returned API:

- `resizeToWindow(options?)` -> sets canvas pixel size
- `render({ cameraTileX, cameraTileY, ensureChunk })` -> draws frame
- `getViewportChunkBounds(cameraTileX, cameraTileY)`
- `getTilePixels()`
- `setTilePixels(nextTilePixels)` -> `boolean` changed

### `engine/world/cameraController.js`

- `createCameraController({ chunkSize, initialTileX?, initialTileY? })`
  - `moveBy(dxTiles, dyTiles)`
  - `setTilePosition(tileX, tileY)`
  - `getTilePosition()`
  - `getChunkPosition()`
- `cameraMoveFromKey(key, stepTiles)` -> `{ dx, dy } | null`

### `engine/world/inputController.js`

- `createKeyboardPanInput({ speedTilesPerSecond, onMove, target? })`
  - `start()`
  - `stop()`
- `createZoomInput({ onZoom, target?, wheelTarget?, zoomStep? })`
  - `start()`
  - `stop()`

### `engine/world/runtimeHud.js`

- `createRuntimeHud({ element, seed, streamWidthChunks, streamHeightChunks })`
  - `render({ loadedChunkCount, loadedBounds, cameraChunk, viewportChunksDrawn, zoomTilePixels })`

### `engine/world/aStarPathfinder.js`

- `findPath({ start, goal, isWalkable, maxNodes?, includeDebug? })`
  - returns:
    - `{ status: "found", path: Array<{ x, y }>, debug? }`
    - `{ status: "blocked" | "no_path" | "budget_exceeded", path: [], debug? }`
- `createAStarPathfinder()`
  - returns `{ findPath }`

## App Composition Layer

### `apps/game/gameApp.js`

Composition responsibilities:

- instantiate all world modules,
- coordinate render cycle,
- connect resize/input events to runtime systems.

Current runtime control policy:

- pan: `WASD`
- zoom: mouse wheel

### `apps/phaser/phaserRuntimeAdapter.js`

Returned API includes:

- stream/camera snapshot methods:
  - `ensureStreamWindow()`
  - `getFrameSnapshot(viewWidthPx, viewHeightPx, tilePixels)`
  - `moveCameraBy(dxTiles, dyTiles)`
  - `getCameraTilePosition()`
- tile query helpers:
  - `worldToTile(worldX, worldY)`
  - `tileToWorldCenter(tileX, tileY)`
  - `getTileAtWorld(tileX, tileY)`
  - `isWalkableTile(tileX, tileY)`
  - `forEachVisibleTile(viewWidthPx, viewHeightPx, tilePixels, visitFn)`

### `apps/phaser/human/humanController.js`

- `createHumanController({ scene, runtime, moveSpeedTilesPerSecond?, spawnSearchRadiusTiles?, spawnTile? })`
  - selection:
    - `select()`
    - `deselect()`
    - `isSelected()`
  - movement/path:
    - `setPath(pathTiles)`
    - `clearPath()`
    - `update(dtSeconds)`
  - render/sync:
    - `syncToView({ cameraTile, tilePixels, viewWidthPx, viewHeightPx })`
  - geometry/debug:
    - `getBoundsWorld()`
    - `getScreenBounds()`
    - `containsScreenPoint(screenX, screenY)`
    - `intersectsScreenRect(rect)`
    - `getDebugState()`
    - `getCurrentTile()`
    - `getCurrentWorldPosition()`
    - `hasActivePath()`
    - `consumePathBlockedEvent()`
  - lifecycle:
    - `destroy()`

### `apps/phaser/human/humanSelectionController.js`

- `createHumanSelectionController({ scene, humanController, onSelectionChanged?, dragThresholdPx? })`
  - `onPointerDown(pointer)`
  - `onPointerMove(pointer)`
  - `onPointerUp(pointer)`
  - `updateOverlay()`
  - `destroy()`

### `apps/phaser/human/humanCommandController.js`

- `createHumanCommandController({ scene, runtime, humanController, pathfinder, maxPathNodes?, goalSearchRadiusTiles?, maxCommandDistanceTiles? })`
  - `issueMoveCommand(pointerWorldX, pointerWorldY)`
  - `update(dtSeconds)`
  - `syncToView({ cameraTile, tilePixels, viewWidthPx, viewHeightPx })`
  - `setDebugEnabled(enabled)`
  - `getDebugState()`
  - `destroy()`

### `apps/phaser/debug/humanDebugOverlay.js`

- `createHumanDebugOverlay({ scene, runtime, humanController, commandController? })`
  - `setEnabled(enabled)`
  - `isEnabled()`
  - `renderFrame({ cameraTile, tilePixels, viewWidthPx, viewHeightPx })`
  - `clear()`
  - `destroy()`

### `apps/debug/debugApp.js`

Debug responsibilities:

- render diagnostic generation views,
- expose chunk reports and validation summaries,
- visualize tile catalogs/prefabs.

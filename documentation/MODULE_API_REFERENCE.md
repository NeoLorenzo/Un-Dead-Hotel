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

### `engine/world/cameraController.js`

- `createCameraController({ chunkSize, initialTileX?, initialTileY? })`
  - `moveBy(dxTiles, dyTiles)`
  - `setTilePosition(tileX, tileY)`
  - `getTilePosition()`
  - `getChunkPosition()`

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

### `engine/world/subTilePathfinder.js`

- `findPath({ startWorld, goalWorld, navigationGrid, maxNodes?, includeDebug? })`
  - returns:
    - `{ status: "found", path: Array<{ x, y }>, searchStats, debug? }`
    - `{ status: "blocked" | "no_path" | "budget_exceeded", path: [], searchStats, debug? }`
  - `searchStats` includes:
    - `expandedCount`, `maxNodes`, `openCount`, `closedCount`
    - `boundaryHits: { minX, maxX, minY, maxY }`
    - `touchedBoundary`, `domainClipped`
  - implementation details:
    - bidirectional A* (forward/backward search fronts),
    - heap-based open frontier selection.
- `createSubTilePathfinder()`
  - returns `{ findPath }`

## App Composition Layer

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
- collision/navigation helpers:
  - `getChunkCollisionGeometry(chunkX, chunkY)`
  - `getChunkNavigationData(chunkX, chunkY)`
  - `forEachCollisionObstacleInWorldBounds(minWorldX, minWorldY, maxWorldX, maxWorldY, visitFn)`
  - `forEachVisibleCollisionObstacle(viewWidthPx, viewHeightPx, tilePixels, visitFn)`
  - `isWalkableWorldPoint(worldX, worldY, agentRadiusTiles?)`
  - `isWalkableWorldRect(worldX, worldY, halfWidthTiles?, halfHeightTiles?)`
  - `resolveWorldRectMovement({ startWorldX, startWorldY, deltaWorldX, deltaWorldY, halfWidthTiles?, halfHeightTiles?, stepTiles? })`
  - `buildSubTileNavigationGrid({ minWorldX, minWorldY, maxWorldX, maxWorldY, cellSizeTiles?, agentRadiusTiles? })`

### `apps/phaser/human/humanController.js`

- `createHumanController({ scene, runtime, moveSpeedTilesPerSecond?, spawnSearchRadiusTiles?, spawnTile? })`
  - selection:
    - `select()`
    - `deselect()`
    - `isSelected()`
  - movement/path:
    - `setPath(pathTiles, options?)`
    - `setWorldPath(worldPathPoints)`
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
    - `getSpawnTile()`
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

- `createHumanCommandController({ scene, runtime, humanController, pathfinder, maxPathNodes?, goalSearchRadiusTiles?, maxCommandDistanceTiles?, subTileCellSizeTiles?, navGridPaddingTiles?, navPaddingExpansionFactors?, agentRadiusTiles?, maxDynamicExpansionAttempts?, maxAutoPaddingTiles? })`
  - `issueMoveCommand(pointerWorldX, pointerWorldY)`
  - `update(dtSeconds)`
  - `syncToView({ cameraTile, tilePixels, viewWidthPx, viewHeightPx })`
  - `setDebugEnabled(enabled)`
  - `getDebugState()` (includes expansion-attempt summary and per-attempt bounds/boundary metadata)
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

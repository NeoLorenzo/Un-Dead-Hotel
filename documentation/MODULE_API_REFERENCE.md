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
    - heap-based open frontier selection,
    - 8-direction neighbor expansion (cardinal + diagonal),
    - octile-distance heuristic,
    - diagonal corner-cut prevention (adjacent cardinal cells must be walkable).
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

- `createHumanController({ scene, runtime, role?, visualStyle?, moveSpeedTilesPerSecond?, spawnSearchRadiusTiles?, spawnTile?, maxHp?, currentHp? })`
  - selection:
    - `select()`
    - `deselect()`
    - `isSelected()`
    - `isSelectable()`
  - movement/path:
    - `setPath(pathTiles, options?)`
    - `setWorldPath(worldPathPoints)`
    - `setWaypointWorld(waypointWorld)`
    - `clearWaypoint()`
    - `clearPath()`
    - `hasWaypoint()`
    - `nudge(deltaWorldX, deltaWorldY)` (soft separation support)
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
    - `getWorldPosition()`
    - `getHeadingRadians()`
    - `setHeadingRadians(headingRadians)`
    - `rotateHeading(deltaRadians)`
    - `getVisionCone()`
    - `hasActivePath()`
    - `consumePathBlockedEvent()`
    - `getSpawnTile()`
    - `getMoveSpeedTilesPerSecond()`
    - `getRole()`
    - `setRole(role, options?)`
    - `getHealthState()`
    - `getCurrentHp()`
    - `getMaxHp()`
    - `isDead()`
    - `applyDamage(amount)`
    - `heal(amount)`
    - `setCurrentHp(nextCurrentHp)`
    - `setMaxHp(nextMaxHp, options?)`
  - lifecycle:
    - `destroy()`

### `apps/phaser/human/humanManager.js`

- `createHumanManager({ scene, runtime, moveSpeedTilesPerSecond?, spawnSearchRadiusTiles?, primarySurvivorSpawnTile?, naturalGuestPolicy?, guestPerceptionPolicy?, guestBehaviorPolicy? })`
  - roster/query:
    - `getHumanEntries({ livingOnly? })`
    - `getHumanControllers({ livingOnly? })`
    - `getPrimaryHumanController()`
    - `getPrimaryLivingHumanController()`
    - `getLivingHumanCount()`
  - lifecycle/update:
    - `update(dtSeconds)`
    - `syncToView({ cameraTile, tilePixels, viewWidthPx, viewHeightPx })`
    - `destroy()`
  - diagnostics:
    - `getDebugState()` (includes survivor/guest counts, guest spawn/perception/behavior/conversion diagnostics, and per-human debug payloads)

### `apps/phaser/human/humanPerception.js`

- `createHumanPerception({ runtime, lineCheckStepTiles? })`
  - `evaluateVision({ observerWorld, headingRadians, coneAngleDegrees, coneRangeTiles, targets })`
  - `getConfig()`

### `apps/phaser/human/humanSelectionController.js`

- `createHumanSelectionController({ scene, humanController?, getHumanControllers?, onSelectionChanged?, dragThresholdPx? })`
  - `onPointerDown(pointer)`
  - `onPointerMove(pointer)`
  - `onPointerUp(pointer)`
  - `getSelectedControllers()`
  - `getSelectedCount()`
  - `clearSelection()`
  - `updateOverlay()`
  - `destroy()`

### `apps/phaser/human/humanCommandController.js`

- `createHumanCommandController({ scene, runtime, humanController?, getSelectedHumanControllers?, pathfinder, maxPathNodes?, goalSearchRadiusTiles?, maxCommandDistanceTiles?, subTileCellSizeTiles?, navGridPaddingTiles?, navPaddingExpansionFactors?, agentRadiusTiles?, startUnstickSearchRadiusTiles?, maxDynamicExpansionAttempts?, maxAutoPaddingTiles?, groupTileClaimMaxRadius? })`
  - `issueMoveCommand(pointerWorldX, pointerWorldY)`
  - `update(dtSeconds)`
  - `syncToView({ cameraTile, tilePixels, viewWidthPx, viewHeightPx })`
  - `setDebugEnabled(enabled)`
  - `getDebugState()` (includes selected-count snapshot, last command summary, expansion-attempt summary, and per-attempt bounds/boundary metadata)
  - `destroy()`

### `apps/phaser/debug/runtimeDebugController.js`

- `createRuntimeDebugController({ onVisibilityChanged?, initialEnabled? })`
  - `addRenderer(renderer)`
  - `removeRenderer(renderer)`
  - `setEnabled(enabled)`
  - `toggle()` -> returns current enabled state
  - `isEnabled()`
  - `renderFrame(frameState)`
  - `destroy()`

### `apps/phaser/debug/humanDebugOverlay.js`

- `createHumanDebugOverlay({ scene, runtime, humanManager?, humanController, commandController?, renderBackdrop?, renderCollisionObstacles? })`
  - `setEnabled(enabled)`
  - `isEnabled()`
  - `renderFrame({ cameraTile, tilePixels, viewWidthPx, viewHeightPx })`
  - `clear()`
  - `destroy()`

### `apps/phaser/zombie/zombieController.js`

- `createZombieController({ id, scene, runtime, initialWorld, moveSpeedTilesPerSecond?, arrivalRadiusTiles?, maxHp?, currentHp? })`
  - waypoint/motion:
    - `setWaypointWorld(waypointWorld)`
    - `clearWaypoint()`
    - `hasWaypoint()`
    - `update(dtSeconds)`
    - `nudge(deltaWorldX, deltaWorldY)` (soft separation support)
  - render/sync:
    - `syncToView({ cameraTile, tilePixels, viewWidthPx, viewHeightPx })`
  - state/query:
    - `getId()`
    - `getWorldPosition()`
    - `getHeadingRadians()`
    - `setHeadingRadians(headingRadians)`
    - `rotateHeading(deltaRadians)`
    - `getVisionCone()` -> `{ angleDegrees, rangeTiles }`
    - `getColliderWorld()`
    - `getMoveSpeedTilesPerSecond()`
    - `getHealthState()`
    - `getCurrentHp()`
    - `getMaxHp()`
    - `isDead()`
    - `applyDamage(amount)`
    - `heal(amount)`
    - `setCurrentHp(nextCurrentHp)`
    - `setMaxHp(nextMaxHp, options?)`
    - `getDebugState()`
  - lifecycle:
    - `destroy()`

### `apps/phaser/zombie/zombieWanderPlanner.js`

- `createZombieWanderPlanner({ runtime, candidateAttempts?, continuationAttempts?, lineCheckStepTiles?, coneClipRayCount? })`
  - `pickWaypointForZombie(zombieController, options?)`
    - default return: `waypointWorld | null`
    - options:
      - `includeDebug?: boolean`
      - `blockedSectorsRadians?: Array<{ centerRadians, halfAngleRadians }>`
    - debug return when `options.includeDebug === true`:
      - `{ waypoint: waypointWorld | null, debug: { reason, attempts, continuationAttempts, rayCount, raySamples, candidates } }`
      - candidate `status` values: `"expanded_selected" | "fallback_selected" | "no_continuation" | "blocked" | "los_blocked" | "failed_sector"`

### `apps/phaser/zombie/zombieManager.js`

- `createZombieManager({ scene, runtime, spawnSearchRadiusTiles?, moveSpeedTilesPerSecond?, firstContactPolicy?, pursuitPolicy?, attackPolicy?, waypointCandidateAttempts?, waypointContinuationAttempts?, waypointConeClipRayCount?, noCandidateStreakThreshold?, recoveryDurationSeconds?, recoveryRotateRadiansPerSecond?, failedSectorMemoryTtlSeconds?, failedSectorHalfAngleDegrees?, noCandidateRepickCooldownSeconds? })`
  - `spawnAtWorld(worldX, worldY, options?)` -> `{ accepted, reason?, zombieId?, usedFallback?, spawnWorld? }`
    - `options.allowFallback?: boolean`
    - `options.source?: string`
  - `update(dtSeconds)`
  - `syncToView({ cameraTile, tilePixels, viewWidthPx, viewHeightPx })`
  - `getZombieCount()`
  - `setZombieWaypoint(zombieId, waypointWorld)`
  - `clearZombieWaypoint(zombieId)`
  - `getDebugState()` (includes first-contact population diagnostics, pursuit/attack diagnostics, zombie health summary, per-zombie waypoint selection diagnostics, per-zombie `wanderRecovery` state, and `lastSpawnAttempt` result)
  - `destroy()`

### `apps/phaser/debug/zombieDebugOverlay.js`

- `createZombieDebugOverlay({ scene, runtime, zombieManager })`
  - `setEnabled(enabled)`
  - `isEnabled()`
  - `renderFrame({ cameraTile, tilePixels, viewWidthPx, viewHeightPx })`
  - `clear()`
  - `destroy()`

### `apps/phaser/debug/firstContactDiagnosticsPanel.js`

- `createFirstContactDiagnosticsPanel({ parentElement, humanManager?, humanController?, humanCommandController?, zombieManager?, getGameOverActive? })`
  - `setEnabled(enabled)`
  - `isEnabled()`
  - `renderFrame(frameState?)`
  - `clear()`
  - `destroy()`

### `apps/phaser/combat/healthModel.js`

- `createHealthModel({ maxHp?, currentHp?, onDeath?, onRevive? })`
  - `getState()` -> `{ currentHp, maxHp, isDead }`
  - `getCurrentHp()`
  - `getMaxHp()`
  - `isDead()`
  - `setCurrentHp(nextCurrentHp)`
  - `setMaxHp(nextMaxHp, options?)`
  - `applyDamage(amount)`
  - `heal(amount)`

### `apps/phaser/combat/zombieAttackResolver.js`

- `createZombieAttackResolver({ damagePerHit?, cooldownSeconds?, zombieTouchRadiusTiles? })`
  - `tickCooldown(attackState, dtSeconds)`
  - `isOnCooldown(attackState)`
  - `attemptAttack({ zombieWorld, targetWorld, targetTouchRadiusTiles, attackState, applyTargetDamage, targetId? })`

### `apps/phaser/ui/agentHpBarOverlay.js`

- `createAgentHpBarOverlay({ scene, humanManager?, humanController?, zombieManager? })`
  - `renderFrame({ cameraTile, tilePixels, viewWidthPx, viewHeightPx })`
  - `clear()`
  - `destroy()`

### `apps/phaser/ui/gameOverOverlay.js`

- `createGameOverOverlay({ parentElement, titleText?, subtitleText?, hintText? })`
  - `setVisible(visible)`
  - `isVisible()`
  - `destroy()`

### `apps/debug/debugApp.js`

Debug responsibilities:

- render diagnostic generation views,
- expose chunk reports and validation summaries,
- visualize tile catalogs/prefabs.

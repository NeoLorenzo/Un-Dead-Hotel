# First Human Implementation Plan (Completed)

## Purpose

Define the step-by-step plan for implementing the first playable human agent in the game runtime.

## Completion Status

- First Human implementation track is complete and closed as of **March 19, 2026**.
- Completed scope:
  - Core Phases 0-8.
  - Geometry migration Phases A-E.
- Remaining migration items (F-H) are explicitly future/backlog work and are not required for First Human scope closure.
- Historical per-phase notes below are retained as implementation log entries.

## Scope (Locked)

- Humans only (zombies deferred).
- Target a playable result as quickly as possible.
- Keep generator/runtime architecture boundaries intact.
- One controllable human for first playable slice.

## Player Interaction Requirements (Locked)

- Left click on human to select it.
- Left click and drag a selection box to select it.
- `Ctrl + Left Click` on map to issue move command to selected human.
- Keyboard key toggles debug-visualization mode for human movement diagnostics.

## Decisions (Option A Locked)

1. How will we make the sprite for the human?
   - Decision: procedural placeholder using Phaser graphics.
   - Implementation: generate a simple top-down body shape (capsule/circle + head marker) at runtime.
   - Reason: zero art pipeline dependency, fastest path to playable controls.

2. What will the pathfinding algorithm be?
   - Decision: tile-grid A* with 4-direction movement and Manhattan heuristic.
   - Implementation: path search on world tile coordinates (`x`, `y`) using a bounded search budget.
   - Reason: deterministic, debuggable, minimal complexity for one unit.
   - Final runtime state: upgraded to sub-tile bidirectional A* (heap frontier) for world-space waypoint routing.

3. How will we make the human agent reliably a rigid body?
   - Decision: Phaser Arcade Physics dynamic body + collision against non-walkable tiles.
   - Implementation: dynamic body for the human, blocked-tile collision gate, waypoint movement with velocity control.
   - Reason: built-in stable collision behavior and faster implementation than custom solver.
   - Final runtime state: geometry-based world-rect collision checks and collision-resolved world-space movement.

## Functional Behavior

1. Spawn
   - Spawn one human near camera center on nearest walkable tile.
   - If direct center is blocked, spiral-search nearest valid tile within a small radius.
2. Selection
   - Single select by left-clicking the human.
   - Drag-select by left-click hold + drag rectangle.
   - Empty click clears selection.
3. Command
   - `Ctrl + Left Click` on map issues move command only when human is selected.
   - Command computes path from current tile to target tile (or nearest walkable target).
4. Movement
   - Human follows waypoints tile by tile.
   - If path becomes invalid (newly blocked or missing chunk data), repath once, then stop if still invalid.
5. Feedback
   - Selected ring under human.
   - Drag selection rectangle while dragging.
   - Temporary move marker at command target.
6. Debug mode (toggle)
   - Press a single keyboard key to toggle debug mode on/off (default key: `` ` `` backquote, final key binding can be changed).
   - When debug mode is on:
   - Render pathfinding data (expanded nodes and final path polyline/waypoints).
   - Render human rigid body boundary/collider shape.
   - Render all non-walkable rigid obstacles in a high-contrast color.
   - Darken or black out non-debug world visuals to isolate diagnostics.
   - When debug mode is off:
   - Return to normal world rendering and hide debug overlays.

## Tile Walkability Rules (MVP)

- Walkable:
  - corridor tile (`1`)
  - room floor tile (`TILE_ROOM_FLOOR`)
  - room door tile (`TILE_ROOM_DOOR`)
  - special-space tiles (`2` through `2 + SPECIAL_SPACE_DEFS.length - 1`)
- Not walkable:
  - empty/unassigned (`0`)
  - reserved access tile (`TILE_ACCESS_RESERVED`)
  - room wall tile (`TILE_ROOM_WALL`)

## Technical Design

1. Runtime data access
   - Extend game runtime adapter with tile query helpers so scene code can ask:
   - `getTileAtWorld(tileX, tileY)`
   - `isWalkableTile(tileX, tileY)`
   - Adapter remains the only Phaser path touching world store/camera engine modules.
2. Pathfinding service
   - Add an engine-level A* utility module (framework-agnostic).
   - Inputs: start tile, target tile, walkable callback, optional search bounds and node budget.
   - Output: ordered tile waypoint list.
3. Human controller
   - Scene-level controller owns sprite/body, selection state, current path, and command target.
   - Movement uses Arcade Physics velocity toward next waypoint center.
   - On waypoint reach (distance threshold), advance to next waypoint.
4. Input handling
   - Pointer down/up/move in Phaser scene.
   - Left pointer:
   - Click selection when drag distance below threshold.
   - Rectangle selection when threshold exceeded.
   - `Ctrl + Left Click`:
   - Issue move command to selected human.
5. Visual overlays
   - Graphics layer for selection rectangle and move marker.
   - Selection ring as child graphic/sprite tied to human position.
6. Debug visualization layer
   - Dedicated overlay graphics container controlled by debug toggle state.
   - Draw order keeps debug overlays above world tiles and below HUD text.
   - Obstacle mask and blackout pass are enabled only in debug mode.

## SOLID Guardrails (Locked)

1. Single Responsibility Principle (SRP)
   - `apps/phaser/phaserApp.js` is composition/orchestration only.
   - Human movement, selection, pathfinding bridge, and debug drawing live in separate modules.
   - `engine/world/aStarPathfinder.js` owns pathfinding only (no rendering/input/Phaser coupling).
2. Open/Closed Principle (OCP)
   - Human controller accepts injected strategy-style dependencies (`pathfinder`, `walkability`, `debugRenderer`).
   - Alternative pathfinding or debug renderers can be added without editing controller core.
3. Liskov Substitution Principle (LSP)
   - Agent controller contract is stable (`select`, `deselect`, `moveTo`, `update`, `getBounds`).
   - Future agent types must be replaceable anywhere this contract is consumed.
4. Interface Segregation Principle (ISP)
   - Split runtime dependencies into small interfaces:
   - tile query interface
   - pathfinder interface
   - command interface
   - debug visualization interface
   - Avoid broad "god" service objects.
5. Dependency Inversion Principle (DIP)
   - High-level gameplay modules depend on abstractions, not concrete world-store/generator internals.
   - Adapter layer is the only boundary that touches concrete world store chunk data.

## File-Level Implementation Plan

1. `apps/phaser/phaserRuntimeAdapter.js`
   - Add tile/world conversion helpers.
   - Add tile query and walkability methods.
   - Add visible-bounds tile iteration helper for obstacle debug drawing.
2. `engine/world/` (new)
   - Add `aStarPathfinder.js` (pure algorithm, no Phaser imports).
   - Optional debug payload output from A* (visited nodes, open/closed counts) behind a flag.
3. `apps/phaser/human/` (new)
   - `humanController.js`: agent movement/state/collider integration.
   - `humanSelectionController.js`: click and drag-box selection flow.
   - `humanCommandController.js`: `Ctrl + Left Click` move command handling.
4. `apps/phaser/debug/` (new)
   - `humanDebugOverlay.js`: path, collider bounds, obstacle highlighting, blackout mode.
5. `apps/phaser/phaserApp.js`
   - Compose modules and wire dependencies.
   - Keep runtime loop orchestration and no detailed gameplay logic.
6. `documentation/`
   - Update architecture/runtime docs after implementation to reflect new human control loop.

## Milestones

1. Milestone 1: Data plumbing
   - Adapter exposes walkability/tile query APIs.
   - Quick debug log confirms correct tile values at pointer target.
2. Milestone 2: Human actor
   - Placeholder human rendered with Arcade dynamic body.
   - Human remains blocked by non-walkable cells.
3. Milestone 3: Selection UX
   - Left-click select and drag-box select both working.
   - Selection visuals are clear.
4. Milestone 4: Move commands
   - `Ctrl + Left Click` path command works on walkable destinations.
   - Human follows A* path reliably with no wall phasing.
5. Milestone 5: Debug mode
   - Keyboard toggle enables/disables movement diagnostics.
   - Debug mode shows pathfinding, collider boundary, and blocked obstacles with background darkened.
6. Milestone 6: Stability pass
   - Handle invalid targets, unreachable destinations, and stream-boundary edge cases.
7. Milestone 7: SOLID conformance pass
   - Verify module boundaries and dependency direction.
   - Ensure `phaserApp.js` remains composition-only.

## Detailed Phase Breakdown

### Phase 0: Pre-Implementation Alignment

- Goal:
  - Lock interfaces and sequencing before writing gameplay code.
- Files:
  - `documentation/archive/FIRST_HUMAN_IMPLEMENTATION_PLAN.md`
  - `documentation/GAME_ARCHITECTURE.md` (later sync)
- Work:
  - Freeze module boundaries and dependency direction from SOLID guardrails.
  - Confirm debug toggle key (`` ` `` backquote default).
  - Confirm walkability tile semantics used by movement/pathing.
- Exit criteria:
  - Plan approved and phase order accepted.

#### Phase 0 Status

- Completed on March 19, 2026.

#### Phase 0 Locked Interface Contracts (`v0.1`)

1. Tile Query Port (adapter-provided)
   - `getTileAtWorld(tileX, tileY) -> number`
   - `isWalkableTile(tileX, tileY) -> boolean`
   - `worldToTile(worldX, worldY) -> { x: number, y: number }`
   - `tileToWorldCenter(tileX, tileY) -> { x: number, y: number }`
   - `forEachVisibleTile(viewWidthPx, viewHeightPx, tilePixels, visitFn) -> void`
2. Pathfinder Port (engine-provided)
   - `findPath({ start, goal, isWalkable, maxNodes?, includeDebug? }) -> { status: "found" | "blocked" | "no_path" | "budget_exceeded", path: Array<{ x: number, y: number }>, debug?: object }`
3. Human Agent Port (scene-level controller)
   - `select() -> void`
   - `deselect() -> void`
   - `isSelected() -> boolean`
   - `setPath(pathTiles) -> void`
   - `clearPath() -> void`
   - `update(dtSeconds) -> void`
   - `getBoundsWorld() -> { x: number, y: number, w: number, h: number }`
   - `getDebugState() -> { collider, path, waypointIndex }`
4. Selection Controller Port
   - `onPointerDown(pointer) -> void`
   - `onPointerMove(pointer) -> void`
   - `onPointerUp(pointer) -> void`
   - `updateOverlay() -> void`
5. Command Controller Port
   - `issueMoveCommand(pointerWorldX, pointerWorldY) -> { accepted: boolean, reason?: string }`
6. Debug Overlay Port
   - `setEnabled(enabled) -> void`
   - `renderFrame(state) -> void`
   - `clear() -> void`

#### Phase 0 Locked Sequencing

1. Adapter data plumbing
2. Engine pathfinder
3. Human controller core
4. Selection controller
5. Command controller
6. Debug overlay mode
7. Stability hardening
8. SOLID conformance and doc sync

#### Phase 0 Sign-Off Checklist

- [x] Module boundaries frozen under SOLID guardrails.
- [x] Debug key default locked to `` ` `` (backquote).
- [x] Walkability tile semantics locked.
- [x] Interface contracts documented for all Phase 1-6 modules.
- [x] Phase ordering frozen to avoid rework churn.

### Phase 1: Runtime Adapter Data Plumbing

- Goal:
  - Expose reliable tile/walkability queries for gameplay systems.
- Files:
  - `apps/phaser/phaserRuntimeAdapter.js`
- Work:
  - Add world tile lookup API (`getTileAtWorld`).
  - Add walkability API (`isWalkableTile`).
  - Add helper to iterate visible tiles for debug obstacle rendering.
  - Keep all world-store coupling inside adapter.
- Verification:
  - Runtime debug print confirms pointer tile lookup values are correct.
  - Adapter methods return consistent values across chunk boundaries.
- Exit criteria:
  - Human systems can read walkability without importing world store directly.

#### Phase 1 Status

- Implemented on March 19, 2026:
  - Added `getTileAtWorld`
  - Added `isWalkableTile`
  - Added `worldToTile`
  - Added `tileToWorldCenter`
  - Added `forEachVisibleTile`
- Verification status (historical log):
  - Runtime/manual validation pass is still required.

### Phase 2: Framework-Agnostic Pathfinder

- Goal:
  - Add reusable A* pathfinding in engine layer.
- Files:
  - `engine/world/aStarPathfinder.js` (new)
- Work:
  - Implement 4-direction A* with Manhattan heuristic.
  - Add configurable node budget and fail-safe return when no path.
  - Add optional debug payload (visited/open/closed) behind flag.
- Verification:
  - Deterministic output for repeated identical start/goal inputs.
  - Correct no-path result for fully blocked targets.
- Exit criteria:
  - Pathfinder can be consumed from Phaser code via abstraction only.

#### Phase 2 Status

- Implemented on March 19, 2026:
  - Added `engine/world/aStarPathfinder.js`
  - Implemented 4-direction A* with Manhattan heuristic
  - Implemented `maxNodes` budget guard (`budget_exceeded`)
  - Implemented optional debug payload (`visitedNodes`, open/closed counts)
  - Exposed both `findPath(...)` and `createAStarPathfinder()`
- Verification completed:
  - Syntax check passed (`node --check engine/world/aStarPathfinder.js`)
  - Runtime smoke test passed:
  - repeated identical inputs produced deterministic identical paths
  - blocked goal returned `blocked`
  - unreachable path returned `no_path`

### Phase 3: Human Actor Core

- Goal:
  - Spawn first human with placeholder sprite and rigid-body behavior.
- Files:
  - `apps/phaser/human/humanController.js` (new)
  - `apps/phaser/phaserApp.js`
- Work:
  - Procedurally create human visual and attach Arcade dynamic body.
  - Spawn on nearest valid walkable tile to camera center.
  - Implement movement toward waypoint centers using body velocity.
  - Ensure blocked/invalid tiles are never entered.
- Verification:
  - Human appears on boot and stays collision-safe around blocked tiles.
  - Human stops correctly when waypoint list ends.
- Exit criteria:
  - Human can exist and move programmatically without pointer input.

#### Phase 3 Status

- Implemented on March 19, 2026:
  - Added `apps/phaser/human/humanController.js`
  - Added procedural placeholder human sprite generation
  - Added nearest-walkable spawn resolution around camera center
  - Added movement update loop with blocked-tile collision gate
  - Added world-to-screen sync and Arcade dynamic body integration
  - Wired controller into `apps/phaser/phaserApp.js` as composition dependency
  - Added simple programmatic startup movement (neighbor tile and return)
  - Enabled Arcade physics in Phaser game config
- Verification completed:
  - Syntax checks passed:
  - `node --check apps/phaser/human/humanController.js`
  - `node --check apps/phaser/phaserApp.js`
- Verification status (historical log):
  - Runtime/manual behavior validation in browser (spawn correctness, movement smoothness, no wall phasing)

### Phase 4: Selection Controls

- Goal:
  - Add robust left-click and drag-box selection.
- Files:
  - `apps/phaser/human/humanSelectionController.js` (new)
  - `apps/phaser/phaserApp.js`
- Work:
  - Implement click select hit-test for human bounds.
  - Implement drag-threshold logic and selection rectangle drawing.
  - Implement empty-click deselect behavior.
- Verification:
  - Click and box selection both toggle selection ring correctly.
  - Drag rectangle behaves correctly at different zoom levels.
- Exit criteria:
  - Selection flow is reliable and decoupled from movement internals.

#### Phase 4 Status

- Implemented on March 19, 2026:
  - Added `apps/phaser/human/humanSelectionController.js`
  - Implemented left-click single selection (select human on hit, deselect on empty click)
  - Implemented left-click drag-box selection with threshold gating
  - Implemented live drag selection rectangle overlay rendering
  - Added human screen-space hit-test helpers:
  - `containsScreenPoint(...)`
  - `intersectsScreenRect(...)`
  - Added human selection ring visual tied to selection state
  - Wired pointer event orchestration in `apps/phaser/phaserApp.js`
- Verification completed:
  - Syntax checks passed:
  - `node --check apps/phaser/human/humanSelectionController.js`
  - `node --check apps/phaser/human/humanController.js`
  - `node --check apps/phaser/phaserApp.js`
- Verification status (historical log):
  - Runtime/manual validation in browser (click selection accuracy and drag-box behavior at different zoom levels)

### Phase 5: Ctrl+Left-Click Commands + Path Following

- Goal:
  - Convert `Ctrl + Left Click` map input into movement orders.
- Files:
  - `apps/phaser/human/humanCommandController.js` (new)
  - `apps/phaser/human/humanController.js`
  - `apps/phaser/phaserApp.js`
- Work:
  - Add `Ctrl + Left Click` command handling (selected human only).
  - Convert world click to goal tile and validate/recover nearest walkable target.
  - Invoke A* and pass resulting path to human controller.
  - Add single repath attempt if path becomes invalid mid-move.
- Verification:
  - `Ctrl + Left Click` command moves selected human to reachable goals.
  - Unreachable goals fail gracefully without crashes.
- Exit criteria:
  - End-to-end selection -> command -> movement loop is playable.

#### Phase 5 Status

- Implemented on March 19, 2026:
  - Added `apps/phaser/human/humanCommandController.js`
  - Implemented `Ctrl + Left Click` move command dispatch (selected human only)
  - Integrated pathfinding via `engine/world/aStarPathfinder.js` through injected dependency
  - Added nearest-walkable target recovery when clicked tile is blocked
  - Added command target marker overlay feedback
  - Added single repath attempt when movement path is blocked mid-travel
  - Removed startup demo auto-movement and replaced with command-driven movement flow
  - Wired command controller orchestration in `apps/phaser/phaserApp.js`
- Verification completed:
  - Syntax checks passed:
  - `node --check apps/phaser/human/humanCommandController.js`
  - `node --check apps/phaser/human/humanController.js`
  - `node --check apps/phaser/phaserApp.js`
- Verification status (historical log):
  - Runtime/manual validation in browser (`Ctrl + Left Click` command behavior, path correctness, blocked-target fallback, one-time repath behavior)

### Phase 6: Debug Visualization Mode

- Goal:
  - Add high-signal diagnostic mode for path/collision debugging.
- Files:
  - `apps/phaser/debug/humanDebugOverlay.js` (new)
  - `apps/phaser/phaserApp.js`
  - `apps/phaser/human/humanController.js`
- Work:
  - Implement backquote (`` ` ``) debug toggle state.
  - Draw pathfinding visuals (visited nodes + final path).
  - Draw human rigid-body boundary.
  - Highlight non-walkable obstacles in visible area.
  - Darken/blackout non-debug visuals when enabled.
- Verification:
  - Toggle is reversible at runtime with no refresh.
  - Debug layers do not persist when mode is turned off.
- Exit criteria:
  - All requested diagnostics are visible and readable in debug mode.

#### Phase 6 Status

- Implemented on March 19, 2026:
  - Added `apps/phaser/debug/humanDebugOverlay.js`
  - Implemented keyboard debug toggle on backquote (`\`` / `Backquote`)
  - Implemented blackout pass to darken non-debug world visuals
  - Implemented rigid obstacle highlighting for non-walkable visible tiles
  - Implemented pathfinding visualization:
  - final computed path
  - visited/expanded nodes (when debug-enabled path requests are issued)
  - Implemented human rigid-body boundary visualization from collider bounds
  - Wired debug overlay as a dedicated module in `apps/phaser/phaserApp.js`
  - Extended `humanCommandController` with debug state surface for overlay consumption
- Verification completed:
  - Syntax checks passed:
  - `node --check apps/phaser/debug/humanDebugOverlay.js`
  - `node --check apps/phaser/human/humanCommandController.js`
  - `node --check apps/phaser/human/humanController.js`
  - `node --check apps/phaser/phaserApp.js`
- Verification status (historical log):
  - Runtime/manual validation in browser:
  - backquote toggle behavior
  - blackout + obstacle highlighting clarity
  - path/visited-nodes/collider overlay readability during movement

### Phase 7: Stability and Edge-Case Hardening

- Goal:
  - Eliminate known failure modes and reduce command jitter.
- Files:
  - `apps/phaser/human/*.js`
  - `apps/phaser/debug/*.js`
  - `apps/phaser/phaserRuntimeAdapter.js`
- Work:
  - Handle rapid repeated command spam.
  - Handle long-distance commands near stream bounds.
  - Tune arrival thresholds and velocity caps to reduce corner jitter.
  - Ensure no input conflict between pointer controls and camera pan.
- Verification:
  - Manual stress test passes across zoom levels and chunk boundaries.
  - No runtime errors under repeated select/command/toggle sequences.
- Exit criteria:
  - Playable first-human loop is stable for normal usage.

#### Phase 7 Status

- Implemented on March 19, 2026:
  - Added command anti-spam throttling with latest-command queue in `humanCommandController`
  - Added long-distance command clamping (Manhattan distance cap) before pathfinding
  - Added command metadata for clamped targets in debug state
  - Added waypoint-center snapping in `humanController` to reduce corner jitter
  - Added tiny-movement stall detection in `humanController` to avoid wall-edge jitter loops
  - Added extra selection guard: `Ctrl + Left Click` is ignored by selection controller to prevent input conflicts
  - Tightened scene command render invalidation to ignore non-selected command attempts
- Verification completed:
  - Syntax checks passed:
  - `node --check apps/phaser/human/humanController.js`
  - `node --check apps/phaser/human/humanCommandController.js`
  - `node --check apps/phaser/human/humanSelectionController.js`
  - `node --check apps/phaser/phaserApp.js`
- Verification status (historical log):
  - Runtime/manual stress validation in browser:
  - rapid repeated `Ctrl + Left Click` command spam behavior
  - long-distance command behavior near stream boundaries
  - corner movement smoothness and reduced jitter

### Phase 8: SOLID Compliance and Documentation Sync

- Goal:
  - Confirm architecture quality and align docs to implementation reality.
- Files:
  - `documentation/GAME_ARCHITECTURE.md`
  - `documentation/GAME_RUNTIME.md`
  - `documentation/MODULE_API_REFERENCE.md`
  - gameplay files touched in earlier phases
- Work:
  - Validate dependency direction (app -> interfaces -> engine utilities).
  - Confirm `phaserApp.js` is composition-only (no bloated behavior logic).
  - Update docs for new controllers, pathfinder utility, and debug overlay.
- Verification:
  - Quick code review against SRP/OCP/LSP/ISP/DIP guardrails.
  - API docs reflect actual exported methods.
- Exit criteria:
  - Implementation and docs are consistent and SOLID-aligned.

#### Phase 8 Status

- Implemented on March 19, 2026:
  - Completed SOLID conformance review for current human slice.
  - Confirmed engine modules remain framework-agnostic (no Phaser imports under `engine/`).
  - Confirmed gameplay modules do not access `worldStore` directly; tile access stays behind runtime adapter.
  - Confirmed pathfinding remains isolated in engine modules (`engine/world/aStarPathfinder.js`, `engine/world/subTilePathfinder.js`).
  - Synced documentation to implemented architecture/runtime:
    - `documentation/GAME_ARCHITECTURE.md`
    - `documentation/GAME_RUNTIME.md`
    - `documentation/MODULE_API_REFERENCE.md`
    - `documentation/PHASER_ADAPTER_API.md`
    - `documentation/GAME_OVERVIEW.md`
    - `documentation/README.md`
    - `README.md`
- Verification completed:
  - Dependency-direction spot checks:
    - no `phaser` imports in `engine/`
    - no `worldStore` access inside `apps/phaser/human/*` or `apps/phaser/debug/*`
- Residual note:
  - Final behavioral validation is still manual runtime testing in browser (controls, pathing, debug overlays).

## Geometry Navigation Migration Roadmap (Next Major Track)

This roadmap defines how to evolve from tile-locked movement/pathing to world-space navigation with partial-tile obstacles (for example walls using only ~20% of a tile, furniture, and narrow passages).

### Migration Phase A: Data Model Split (Tiles vs Collision vs Navigation)

- Goal:
  - Separate render tiles from collision geometry and navigation data.
- Files:
  - `engine/generation/chunkGenerator.js`
  - `engine/world/worldStore.js`
  - `apps/phaser/phaserRuntimeAdapter.js`
- Work:
  - Keep tile map for rendering/semantic room systems.
  - Introduce per-chunk obstacle geometry payload (rects/polylines/polygons in world units).
  - Define navigation data container separate from tile map.
- Exit criteria:
  - Runtime can query collision geometry without inferring from tile IDs.

#### Migration Phase A Status

- Implemented on March 19, 2026:
  - Added shared walkability/collision semantics in `engine/generation/chunkGenerator.js`:
  - `isTileWalkableForHumans(tile)`
  - `isTileCollisionBlockedForHumans(tile)`
  - Added per-chunk data builders in `engine/generation/chunkGenerator.js`:
  - `buildChunkCollisionGeometry(tileMap)`
  - `buildChunkNavigationData(tileMap)`
  - Extended chunk payload generation in `engine/world/worldStore.js`:
  - attach `collisionGeometry` and `navigationData` alongside `tileMap` and `rooms`
  - Extended runtime adapter APIs in `apps/phaser/phaserRuntimeAdapter.js`:
  - `getChunkCollisionGeometry(chunkX, chunkY)` (world-space obstacle query)
  - `getChunkNavigationData(chunkX, chunkY)`
  - `forEachVisibleCollisionObstacle(...)`
  - Included `collisionGeometry` and `navigationData` in chunk view-model output.
- Verification status (historical log):
  - Runtime/manual validation pass for collision-geometry queries during active play session.
- Notes:
  - Collision geometry is intentionally coarse in this phase (tile-occupancy rects).
  - Precise thin-wall and partial-footprint colliders are deferred to Migration Phase B.

### Migration Phase B: Geometry Extraction From Existing World

- Goal:
  - Convert current known blockers (room thin walls, blocked footprints) into explicit colliders.
- Files:
  - `engine/generation/chunkGenerator.js`
  - `engine/world/worldStore.js`
- Work:
  - Emit colliders for wall segments and blocked structures with precise dimensions.
  - Maintain deterministic generation behavior with same seed/chunk coordinates.
- Exit criteria:
  - Debug output shows obstacles as geometry shapes, not full blocked tiles.

#### Migration Phase B Status

- Implemented on March 19, 2026:
  - Upgraded collision geometry generation in `engine/generation/chunkGenerator.js`:
  - room perimeter wall colliders now emit as thin world-geometry strips using `ROOM_THIN_WALL_RATIO` and door gaps
  - non-wall blocked regions still emit as tile-occupancy rectangles for coarse blocked space
  - collision payload now includes source metadata (`roomThinWalls` vs `tileOccupancy`)
  - Updated `engine/world/worldStore.js` to pass full chunk room context into collision/navigation data builders.
  - Updated debug overlay rendering in `apps/phaser/debug/humanDebugOverlay.js`:
  - obstacle rendering now consumes `forEachVisibleCollisionObstacle(...)`
  - blocked-space debug now draws from geometry rectangles instead of raw blocked tiles.
- Verification status (historical log):
  - Runtime/manual debug-mode validation pass (thin wall strips and door openings should appear as geometry, not full wall tiles).
- Notes:
  - Pathfinding/movement behavior remains tile-grid in this phase by design.
  - World-space command destinations and sub-tile navigation remain in Migration Phases C and D.

### Migration Phase C: World-Space Command Targets

- Goal:
  - Stop snapping commands to tile centers.
- Files:
  - `apps/phaser/human/humanCommandController.js`
  - `apps/phaser/phaserRuntimeAdapter.js`
- Work:
  - Preserve raw world-space command point from click.
  - Resolve to nearest navigable world point with configurable radius.
  - Keep `Ctrl + Left Click` input policy unchanged.
- Exit criteria:
  - Player can place destinations between tile centers.

#### Migration Phase C Status

- Implemented on March 19, 2026:
  - Updated `apps/phaser/human/humanCommandController.js` to keep raw world-space command points from `Ctrl + Left Click`.
  - Added nearest navigable world-point resolution within configurable radius (instead of tile-center fallback).
  - Added world-distance command clamping and preserved world-space marker rendering.
  - Updated `apps/phaser/human/humanController.js` to support a final world-space approach target after tile-path traversal.
  - Human now stops at resolved world coordinates, including between tile centers, when destination tile is walkable.
- Verification status (historical log):
  - Runtime/manual validation that click destinations inside walkable tiles are preserved exactly and final position no longer snaps to tile center.
- Notes:
  - Core pathfinding remains tile-grid A* in this phase.
  - Sub-tile pathfinding and geometry-inflated routing remain in Migration Phase D.

### Migration Phase D: Sub-Tile Navigation Layer (Bridge Step)

- Goal:
  - Replace tile-node A* with higher-resolution navigable space without full navmesh complexity yet.
- Files:
  - `engine/world/aStarPathfinder.js` (or new `engine/world/nav/*`)
  - `engine/world/worldStore.js`
  - `apps/phaser/phaserRuntimeAdapter.js`
- Work:
  - Build sub-tile occupancy grid (example target resolution: 0.25 tile cell).
  - Inflate blocked geometry by agent radius for clearance-safe paths.
  - Run A* on sub-tile cells and output world-space waypoints.
- Exit criteria:
  - Path can thread around half-tile obstacles where full-tile system previously failed.

#### Migration Phase D Status

- Implemented on March 19, 2026:
  - Added framework-agnostic sub-tile pathfinding module: `engine/world/subTilePathfinder.js`.
  - Added runtime sub-tile navigation grid builder in `apps/phaser/phaserRuntimeAdapter.js`:
  - `buildSubTileNavigationGrid(...)`
  - `isWalkableWorldPoint(...)`
  - `forEachCollisionObstacleInWorldBounds(...)`
  - Updated `apps/phaser/human/humanCommandController.js` to:
  - build obstacle-inflated 0.25-tile nav grids around command routes
  - run sub-tile pathfinding and output world-space waypoints
  - keep one-time repath behavior using world-space goals
  - Updated `apps/phaser/human/humanController.js` to follow world-space waypoint paths via `setWorldPath(...)`.
  - Updated `apps/phaser/phaserApp.js` to inject `createSubTilePathfinder()` into command flow.
  - Updated debug overlay (`apps/phaser/debug/humanDebugOverlay.js`) to render sub-tile visited cells and world-space path lines.
  - Updated `engine/world/subTilePathfinder.js` to use bidirectional A* with heap-based open frontiers.
  - Updated `engine/world/subTilePathfinder.js` to emit `searchStats` with boundary-hit and clipped-domain signals.
  - Updated `apps/phaser/human/humanCommandController.js` with boundary-aware directional nav-window expansion retries for longer detours.
  - Tuned game runtime command limits for balance between long-route reliability and frame stability (`maxPathNodes=32000`, `maxDynamicExpansionAttempts=7`, `maxAutoPaddingTiles=1536`).
- Verification status (historical log):
  - Runtime/manual movement validation that routes now pass through valid sub-tile lanes around thin obstacles.
- Notes:
  - This phase introduces sub-tile path planning and world-space waypoint following.
  - Full geometry collision-response refinement remains in Migration Phase E.

### Migration Phase E: Geometry-Based Movement + Collision

- Goal:
  - Move agent and resolve collision against geometry colliders rather than tile walkability checks.
- Files:
  - `apps/phaser/human/humanController.js`
  - `apps/phaser/phaserRuntimeAdapter.js`
- Work:
  - Switch from tile occupancy checks to world-shape intersection checks.
  - Follow world-space waypoints and apply arrival radius (not exact center snap).
  - Keep one-time repath behavior when route becomes invalid.
- Exit criteria:
  - Human reliably stops/collides on partial-tile obstacles and can stand between tiles.

#### Migration Phase E Status

- Implemented on March 19, 2026:
  - Extended `apps/phaser/phaserRuntimeAdapter.js` with geometry-shape movement/collision APIs:
  - `isWalkableWorldRect(...)`
  - `resolveWorldRectMovement(...)`
  - Updated `apps/phaser/human/humanController.js` to:
  - use world-rect collision checks for path sanitization and motion validity
  - resolve per-frame movement through geometry collision + sliding response against obstacle rectangles
  - advance waypoints using arrival radius (no exact waypoint-center snap)
  - preserve blocked-path signaling for one-time repath handling
- Verification status (historical log):
  - Runtime/manual validation that the human collider now stops cleanly on thin-wall geometry and can stand between tile centers.

### Migration Phase F: Debug Overlay Migration

- Goal:
  - Make debug mode reflect real movement/collision truth.
- Files:
  - `apps/phaser/debug/humanDebugOverlay.js`
  - `apps/phaser/human/humanCommandController.js`
- Work:
  - Render collider shapes (not tile blocks).
  - Render sub-tile/nav cells and final world-space path.
  - Keep blackout mode and collider outline diagnostics.
- Exit criteria:
  - Debug visuals match runtime collision/path behavior exactly.

### Migration Phase G: Performance + Streaming Hardening

- Goal:
  - Ensure geometry/nav generation scales with chunk streaming.
- Files:
  - `engine/world/worldStore.js`
  - `apps/phaser/phaserRuntimeAdapter.js`
  - `apps/phaser/human/*.js`
- Work:
  - Cache collider/nav artifacts per chunk.
  - Add bounds-limited nav requests and graceful budget handling.
  - Stress test command spam and long-distance paths with streaming chunk churn.
- Exit criteria:
  - Stable frame pacing and deterministic behavior under normal and stress usage.

### Migration Phase H: Optional Navmesh Upgrade (Future)

- Goal:
  - Move from sub-tile grid to navmesh/graph if needed for better path quality or scale.
- Files:
  - `engine/world/nav/*` (new)
  - adapters/controllers consuming navigation interfaces
- Work:
  - Keep controller contracts stable and swap navigation backend via interfaces.
  - Preserve debug parity for path and obstacle diagnostics.
- Exit criteria:
  - Navigation backend can evolve without rewriting human input/controller flow.

### Phase Completion Rule

- A phase is only complete when:
  - code compiles/runs,
  - phase verification checks pass,
  - no earlier phase contracts are broken.

## Acceptance Criteria

- A human is visible after runtime boot.
- Left-click and drag-box selection both select the human.
- `Ctrl + Left Click` issues movement to target location.
- Human never passes through walls or blocked tiles.
- Human can traverse doors, corridors, room floors, and special spaces.
- No regressions to camera pan/zoom/streaming behavior.
- Runtime remains stable when commanding across chunk boundaries.
- Debug mode toggle works in runtime and is reversible with no refresh.
- In debug mode, blocked obstacles are clearly highlighted and non-debug visuals are darkened/black.
- In debug mode, current/last computed path and human collider boundary are visible.
- Human gameplay logic is split into focused modules (no single "god" controller).
- `phaserApp.js` acts as composition root rather than behavior-heavy implementation.
- Pathfinding remains framework-agnostic and testable without game runtime.

## Risks and Mitigations

- Risk: Pathfinding cost spikes for distant clicks.
  - Mitigation: bounded node budget, command-distance clamp, and capped directional nav-window expansion retries.
- Risk: Collision jitter at tile corners.
  - Mitigation: geometry collision sliding + arrival radius (no hard center snap) + capped speed.
- Risk: Input conflicts with existing pan controls.
  - Mitigation: keep WASD camera movement independent from pointer selection flow.
- Risk: Debug overlay draw cost affects frame time.
  - Mitigation: only render debug overlays when enabled and limit obstacle drawing to visible bounds.

## Out of Scope (This Plan)

- Zombies and combat.
- Multi-human squads or control groups.
- Final art/animation pipeline.
- Human needs/AI/autonomous behavior.
- Long-term debug tooling beyond first-human movement diagnostics.

## Plan Closeout

- First Human playable scope is accepted as complete (March 19, 2026).
- The implementation is now treated as baseline runtime functionality.
- Future navigation/runtime optimization work should continue under separate roadmap tracks, not by reopening this plan.

## Decision Log

- Locked on March 19, 2026:
  - Sprite: Option A (procedural Phaser placeholder).
  - Pathfinding (initial lock): Option A (4-dir A* + Manhattan heuristic); runtime final state is sub-tile bidirectional A* with boundary-aware directional expansion retries.
  - Rigid body (initial lock): Option A (Phaser Arcade Physics dynamic body + blocked-tile collision); runtime final state is geometry-based world-rect collision resolution.



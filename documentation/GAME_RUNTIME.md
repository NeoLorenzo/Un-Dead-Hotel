# Game Runtime

## Runtime Purpose

The default game runtime is Phaser-based:

- `index.html` -> `apps/phaser/phaserApp.js`

Debug runtime remains available:

- `debug.html` -> `main.js` -> `apps/debug/debugApp.js`

## Startup Sequence

1. Resolve runtime DOM elements.
2. Create runtime adapter (`createPhaserRuntimeAdapter`).
3. Create runtime debug controller (`createRuntimeDebugController`).
4. Create gameplay controllers for active runtime mode.
   - Current mode (`first_contact`, running the ganging-up slice + Finding Our Way Phase 1 locomotion standardization) composes:
   - `humanManager` (primary survivor + natural guests)
   - `humanController` (primary survivor convenience handle)
   - `humanSelectionController` (roster-based survivor selection set)
   - `humanCommandController` (selected-survivor group path commands)
   - `zombieManager`
   - `agentHpBarOverlay`
   - `gameOverOverlay`
   - `humanDebugOverlay`
   - `zombieDebugOverlay`
   - `firstContactDiagnosticsPanel`
5. Register pointer and keyboard handlers.
6. Create chunk renderer resources and `runtimeHud`.
7. Ensure `20x20` startup stream window.
8. Render first frame.

## Streaming Behavior

- Startup preload window: `20x20` chunks.
- On each render/update:
  - derive camera chunk coordinate,
  - ensure streaming window is loaded around camera chunk center (idempotent unless chunk center changes),
  - render visible viewport chunk set,
  - update runtime HUD metrics.

## Input Model

Keyboard/mouse controls in the runtime path follow the same policy.

Key mapping:

- WASD
- Backquote (`\``) toggles runtime-level debug mode in game runtime.

Zoom input:

- Mouse wheel

Movement updates camera tile position through `cameraController`.

Current runtime mode input policy (`first_contact`):

- Left click: survivor selection (single-click and drag-box).
- `Shift + Left Click`: survivor additive/toggle selection.
- `Ctrl + Left Click`: issue group move command for selected survivors.
- Zombie manual click-to-spawn is disabled in this mode (population comes from first-contact spawn policy).

## Render Model

Game runtime (`apps/phaser/phaserApp.js`) uses a chunk texture pipeline:

- computes visible chunk bounds from camera tile position,
- rebuilds chunk textures under a per-frame budget,
- reuses cached chunk textures between frames,
- draws tile classes and thin room wall overlays with Phaser.
- syncs active gameplay overlays after world chunk draw.

Zoom/render performance guardrails (implemented March 19, 2026):

- keeps visual zoom interpolation continuous (`tilePixels` remains smooth),
- uses chunk texture tile-pixel tiers to avoid rebuilding at every intermediate zoom value,
- keeps exact texture matching in the `5-20` tile-pixel range,
- uses coarser texture tiers above `20` tile pixels (`24, 28, 32, ... 60`),
- applies tier-switch hysteresis (small buffer before changing tiers) to prevent flip-flop rebuilds,
- applies short rebuild debounce while wheel zoom is actively changing.

These guardrails reduce high-zoom rebuild churn without changing configured zoom speed behavior.

When debug mode is enabled in game runtime:

- applies blackout overlay,
- highlights blocked collision geometry obstacles,
- draws zombie vision cones and heading vectors,
- draws zombie queued path diagnostics,
- draws zombie waypoint-selection candidate markers:
  - expanded-selected candidates,
  - fallback-selected candidates,
  - no-continuation candidates,
  - failed-sector candidates,
  - blocked candidates,
  - line-of-sight blocked candidates,
- draws wall-clipped cone ray samples,
- draws failed-sector memory arcs,
- draws active recovery indicator rings,
- draws zombie collider boundaries,
- shows first-contact text diagnostics:
  - survivor/guest counts and guest spawn-cycle counters,
  - guest perception and flee/wander cycle counters,
  - guest conversion totals/last-cycle events,
  - survivor command/path budget counters (assignment success, expansion attempts, path search stats),
  - human HP/death state,
  - zombie HP summary,
  - pursuit mode distribution and lock counts,
  - attack readiness and per-tick attack outcomes,
  - first-contact population recycle/spawn counters.

## Zombie AI Model (Phaser)

- `zombieManager` owns spawned zombie set and update/sync orchestration.
- `zombieController` owns per-zombie world movement state.
- In `first_contact`, startup population policy attempts to fill `100` zombies in a `10-100` tile ring around the first human.
- Zombies outside the `100`-tile perimeter from the nearest living human are despawned and replaced via ring spawn attempts.
- `zombieWanderPlanner` picks random in-cone waypoints with:
  - world walkability validation,
  - line-of-sight validation through world geometry.
- Candidate sampling uses wall-clipped cone rays so forward search is bounded by nearby geometry.
- Planner applies short-horizon waypoint expansion:
  - prefer waypoint `A` only when continuation `B` from `A` exists,
  - fallback to best single-step waypoint when continuation fails within attempt budget.
- Manager tracks failed angular sectors with short TTL memory and excludes them during sampling.
- Manager applies bounded recovery heading rotation after repeated no-candidate streaks.
- Movement execution is path-array based on shared `0.25`-grid rasterization (no zombie A* in this slice).
- When waypoint is reached/cleared or blocked, manager triggers immediate repick.
- Nearby zombies apply soft separation nudges to avoid persistent overlap.
- Pursuit state machine:
  - acquire nearest human when inside cone + line-of-sight,
  - lock on and chase human-anchored raster path targets,
  - on LOS loss move to last-known rasterized target then resume wander.
- Attack state:
  - touch-range attack for `20` damage per hit,
  - `1.0s` cooldown per zombie,
  - cooldown progress exposed for UI/debug.
- Locomotion execution contract:
  - zombie wander and pursuit both execute queued path arrays on the shared `0.25` grid,
  - path arrays are built through shared line rasterization (no zombie A* in this slice),
  - blocked traversal trims to walkable prefix and repicks after segment completion.

## Human Roster/Role Model (Phaser)

- `humanManager` owns all humans and their runtime role state.
- First spawned human is `survivor` (player-controllable).
- Natural spawns are `guest` (AI-controlled).
- Guest population target is static and derived from zombie target count (`1:10` ratio).
- Guest spawn/recycle rings anchor to all living survivors.
- Guests use zombie-style cone/LOS perception and wander/flee behavior with rasterized `0.25`-grid path execution.
- Survivor touching a guest converts that guest into a survivor.
- Survivors are player-controlled only (no autonomous flee).
- Nearby survivors apply soft separation nudges to avoid persistent overlap.

## Human Path Command Model (Phaser)

- Command controller reads selected survivors from selection controller state.
- Group commands claim unique quarter-tile destination cells around the click target.
- Each selected survivor receives an individual path assignment toward its claimed destination.
- Command controller resolves nearest navigable world goal from pointer target.
- Runtime adapter builds an obstacle-inflated sub-tile navigation grid around command bounds.
- Pathfinding uses engine `subTilePathfinder` bidirectional A* with heap-based frontiers.
- Sub-tile pathfinding supports 8-direction expansion (cardinal + diagonal).
- Diagonal expansion enforces corner-safety (no corner cutting through blocked geometry).
- Pathfinder search stats expose boundary-touch and likely-clipped-domain signals for command retries.
- Command controller retries with configured expansion factors, then boundary-aware directional nav-window growth when clipped.
- Current scene tuning uses bounded caps for performance (`maxPathNodes=32000`, `maxDynamicExpansionAttempts=7`, `maxAutoPaddingTiles=1536`).
- Human controller follows resulting world-space waypoints and uses geometry collision resolution in motion updates.

## Debug Controller Model

- Runtime debug ownership is centralized in `runtimeDebugController`.
- Debug renderers register with runtime controller (human/zombie overlays and first-contact diagnostics panel).
- Toggle state is no longer owned by any individual gameplay controller.

## HUD Model

`runtimeHud.render(...)` reports:

- seed,
- loaded chunk count,
- active stream window size,
- loaded bounds and span,
- viewport chunk draw count,
- current camera chunk coordinate.

Game runtime appends extra renderer diagnostics (pending chunk textures and Phaser version) after the shared HUD content.

Runtime debug visualization is separate from HUD text and rendered in dedicated overlay layers. In first-contact mode, world-space HP/cooldown bars are always visible and game-over overlay appears on all-human extinction while simulation continues.

## Performance Notes

Current design favors simplicity and deterministic correctness over advanced optimization. Potential future optimizations include:

- additional adaptive chunk texture prewarm for likely next tiers,
- optional worker-thread chunk rasterization when browser support allows,
- draw culling and dirty-rect redraw,
- chunk mesh caching,
- asynchronous/background chunk generation,
- worker-thread offloading for generation.

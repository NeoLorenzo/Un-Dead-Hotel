# Game Architecture

## Architecture Goals

The current architecture is organized around strict separation of concerns:

- generation logic in engine modules,
- runtime orchestration in app entry modules,
- multiple runtime frontends (Phaser default and debug fallback) as separate consumers of shared generation systems.

## Runtime Entrypoints

### Default Runtime (Phaser)

- Entry chain: `index.html` -> `apps/phaser/phaserApp.js`
- Purpose:
  - run streamed world rendering with Phaser,
  - provide smooth camera/input controls,
  - use engine systems through the Phaser adapter boundary.

### Debug Fallback Runtime

- Entry chain: `debug.html` -> `main.js` -> `apps/debug/debugApp.js`
- Purpose:
  - inspect and validate generation behavior,
  - render 6x6 and 20x20 debug views,
  - expose generation diagnostics.

## Module Topology

### Generation Layer

- `engine/generation/chunkGenerator.js`
- Responsibilities:
  - deterministic chunk assignment + connectivity enforcement,
  - special-space placement,
  - access-corridor placement,
  - room placement + growth + dooring,
  - chunk validator and generation metrics.

### Runtime World Layer

- `engine/world/worldStore.js`
- Responsibilities:
  - assignment cache,
  - chunk cache,
  - demand-driven chunk generation,
  - preload window generation,
  - loaded-bounds accounting.

- `engine/world/cameraController.js`
- Responsibilities:
  - camera tile-space state,
  - chunk-space derivation,
  - movement helpers.

- `engine/world/runtimeHud.js`
- Responsibilities:
  - runtime status/meta formatting and rendering.

### App Layer

- `apps/debug/debugApp.js`
  - debug-specific rendering and diagnostics UI.

### Phaser Runtime Modules (Current)

- `apps/phaser/phaserApp.js`
  - Phaser scene runtime composition/orchestration root.
- `apps/phaser/phaserRuntimeAdapter.js`
  - adapter boundary for world tile query, collision geometry, and navigation-grid access.
- `apps/phaser/debug/runtimeDebugController.js`
  - runtime-level debug toggle ownership and renderer orchestration.
- `engine/world/aStarPathfinder.js`
  - framework-agnostic tile-grid A* utility retained for legacy/debug usage.
- `engine/world/subTilePathfinder.js`
  - framework-agnostic sub-tile bidirectional A* pathfinding utility (heap-based frontier).
- `apps/phaser/human/humanController.js`
  - human state, movement, collider integration, and selection state (inactive in current runtime mode).
- `apps/phaser/human/humanSelectionController.js`
  - click and drag-box selection input handling (inactive in current runtime mode).
- `apps/phaser/human/humanCommandController.js`
  - `Ctrl + Left Click` world-space move command orchestration with boundary-aware directional nav-window expansion retries (inactive in current runtime mode).
- `apps/phaser/debug/humanDebugOverlay.js`
  - human debug renderer (inactive in current runtime mode).
- `apps/phaser/zombie/zombieManager.js`
  - zombie spawn, update orchestration, separation pass, failed-sector memory/recovery steering, and debug-state aggregation.
- `apps/phaser/zombie/zombieController.js`
  - per-zombie motion state and collision-aware direct steering to waypoint.
- `apps/phaser/zombie/zombieWanderPlanner.js`
  - wall-clipped in-cone waypoint sampling with blocked-sector filtering and short-horizon continuation expansion (`A -> B`) fallback policy.
- `apps/phaser/debug/zombieDebugOverlay.js`
  - zombie debug renderer for cones, clipped rays, path segments, waypoint candidate diagnostics, failed-sector arcs, recovery indicator, and colliders.

Dependency direction for this slice:

1. `phaserApp.js` composes controller modules.
2. Runtime debug controller composes debug renderer modules.
3. Controllers depend on adapter/pathfinder interfaces.
4. Adapter owns concrete world-store access.
5. Engine pathfinder remains Phaser-independent.
6. Debug renderers consume controller debug state and adapter tile iteration only.

## Data Flow (Game Runtime)

1. Runtime app (`apps/phaser/phaserApp.js`) builds runtime modules.
2. Phaser path composes adapter + active gameplay modules + runtime debug controller through explicit interfaces.
3. Camera chunk coordinate is computed from camera tile position.
4. `worldStore.ensureWindow(...)` guarantees a loaded generation window around camera chunk.
5. Renderer requests visible chunks via `ensureChunk(...)` callback.
6. Current runtime mode (`zombie_wander`) routes left-click spawn to zombie manager and runs in-cone waypoint wandering.
7. `runtimeHud.render(...)` presents runtime state metrics.

## Why This Is "Proper" Relative To Previous State

Compared with the previous monolithic debug-driven approach, the architecture now:

- avoids generation logic in top-level UI entry files,
- allows debug/runtime frontends to evolve independently,
- provides module boundaries suitable for future testing and replacement,
- supports incremental extension of world/runtime systems without reworking generator internals.

## Extension Strategy

Recommended next extension pattern:

1. Add new behavior in `engine/world/*` or `engine/generation/*` modules.
2. Expose minimal, explicit APIs.
3. Keep `apps/phaser/phaserApp.js` as the runtime composition root.
4. Keep gameplay behavior in focused controllers (`apps/phaser/human/*`, `apps/phaser/zombie/*`, `apps/phaser/debug/*`).
5. Keep debug logic isolated from core movement/pathfinding modules.

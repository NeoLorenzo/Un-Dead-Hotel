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
  - framework-agnostic sub-tile bidirectional A* pathfinding utility (heap-based frontier) with 8-direction expansion and corner-safe diagonal rules.
- `engine/world/lineTileRasterizer.js`
  - framework-agnostic 0.25-grid line raster utility for wander/pursuit/flee path arrays, occupancy-aware blocking checks, and blocked-prefix trimming.
- `apps/phaser/human/humanController.js`
  - per-human state, movement/collider integration, role metadata (`survivor`/`guest`), selection hooks, and HP/death state.
- `apps/phaser/human/humanManager.js`
  - human roster orchestration, natural guest spawn/recycle, guest perception/behavior loops, rasterized guest wander/flee locomotion dispatch, survivor-touch conversion, and survivor soft separation.
- `apps/phaser/human/humanPerception.js`
  - reusable human cone + line-of-sight perception evaluation used by guest behavior.
- `apps/phaser/human/humanSelectionController.js`
  - roster-based survivor selection handling (`Shift + Left Click` toggle and drag-box multi-select).
- `apps/phaser/human/humanCommandController.js`
  - selected-survivor group move orchestration (`Ctrl + Left Click`) with unique destination claims, 8-direction sub-tile pathing, and boundary-aware directional nav-window expansion retries.
- `apps/phaser/debug/humanDebugOverlay.js`
  - human/guest debug renderer (path, colliders, guest vision cone/rays, detection lock, and guest wander recovery diagnostics).
- `apps/phaser/combat/healthModel.js`
  - framework-agnostic HP model and death/revive hooks shared by humans and zombies.
- `apps/phaser/combat/zombieAttackResolver.js`
  - framework-agnostic zombie touch-attack resolver and cooldown timing.
- `apps/phaser/zombie/zombieManager.js`
  - zombie spawn/update orchestration, first-contact ring population maintenance, rasterized wander/pursuit path dispatch, pursuit/attack state orchestration, separation pass, failed-sector memory/recovery steering, and debug-state aggregation.
- `apps/phaser/zombie/zombieController.js`
  - per-zombie motion, HP state, and collision-aware path-array traversal (`setPath`/`setWorldPath`) on shared `0.25` grid nodes.
- `apps/phaser/zombie/zombieWanderPlanner.js`
  - wall-clipped in-cone waypoint sampling with blocked-sector filtering and short-horizon continuation expansion (`A -> B`) fallback policy.
- `apps/phaser/debug/zombieDebugOverlay.js`
  - zombie debug renderer for cones, clipped rays, path segments, waypoint candidate diagnostics, failed-sector arcs, recovery indicator, and colliders.
- `apps/phaser/debug/firstContactDiagnosticsPanel.js`
  - text diagnostics panel for first-contact survivor/guest/zombie state, guest behavior/conversion cycles, and path budget telemetry.
- `apps/phaser/ui/agentHpBarOverlay.js`
  - world-space HP bars for humans and zombies plus zombie cooldown bar.
- `apps/phaser/ui/gameOverOverlay.js`
  - game-over overlay UI for all-human extinction.

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
6. Current runtime mode (`first_contact`, ganging-up slice + Finding Our Way Phase 1 locomotion standardization) composes humans + zombies together:
   - human roster manager (survivor + guests),
   - survivor multi-select and group command loop,
   - guest spawn/perception/wander/flee/conversion behavior loops with `0.25`-grid rasterized locomotion execution,
   - startup zombie ring spawn and perimeter recycle policy,
   - pursuit and touch-attack loop with cooldown, with zombie pursuit movement executed through `0.25`-grid rasterized path arrays,
   - always-visible HP bars and extinction-based game-over overlay.
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

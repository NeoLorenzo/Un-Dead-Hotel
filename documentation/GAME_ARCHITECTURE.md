# Game Architecture

## Architecture Goals

The current architecture is organized around strict separation of concerns:

- generation logic in engine modules,
- runtime orchestration in app entry modules,
- debug and game runtime as separate consumers of shared generation systems.

## Runtime Entrypoints

### Debug Runtime

- Entry chain: `index.html` -> `main.js` -> `apps/debug/debugApp.js`
- Purpose:
  - inspect and validate generation behavior,
  - render 6x6 and 20x20 debug views,
  - expose generation diagnostics.

### Game Runtime

- Entry chain: `game.html` -> `apps/game/gameApp.js`
- Purpose:
  - run streamed world rendering,
  - preload 20x20 startup window,
  - generate additional chunks on demand as camera moves.

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

- `engine/world/worldSurface.js`
- Responsibilities:
  - canvas sizing,
  - viewport chunk bounds calculation,
  - chunk tile rendering,
  - thin room wall overlays.

- `engine/world/cameraController.js`
- Responsibilities:
  - camera tile-space state,
  - chunk-space derivation,
  - movement helpers,
  - key-to-movement mapping support.

- `engine/world/inputController.js`
- Responsibilities:
  - keyboard listener lifecycle,
  - movement callback dispatch from input.

- `engine/world/runtimeHud.js`
- Responsibilities:
  - runtime status/meta formatting and rendering.

### App Layer

- `apps/debug/debugApp.js`
  - debug-specific rendering and diagnostics UI.
- `apps/game/gameApp.js`
  - composition root for game runtime modules.

## Data Flow (Game Runtime)

1. `gameApp` builds runtime modules (`worldStore`, `worldSurface`, `cameraController`, `inputController`, `runtimeHud`).
2. Camera chunk coordinate is computed from camera tile position.
3. `worldStore.ensureWindow(...)` guarantees a loaded generation window around camera chunk.
4. `worldSurface.render(...)` requests visible chunks via `ensureChunk(...)` callback.
5. `runtimeHud.render(...)` presents runtime state metrics.

## Why This Is "Proper" Relative To Previous State

Compared with the previous monolithic debug-driven approach, the architecture now:

- avoids generation logic in top-level UI entry files,
- allows debug/game runtimes to evolve independently,
- provides module boundaries suitable for future testing and replacement,
- supports incremental extension of world/runtime systems without reworking generator internals.

## Extension Strategy

Recommended next extension pattern:

1. Add new behavior in `engine/world/*` or `engine/generation/*` modules.
2. Expose minimal, explicit APIs.
3. Keep `apps/game/gameApp.js` as composition only.
4. Keep debug logic isolated in `apps/debug/debugApp.js`.

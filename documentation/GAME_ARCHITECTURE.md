# Game Architecture

## Architecture Goals

The current architecture is organized around strict separation of concerns:

- generation logic in engine modules,
- runtime orchestration in app entry modules,
- multiple runtime frontends (Phaser default, canvas fallback, debug fallback) as separate consumers of shared generation systems.

## Runtime Entrypoints

### Default Runtime (Phaser)

- Entry chain: `index.html` -> `apps/phaser/phaserApp.js`
- Purpose:
  - run streamed world rendering with Phaser,
  - provide smooth camera/input controls,
  - use engine systems through the Phaser adapter boundary.

### Canvas Fallback Runtime

- Entry chain: `game.html` -> `apps/game/gameApp.js`
- Purpose:
  - run streamed world rendering,
  - preload 20x20 startup window,
  - generate additional chunks on demand as camera moves.

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

1. Runtime app (`apps/phaser/phaserApp.js` or `apps/game/gameApp.js`) builds runtime modules (`worldStore`, renderer, `cameraController`, input, `runtimeHud`).
2. Camera chunk coordinate is computed from camera tile position.
3. `worldStore.ensureWindow(...)` guarantees a loaded generation window around camera chunk.
4. Renderer requests visible chunks via `ensureChunk(...)` callback.
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

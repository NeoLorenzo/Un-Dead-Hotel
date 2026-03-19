# Game Runtime

## Runtime Purpose

The default game runtime is Phaser-based:

- `index.html` -> `apps/phaser/phaserApp.js`

Debug runtime remains available:

- `debug.html` -> `main.js` -> `apps/debug/debugApp.js`

## Startup Sequence

1. Resolve runtime DOM elements.
2. Create runtime adapter (`createPhaserRuntimeAdapter`).
3. Create gameplay controllers:
   - `humanController`
   - `humanSelectionController`
   - `humanCommandController`
   - `humanDebugOverlay`
4. Register pointer and keyboard handlers.
5. Create chunk renderer resources and `runtimeHud`.
6. Ensure `20x20` startup stream window.
7. Render first frame.

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
- Backquote (`\``) toggles human debug overlay mode in game runtime.

Zoom input:

- Mouse wheel

Movement updates camera tile position through `cameraController`.

Human input policy in game runtime:

- Left click: single-select human.
- Left click + drag: box-select human.
- `Ctrl + Left Click`: issue world-space move command for selected human.

## Render Model

Game runtime (`apps/phaser/phaserApp.js`) uses a chunk texture pipeline:

- computes visible chunk bounds from camera tile position,
- rebuilds chunk textures under a per-frame budget,
- reuses cached chunk textures between frames,
- draws tile classes and thin room wall overlays with Phaser.
- syncs human/controller overlays after world chunk draw.

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
- draws path/visited-node diagnostics,
- draws human collider boundary.

## Human Path Command Model (Phaser)

- Command controller resolves nearest navigable world goal from pointer target.
- Runtime adapter builds an obstacle-inflated sub-tile navigation grid around command bounds.
- Pathfinding uses engine `subTilePathfinder` bidirectional A* with heap-based frontiers.
- Pathfinder search stats expose boundary-touch and likely-clipped-domain signals for command retries.
- Command controller retries with configured expansion factors, then boundary-aware directional nav-window growth when clipped.
- Current scene tuning uses bounded caps for performance (`maxPathNodes=32000`, `maxDynamicExpansionAttempts=7`, `maxAutoPaddingTiles=1536`).
- Human controller follows resulting world-space waypoints and uses geometry collision resolution in motion updates.

## HUD Model

`runtimeHud.render(...)` reports:

- seed,
- loaded chunk count,
- active stream window size,
- loaded bounds and span,
- viewport chunk draw count,
- current camera chunk coordinate.

Game runtime appends extra renderer diagnostics (pending chunk textures and Phaser version) after the shared HUD content.

Human debug visualization is separate from HUD text and rendered in dedicated overlay layers.

## Performance Notes

Current design favors simplicity and deterministic correctness over advanced optimization. Potential future optimizations include:

- additional adaptive chunk texture prewarm for likely next tiers,
- optional worker-thread chunk rasterization when browser support allows,
- draw culling and dirty-rect redraw,
- chunk mesh caching,
- asynchronous/background chunk generation,
- worker-thread offloading for generation.

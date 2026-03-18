# Game Runtime

## Runtime Purpose

The default runtime is Phaser:

- `index.html` -> `apps/phaser/phaserApp.js`

Fallback runtimes remain available:

- `game.html` -> `apps/game/gameApp.js` (canvas fallback)
- `debug.html` -> `main.js` -> `apps/debug/debugApp.js` (debug fallback)

Both Phaser and canvas runtimes compose world systems without implementing chunk generation internals directly.

## Startup Sequence

1. Resolve runtime DOM elements.
2. Create `worldStore`.
3. Create camera and input controllers.
4. Create renderer (`worldSurface` for canvas or Phaser scene renderer).
5. Create `runtimeHud`.
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

Keyboard/mouse controls in both runtime paths follow the same policy.

Key mapping:

- WASD

Zoom input:

- Mouse wheel

Movement updates camera tile position through `cameraController`.

## Render Model

Canvas fallback (`apps/game/gameApp.js`) uses `worldSurface.render(...)`:

- clears canvas,
- computes viewport chunk bounds from camera tile position,
- fetches/generates visible chunks through callback,
- draws tile colors by semantic class,
- overlays thin room walls.

Phaser default (`apps/phaser/phaserApp.js`) uses a chunk texture pipeline:

- computes visible chunk bounds from camera tile position,
- rebuilds chunk textures under a per-frame budget,
- reuses cached chunk textures between frames,
- draws tile classes and thin room wall overlays with Phaser.

## HUD Model

`runtimeHud.render(...)` reports:

- seed,
- loaded chunk count,
- active stream window size,
- loaded bounds and span,
- viewport chunk draw count,
- current camera chunk coordinate.

Phaser runtime appends extra renderer diagnostics (pending chunk textures and Phaser version) after the shared HUD content.

## Performance Notes

Current design favors simplicity and deterministic correctness over advanced optimization. Potential future optimizations include:

- draw culling and dirty-rect redraw,
- chunk mesh caching,
- asynchronous/background chunk generation,
- worker-thread offloading for generation.

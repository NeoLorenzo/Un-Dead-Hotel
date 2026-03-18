# Game Runtime

## Runtime Purpose

`apps/game/gameApp.js` composes world systems and runs a playable world-streaming prototype.

It does not implement chunk generation internals directly.

## Startup Sequence

1. Resolve DOM elements (`#game-canvas`, `#game-meta`).
2. Create `worldStore`.
3. Create `worldSurface` with rendering config.
4. Create `cameraController`.
5. Create `inputController` for keyboard panning.
6. Create `runtimeHud`.
7. Resize canvas.
8. Preload `20x20` chunk window around origin.
9. Render first frame.

## Streaming Behavior

- Startup preload window: `20x20` chunks.
- On each render:
  - derive camera chunk coordinate,
  - ensure streaming window is loaded around camera,
  - render visible viewport chunk set,
  - update runtime HUD metrics.

## Input Model

Keyboard input is managed by `engine/world/inputController.js`.

Key mapping:

- Arrow keys
- WASD

Each key event maps to a tile-step movement vector and moves camera state via `cameraController`.

## Render Model

`worldSurface.render(...)`:

- clears canvas,
- computes viewport chunk bounds from camera tile position,
- fetches/generates visible chunks through callback,
- draws tile colors by semantic class,
- overlays thin room walls.

## HUD Model

`runtimeHud.render(...)` reports:

- seed,
- loaded chunk count,
- active stream window size,
- loaded bounds and span,
- viewport chunk draw count,
- current camera chunk coordinate.

## Performance Notes

Current design favors simplicity and deterministic correctness over advanced optimization. Potential future optimizations include:

- draw culling and dirty-rect redraw,
- chunk mesh caching,
- asynchronous/background chunk generation,
- worker-thread offloading for generation.

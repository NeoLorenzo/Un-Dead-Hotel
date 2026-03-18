# Documentation Index

This folder contains the source of truth for Un-Dead Hotel documentation.

## Documents

- `GAME_OVERVIEW.md`
  - Project concept, current status, and gameplay roadmap.
- `GAME_ARCHITECTURE.md`
  - Runtime architecture, module boundaries, and system responsibilities.
- `PROCEDURAL_GENERATION.md`
  - Full chunk generation pipeline, invariants, and tile semantics.
- `GAME_RUNTIME.md`
  - Game runtime flow (boot, streaming, camera, render, input, HUD).
- `MODULE_API_REFERENCE.md`
  - Practical API contracts for generation/world/app modules.

## Current Runtime Entrypoints

- Debug runtime: `index.html` -> `main.js` -> `apps/debug/debugApp.js`
- Game runtime: `game.html` -> `apps/game/gameApp.js`

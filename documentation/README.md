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
- `ENGINE_RUNTIME_CONTRACTS.md`
  - Frozen runtime-facing contract boundary for Phaser-first migration Phase 1.
- `PHASER_FIRST_IMPLEMENTATION_PLAN.md`
  - End-to-end Phaser-first migration phases and completion tracking.
- `PHASER_ADAPTER_API.md`
  - Phase 3 adapter contract between Phaser scene runtime and engine systems.

## Current Runtime Entrypoints

- Default runtime: `index.html` -> `apps/phaser/phaserApp.js`
- Canvas fallback runtime: `game.html` -> `apps/game/gameApp.js`
- Debug fallback runtime: `debug.html` -> `main.js` -> `apps/debug/debugApp.js`

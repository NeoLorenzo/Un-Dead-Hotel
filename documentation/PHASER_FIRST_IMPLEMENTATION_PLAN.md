# Phaser-First Implementation Plan

## Goal

Migrate the runtime to Phaser while keeping existing game generation and world logic intact.

This is a **parallel migration**: build the Phaser runtime next to the current canvas runtime, reach parity, then switch defaults.

## Core Principles

- Keep `engine/` framework-agnostic.
- Move rendering/input/runtime wiring to Phaser.
- Do not rewrite procedural generation first.
- Ship in small phases with acceptance checks.

## Scope and Constraints

- Platform remains web-based.
- Development remains code-first (no GUI editor workflow).
- Existing logic modules stay as source of truth:
  - `engine/world/worldStore.js`
  - `engine/generation/chunkGenerator.js`

## Target Architecture

- `engine/`: pure gameplay and world systems (unchanged ownership).
- `apps/phaser/`: Phaser runtime entry, scenes, rendering adapters, input adapters.
- `documentation/`: migration and runtime behavior updates.

## Phase Plan

### Phase 1 - Freeze Engine Contracts

Define and lock the runtime-facing interfaces before migrating rendering.

Deliverables:

- Document runtime-facing APIs for:
  - chunk access/loading
  - camera position/state
  - HUD metric inputs
- Confirm no Phaser-specific code enters `engine/`.

Acceptance criteria:

- Existing canvas runtime still works unchanged.
- Engine modules can be consumed by both runtimes.

### Phase 2 - Scaffold Phaser Runtime

Create a new runtime entrypoint without replacing the current one.

Deliverables:

- New Phaser app shell under `apps/phaser/`.
- New page entry (or route) for Phaser runtime.
- Base scene bootstraps and runs.

Acceptance criteria:

- Phaser runtime loads independently.
- Current runtime remains available for comparison.

### Phase 3 - Adapter Layer

Add a small adapter layer between Phaser scene code and world engine.

Deliverables:

- Runtime adapter functions (example responsibilities):
  - derive visible chunk range from camera
  - request/ensure chunks via `worldStore`
  - expose chunk tile data to render layer
- No generator logic duplicated inside Phaser scene.

Acceptance criteria:

- Phaser scene can request and receive deterministic chunk data.

### Phase 4 - Camera and Input Baseline

Recreate essential runtime controls first.

Deliverables:

- WASD movement in Phaser.
- Mouse wheel zoom in Phaser.
- Camera behavior mapped to tile-space world coordinates.

Acceptance criteria:

- Movement and zoom are smooth.
- Control scheme matches intended runtime controls.

### Phase 5 - Chunk Rendering Path

Implement Phaser-native rendering for streamed chunks.

Deliverables:

- Chunk draw pipeline in Phaser (batched and camera-driven).
- Render colors/tile classes equivalent to current runtime.
- Room wall overlays represented in Phaser renderer.

Acceptance criteria:

- No tile seams at normal usage levels.
- Zoom and pan performance is better than current canvas runtime in common scenarios.

### Phase 6 - Streaming + HUD Parity

Match current runtime behavior and telemetry.

Deliverables:

- Streaming window behavior equivalent to current runtime.
- Runtime HUD metrics mirrored (loaded chunk count, bounds, camera chunk, viewport chunk count, zoom).

Acceptance criteria:

- Phaser runtime matches current runtime outputs for the same camera positions.

### Phase 7 - Default Runtime Switch

Promote Phaser runtime to primary entry after parity validation.

Deliverables:

- Update default app entry to Phaser runtime.
- Keep old runtime temporarily as fallback.
- Update docs (`GAME_RUNTIME.md`, `GAME_ARCHITECTURE.md`, `README.md`).

Acceptance criteria:

- Phaser runtime is the default and stable.
- Regression checklist passes.

## Regression Checklist

- Deterministic chunk generation output unchanged.
- Camera tile/chunk math remains correct.
- Streaming window loads expected bounds.
- HUD values are accurate.
- Input behavior matches design.
- No visual artifacts during normal zoom/pan.

## Risks and Mitigations

- Risk: Phaser scene starts owning gameplay logic.
  - Mitigation: keep adapter boundary strict; engine remains source of truth.
- Risk: migration stalls due to big-bang rewrite.
  - Mitigation: phase-based parity approach with side-by-side runtimes.
- Risk: visual mismatch between runtimes.
  - Mitigation: compare against current runtime with shared camera test points.

## Execution Order

1. Phase 1 (contracts)
2. Phase 2 (Phaser scaffold)
3. Phase 3 (adapters)
4. Phase 4 (camera/input)
5. Phase 5 (rendering)
6. Phase 6 (streaming/HUD parity)
7. Phase 7 (default switch)

## Definition of Done

Phaser runtime is default, engine logic remains framework-agnostic, parity checks pass, and docs are updated to describe Phaser-first runtime architecture.

## Phase Status

- Phase 1: completed on March 18, 2026
- Phase 2: completed on March 18, 2026 (parallel runtime entry + bootable Phaser scene)
- Phase 3: completed on March 18, 2026 (adapter boundary finalized in `apps/phaser/phaserRuntimeAdapter.js` with documented contract in `documentation/PHASER_ADAPTER_API.md`)
- Phase 4: completed on March 18, 2026 (Phaser controls baseline: smooth WASD pan + wheel zoom with tile-space camera behavior)
- Phase 5: completed on March 18, 2026 (camera-driven chunk texture pipeline with tile-class color parity and room thin-wall overlays)
- Phase 6: completed on March 18, 2026 (stream window refresh parity with canvas runtime + mirrored HUD metrics via shared runtime HUD contract)
- Phase 7: completed on March 18, 2026 (default entry switched to Phaser runtime, canvas/debug kept as fallback routes, docs updated)

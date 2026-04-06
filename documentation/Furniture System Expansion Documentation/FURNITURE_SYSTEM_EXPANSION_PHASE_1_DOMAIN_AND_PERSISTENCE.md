# Furniture System Expansion - Phase 1: Domain Foundations (Draft)

## Purpose

Define and implement the foundational furniture data model and runtime state ownership.

## Status

- Draft created on **April 4, 2026**.
- Depends on scope lock in `FURNITURE_SYSTEM_EXPANSION_IMPLEMENTATION_PLAN.md`.
- Subphase progress:
  - `1A` Domain Contract Lock: **Complete** (catalog + state-store contract files exist).
  - `1B` Generation Descriptor Emission: **Complete** (deterministic descriptor emission + Procedural Gen Debug visibility + runtime handoff wiring active).
  - `1C` Runtime Hydration and Occupancy Baseline: **Complete** (runtime furniture hydration + occupancy indexing baseline wired into active runtime boot/render flow).
  - `1D` Simulation Clock and HUD Surface: **Complete** (deterministic simulation clock advances during active runtime and renders top-right `Day N` + time-of-day display with no lighting changes).
  - `1E` Baseline Diagnostics and Contract Sync: **Complete** (runtime chunk rendering includes furniture footprints, diagnostics expose furniture identity + occupancy baseline, and Procedural Gen Debug catalog/descriptor surfaces stay contract-synced).
  - `1F` Procedural Realism Placement Pass: **Pending**.

## Scope (Locked For Phase 1)

- Create furniture catalog/type contract model.
- Create runtime furniture state store with stable object IDs.
- Compose furniture subsystem into active runtime boot path.
- Define deterministic simulation day index contract for restock-dependent systems.
- Implement deterministic simulation time-of-day progression and day incrementing.
- Add top-right digital clock HUD showing:
  - day label (`Day 1`, `Day 2`, ...),
  - time of day.
- Add deterministic furniture hydration from generation outputs.
- Add tile occupancy indexing for furniture placement.
- Add baseline debug visibility for furniture ID and occupancy state.
- Add Procedural Gen Debug screen visibility for furniture:
  - furniture catalog preview alongside existing room/corridor previews,
  - generated furniture descriptor visibility on previewed chunks.
- Define and enforce baseline procedural realism constraints for generated furniture placement.

## Non-Goals (Locked For Phase 1)

- No movement legality validator yet.
- No survivor interaction pipeline yet.
- No pathing cost integration yet.
- No sink/mini-bar runtime behavior yet.
- No tactical metadata gameplay behavior yet.
- No lighting tint/shadow or visual scene changes from day-night progression.
- No week/month/day-name calendar system.

## Core Behavior Requirements (Locked)

1. Every furniture object has a stable unique ID.
2. Furniture state includes type, position, orientation, and profile metadata.
3. Runtime must maintain authoritative `furnitureById` + tile occupancy index.
4. Generated chunks hydrate deterministic furniture objects into runtime state.
5. Deterministic simulation day index is available for later restock logic.
6. Runtime HUD displays top-right digital clock with day label + time of day.
7. Procedural Gen Debug screen displays furniture catalog entries and generated furniture visibility.
8. Runtime furniture and clock contracts remain deterministic for equal input state.
9. Furniture placement generation is deterministic and procedurally realistic for identical seed/chunk inputs.

## File-Level Plan

1. `apps/phaser/phaserApp.js`
2. `engine/world/runtimeHud.js`
3. `apps/phaser/debug/humanDebugOverlay.js`
4. `apps/phaser/debug/firstContactDiagnosticsPanel.js`
5. `apps/debug/debugApp.js`
6. `engine/procgen.js`
7. `engine/generation/chunkGenerator.js`
8. `apps/phaser/furniture/furnitureCatalog.js` (new)
9. `apps/phaser/furniture/furnitureStateStore.js` (new)

## Verification

1. Furniture objects can be created and queried deterministically.
2. Generated chunks create deterministic furniture objects at consistent coordinates.
3. Occupancy index matches furniture placements after create/delete/move-state simulation.
4. Deterministic day index progresses from simulation time (not wall-clock time).
5. Top-right clock displays `Day N` + time-of-day with deterministic progression.
6. Procedural Gen Debug screen shows furniture catalog and generated furniture visibility for previewed chunks.
7. Runtime diagnostics expose stable furniture identity and occupancy state during active simulation.
8. Furniture descriptor sets satisfy Phase 1 realism constraints while remaining deterministic by seed/chunk.

## Exit Criteria

- Furniture domain model and runtime contracts are stable and ready for Phase 2.
- Runtime composition and generation hydration baseline are stable.
- Runtime clock/HUD baseline is stable with no visual day-night lighting changes.
- Furniture placement realism baseline is stable and ready for Phase 2.

## Subphase Breakdown (Locked)

### Phase 1A: Domain Contract Lock

- Goal:
  - Freeze furniture schema and runtime ownership contracts.
- Scope:
  - Define furniture catalog shape and required fields.
  - Define runtime object identity (`furnitureId`) rules.
  - Define simulation clock/day model contract (`Day N` + time-of-day only).
- Files:
  - `apps/phaser/furniture/furnitureCatalog.js` (new)
  - `apps/phaser/furniture/furnitureStateStore.js` (new)
- Verification:
  - Schema checklist complete and deterministic ID rules documented.
- Exit criteria:
  - Catalog/store contracts are implementation-ready.

### Phase 1B: Generation Descriptor Emission

- Goal:
  - Produce deterministic furniture descriptors from room/chunk generation.
- Scope:
  - Emit furniture descriptor payloads from generation outputs.
  - Keep descriptor emission deterministic by seed + chunk coordinates.
  - Surface emitted descriptors in Procedural Gen Debug chunk preview.
- Files:
  - `engine/generation/chunkGenerator.js`
  - `apps/debug/debugApp.js`
  - `apps/phaser/phaserRuntimeAdapter.js`
- Verification:
  - Repeated generation with same seed/chunk yields identical descriptor sets.
  - Procedural Gen Debug preview shows consistent furniture descriptor placement for identical seed/chunk inputs.
- Exit criteria:
  - Descriptor emission is deterministic, debug-visible, and consumable by runtime.

### Phase 1C: Runtime Hydration and Occupancy Baseline

- Goal:
  - Hydrate descriptors into runtime furniture objects and occupancy indexes.
- Scope:
  - Convert descriptors into furniture entities with stable IDs.
  - Populate `furnitureById` and tile occupancy index.
  - Compose furniture systems into active runtime.
- Files:
  - `apps/phaser/phaserApp.js`
  - `apps/phaser/furniture/furnitureStateStore.js` (new)
- Verification:
  - Generated chunks spawn consistent furniture objects in runtime.
  - Occupancy index matches hydrated placements.
- Exit criteria:
  - Runtime furniture population baseline is stable.

### Phase 1D: Simulation Clock and HUD Surface

- Goal:
  - Ship deterministic clock logic and player-facing top-right display.
- Scope:
  - Implement deterministic simulation day/time progression.
  - Render top-right HUD clock (`Day N` + time-of-day).
  - Enforce no lighting/visual day-night scene changes.
- Files:
  - `engine/world/runtimeHud.js`
  - `apps/phaser/phaserApp.js`
- Verification:
  - Clock advances deterministically and displays expected `Day N` format.
  - No visual scene lighting changes occur from time progression.
- Exit criteria:
  - Clock/HUD contract is stable and player-visible.

### Phase 1E: Baseline Diagnostics and Contract Sync

- Goal:
  - Finalize Phase 1 baseline observability and contract synchronization.
- Scope:
  - Add baseline debug/diagnostic visibility for furniture IDs/occupancy.
  - Ensure runtime map rendering includes furniture footprint visibility (descriptor-to-render parity with generated runtime state).
  - Keep Procedural Gen Debug furniture catalog/preview synchronized with active catalog contracts.
- Files:
  - `apps/phaser/phaserApp.js`
  - `apps/phaser/debug/humanDebugOverlay.js`
  - `apps/phaser/debug/firstContactDiagnosticsPanel.js`
  - `apps/debug/debugApp.js`
- Verification:
  - Runtime map visually renders furniture footprints on generated chunks.
  - Debug surfaces expose furniture identity and occupancy baseline.
  - Procedural Gen Debug furniture catalog entries match catalog contract identifiers.
- Exit criteria:
  - Observability and contract sync baseline is locked and ready for Phase 1F procedural realism pass.

### Phase 1F: Procedural Realism Placement Pass

- Goal:
  - Finalize realistic procedural furniture placement for Phase 1 generation outputs.
- Scope:
  - Define room-context furniture placement constraints (for example wall anchoring, clearance, and believable adjacency rules).
  - Standardize bed footprint baseline for realism: remove `2x1` single-bed placements and use `2x2` beds.
  - Ensure generation remains procedural and deterministic while conforming to realism constraints.
  - Eliminate implausible placement patterns from chunk/room furniture descriptor emission.
  - Surface realism-related placement outcomes in Procedural Gen Debug for inspection.
- Files:
  - `engine/generation/chunkGenerator.js`
  - `apps/debug/debugApp.js`
  - `apps/phaser/phaserRuntimeAdapter.js`
  - `apps/phaser/phaserApp.js`
- Verification:
  - Generated furniture layouts pass defined realism checks while preserving deterministic output by seed/chunk.
  - Generated bed placements no longer emit `2x1` beds; bed footprint output is `2x2`.
  - Procedural Gen Debug makes realism pass/fail outcomes and placement distribution visible for review.
  - Runtime hydration and rendering remain stable with realism-constrained descriptor output.
- Exit criteria:
  - Phase 1 is complete and ready for Phase 2 placement/movement work.

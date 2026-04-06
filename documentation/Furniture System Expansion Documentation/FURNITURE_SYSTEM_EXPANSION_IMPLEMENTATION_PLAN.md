# Furniture System Expansion Implementation Plan (Draft)

## Purpose

Define the implementation plan for the Furniture System Expansion (roadmap Planned Feature Set item `1`):

- make furniture explicit runtime world objects instead of static art only,
- support survivor-driven furniture interaction (use, move, store, dismantle),
- integrate furniture movement effects into pathing and locomotion contracts,
- establish deterministic runtime state foundations for upcoming resource systems.

## Status

- Draft created on **April 4, 2026**.
- This is the active implementation plan for the next delivery slice.
- Roadmap phase alignment is locked:
  - Phase 1 focus: Furniture System Expansion,
  - Phase 2 focus: Survivor-only Fog-of-War Display.

## Master Addendum (April 4, 2026)

- Phase-level docs now exist and should be treated as active implementation detail sources:
  - `documentation/Furniture System Expansion Documentation/FURNITURE_SYSTEM_EXPANSION_PHASE_1_DOMAIN_AND_PERSISTENCE.md`
  - `documentation/Furniture System Expansion Documentation/FURNITURE_SYSTEM_EXPANSION_PHASE_2_PLACEMENT_AND_MOVEMENT_EFFECTS.md`
  - `documentation/Furniture System Expansion Documentation/FURNITURE_SYSTEM_EXPANSION_PHASE_3_INTERACTION_PIPELINE.md`
  - `documentation/Furniture System Expansion Documentation/FURNITURE_SYSTEM_EXPANSION_PHASE_4_RESOURCE_OBJECT_CONTRACTS.md`
  - `documentation/Furniture System Expansion Documentation/FURNITURE_SYSTEM_EXPANSION_PHASE_5_TACTICAL_METADATA_AND_DEBUG.md`
  - `documentation/Furniture System Expansion Documentation/FURNITURE_SYSTEM_EXPANSION_PHASE_6_HARDENING_AND_DOCUMENTATION_SYNC.md`

## Scope (Locked For This Expansion)

- Add a furniture runtime subsystem with explicit object identity and lifecycle.
- Add deterministic furniture population flow from generated room/chunk data.
- Add deterministic simulation day/night time model (logic-only; no lighting/visual cycle effects).
- Place furniture on world grid tiles with deterministic occupancy state.
- Implement movement interaction profiles:
  - `block` (non-traversable),
  - `slow` (traversable with movement penalty).
- Add survivor-issued furniture interactions:
  - inspect,
  - use,
  - move/reposition,
  - dismantle/salvage,
  - storage insert/remove where applicable.
- Enforce placement preview/validation before move commit.
- Preserve furniture identity and state across repositioning (including stored items).
- Add inventory-capable furniture contracts (nightstands, closets, mini-bars, etc.).
- Add dismantle behavior with deterministic resource outputs by furniture type.
- Ensure dismantle handles stored items before object removal (eject/transfer policy).
- Add tactical furniture tags/contracts:
  - cover,
  - barricade compatibility,
  - line-of-sight blocking.
- Lock MVP resource object behavior needed for downstream systems:
  - sinks provide infinite water (no restock timer),
  - mini-bars restock daily.
- Define deterministic world-time/day-boundary contract for restock logic (simulation time, not wall-clock time).
- Add player-facing top-right digital clock HUD that displays:
  - current day label (`Day 1`, `Day 2`, ...),
  - time of day.
- Time model excludes week/month/calendar systems (day counter only).
- Make furniture state visible in debug mode (state, occupancy, interaction validity).
- Add Procedural Gen Debug screen furniture visibility:
  - furniture catalog preview,
  - generated furniture descriptor visibility in chunk previews.

## Non-Goals (Locked For This Expansion)

- No full fog-of-war implementation (roadmap Phase 2).
- No advanced furniture move feasibility rules yet (size, stamina, multi-survivor requirement are deferred).
- No complete special-location spawn distribution pass for food/water sources.
- No combat/bullet ballistics implementation for cover usage.
- No lighting tint/shadow or other visual day-night scene changes in this expansion.
- No final art polish pass beyond functional readability and debugging clarity.
- No multiplayer/network synchronization changes.

## Player Interaction Requirements (Locked)

- Furniture interactions are explicit player orders executed by survivors.
- Interaction attempts must be legality-checked before commit.
- Illegal move placements must fail at preview/validation stage.
- Furniture interaction must preserve deterministic outcomes for equal world state + inputs.
- Inventory-capable furniture must expose explicit insert/remove interactions.
- Dismantle interaction must resolve item handling before object deletion.

## Core Behavior Requirements (Locked)

1. Furniture identity and lifecycle
   - Every furniture object has a stable unique ID.
   - Furniture object state includes type, tile position, orientation, and interaction profile.
   - Furniture objects can be created, moved, and removed through explicit lifecycle transitions.
2. Grid occupancy and pathing integration
   - `block` furniture tiles are non-traversable.
   - `slow` furniture tiles remain traversable with additive movement penalty.
   - Pathing behavior must stay deterministic for equal inputs.
3. Move/reposition contract
   - Move command targets a legal destination tile footprint.
   - Preview/validation must include bounds + collision + occupancy checks.
   - Commit transitions object state atomically from old placement to new placement.
4. Storage behavior
   - Storage-capable furniture defines slot count/capacity contract.
   - Insert/remove operations update furniture inventory state immediately and deterministically.
   - Moving furniture does not alter its inventory contents.
5. Dismantle/salvage behavior
   - Dismantle removes furniture from world occupancy and runtime indexes.
   - Resource output table is type-driven and deterministic.
   - Stored-item policy is resolved before removal (eject to tile or transfer to actor inventory).
6. Tactical metadata behavior
   - Furniture can advertise cover value metadata.
   - Furniture can advertise barricade compatibility metadata.
   - Furniture can advertise line-of-sight blocking metadata.
   - Tactical metadata is available for later combat/visibility systems without schema rewrite.
7. Resource furniture subtype behavior (MVP lock)
   - Sink interaction yields water without depletion or restock timer.
   - Mini-bar interaction yields consumables from inventory and follows daily restock cadence.
8. Determinism and runtime consistency
   - Furniture state mutations must remain deterministic for equal world state + inputs.
   - Runtime indexes and object state must remain coherent throughout active simulation.
9. Observability
   - Debug surfaces must expose furniture IDs, profiles, occupancy, and interaction rejection reasons.
   - Procedural Gen Debug screen must expose furniture catalog and generated furniture descriptor visibility.
10. Time model and HUD
   - Simulation provides deterministic time-of-day progression and day increments.
   - Player HUD shows day label + time of day at top-right.
   - No week/month/day-name concepts; only incremental day number is represented.
   - Time system affects logic contracts (for example mini-bar daily restock) without visual lighting changes.

## Technical Design

1. Furniture domain model
   - Introduce a furniture catalog describing per-type contracts:
   - movement profile,
   - storage capability,
   - salvage table,
   - tactical metadata,
   - optional resource-source policy.
2. Runtime furniture state store
   - Maintain `furnitureById` and tile-to-furniture occupancy index.
   - Keep state updates transactional to prevent split-brain occupancy.
3. Placement validator
   - Validate bounds, footprint collisions, tile legality, and overlapping furniture.
   - Return explicit deterministic rejection reason codes.
4. Interaction pipeline
   - Resolve survivor-issued commands into furniture domain operations.
   - Separate command intake from object state mutation for testability.
5. Pathing integration
   - Pathing queries sample furniture movement effects through a narrow interface.
   - `slow` penalties are additive costs; `block` toggles traversability.
6. Resource-source hooks
   - Sink provider always returns available water.
   - Mini-bar provider evaluates day-based restock schedule.
7. Runtime state contract
   - Keep furniture object list and occupancy-derived state synchronized in active runtime.
   - Ensure deterministic day/time state is available to dependent systems at update time.
8. Debug and diagnostics
   - Overlay rendering for occupancy/effect/tactical metadata.
   - Diagnostics panel counters for interaction attempts, rejections, moves, dismantles, restocks.
   - Procedural Gen Debug screen renders furniture catalog preview and generated furniture descriptor visibility.
9. World generation integration
   - Convert room/chunk furniture definitions into runtime furniture objects during chunk hydration.
   - Keep generated furniture placement deterministic by seed + chunk coordinates.
10. Deterministic time source
   - Restock cadence depends on simulation day index derived from deterministic runtime time.
   - Never use wall-clock/local time for furniture restock logic.
11. Clock HUD surface
   - Runtime HUD renders day/time readout in the top-right corner.
   - Display source is the deterministic simulation time model.

## SOLID Guardrails (Locked)

1. Single Responsibility Principle (SRP)
   - Catalog, state store, placement validation, interactions, and salvage remain separate modules.
2. Open/Closed Principle (OCP)
   - New furniture types are added by catalog extension, not branch-heavy rewrites.
3. Liskov Substitution Principle (LSP)
   - Furniture interaction APIs remain stable across concrete furniture subtypes.
4. Interface Segregation Principle (ISP)
   - Keep narrow ports for occupancy queries, pathing penalties, inventory storage, and resource-source behavior.
5. Dependency Inversion Principle (DIP)
   - High-level gameplay systems depend on furniture interfaces, not concrete storage implementation details.

## File-Level Implementation Plan

1. `apps/phaser/phaserApp.js`
   - Compose furniture subsystem in runtime boot/update lifecycle.
2. `apps/phaser/phaserRuntimeAdapter.js`
   - Expose adapter helpers for furniture placement queries and world->tile mapping consistency.
3. `apps/phaser/human/humanCommandController.js`
   - Add furniture command dispatch (`use`, `move`, `dismantle`, `store` interactions).
4. `apps/phaser/human/humanManager.js`
   - Integrate survivor action execution hooks with furniture interaction pipeline.
5. `engine/world/worldStore.js`
   - Maintain deterministic chunk-level furniture descriptor availability for runtime composition.
6. `engine/world/subTilePathfinder.js`
   - Read furniture occupancy/effect penalties during traversal evaluation.
7. `apps/phaser/debug/humanDebugOverlay.js`
   - Render furniture occupancy/effect overlays and interaction reason markers.
8. `apps/phaser/debug/firstContactDiagnosticsPanel.js`
   - Add furniture diagnostics counters and status lines.
9. `apps/debug/debugApp.js`
   - Add furniture catalog preview and generated furniture descriptor visibility in Procedural Gen Debug screen.
10. `engine/procgen.js`
   - Expose/forward deterministic furniture spawn descriptors from generation outputs.
11. `engine/generation/chunkGenerator.js`
    - Emit room/chunk-level furniture descriptors for runtime hydration.
12. `apps/phaser/furniture/furnitureCatalog.js` (new)
   - Define type contracts and per-type behavior metadata.
13. `apps/phaser/furniture/furnitureStateStore.js` (new)
    - Maintain furniture runtime data and occupancy indexes.
14. `apps/phaser/furniture/furniturePlacementValidator.js` (new)
    - Validate move/placement legality and produce reason codes.
15. `apps/phaser/furniture/furnitureInteractionSystem.js` (new)
    - Execute interaction actions and enforce operation contracts.
16. `apps/phaser/furniture/furnitureInventoryModel.js` (new)
    - Storage-capable furniture inventory operations.
17. `apps/phaser/furniture/furnitureSalvageModel.js` (new)
    - Deterministic dismantle output resolution and item ejection policy.
18. `apps/phaser/furniture/furnitureResourceSourceModel.js` (new)
    - Sink infinite-water contract and mini-bar daily restock logic.
19. `documentation/`
    - Sync architecture/runtime/API docs after implementation.
20. `engine/world/runtimeHud.js`
    - Render top-right digital clock (`Day N` + time-of-day).

## Milestones

1. Milestone 1: Furniture domain + state store
   - Furniture objects exist as stable runtime entities with IDs and occupancy indexing.
2. Milestone 2: Generation + runtime composition baseline
   - Generated chunks hydrate deterministic furniture objects in active runtime.
   - Baseline debug visibility exists for furniture IDs and occupancy.
   - Procedural Gen Debug screen displays furniture catalog and generated furniture descriptors.
3. Milestone 3: Simulation clock baseline
   - Deterministic day/time progression is active in runtime.
   - Top-right HUD shows `Day N` and time-of-day.
4. Milestone 4: Placement and movement legality
   - Preview/validation and deterministic move commit are functional.
5. Milestone 5: Pathing integration
   - `block` and `slow` behaviors influence movement/pathing for humans and zombies.
6. Milestone 6: Storage and dismantle flow
   - Inventory-capable furniture and deterministic salvage/ejection rules are live.
7. Milestone 7: Resource subtype contracts
   - Sinks are infinite; mini-bars restock daily.
8. Milestone 8: Tactical metadata contracts
   - Cover/barricade/LOS-block metadata is exposed and debug-visible.
9. Milestone 9: Determinism hardening
   - Deterministic replay outcomes are verified.
10. Milestone 10: Documentation sync and scope lock check
   - Runtime docs and roadmap references are synchronized.

## Incremental Delivery Guardrails (Locked)

1. Each phase must end with a runnable, debug-observable slice.
2. A phase starts only after prior-phase exit criteria are met.
3. Determinism checks run at every phase boundary (not only in final hardening).
4. Determinism checks must run in any phase that mutates furniture state schema or time semantics.

## Detailed Phase Breakdown

### Phase 0: Alignment Lock

- Goal:
  - Freeze Furniture Expansion scope, contracts, and deferred items.
- Files:
  - `documentation/GAME_ROADMAP.md`
  - `documentation/Furniture System Expansion Documentation/FURNITURE_SYSTEM_EXPANSION_IMPLEMENTATION_PLAN.md`
- Work:
  - Lock MVP behaviors and non-goals.
  - Lock sink/mini-bar policy for MVP.
- Verification:
  - Decision checklist complete.
- Exit criteria:
  - Scope-approved implementation baseline.

### Phase 1: Domain and Runtime Foundations

- Goal:
  - Establish runtime furniture object model and runtime composition boundaries.
- Files:
  - `apps/phaser/phaserApp.js`
  - `engine/world/runtimeHud.js`
  - `apps/phaser/debug/humanDebugOverlay.js`
  - `apps/phaser/debug/firstContactDiagnosticsPanel.js`
  - `apps/debug/debugApp.js`
  - `engine/procgen.js`
  - `engine/generation/chunkGenerator.js`
  - `apps/phaser/furniture/furnitureCatalog.js` (new)
  - `apps/phaser/furniture/furnitureStateStore.js` (new)
  - `engine/world/worldStore.js`
- Work:
  - Add IDs, catalog contracts, and occupancy index.
  - Compose furniture subsystem in active runtime boot path.
  - Add deterministic furniture hydration from generated chunk/room descriptors.
  - Add baseline debug visibility for furniture IDs and occupancy.
  - Add Procedural Gen Debug screen furniture catalog preview.
  - Add Procedural Gen Debug screen generated-furniture descriptor visibility.
  - Implement deterministic simulation day/time progression source.
  - Add top-right runtime HUD clock display (`Day N` + time-of-day).
  - Lock deterministic day index source for future restock behavior.
  - Add a procedural realism pass for furniture descriptor emission so generated room layouts remain believable while deterministic.
- Verification:
  - Generated chunks populate deterministic furniture objects in runtime.
  - Debug mode can inspect furniture identity + occupancy at runtime.
  - Procedural Gen Debug screen displays furniture catalog and deterministic descriptor placement.
  - Clock shows deterministic day/time progression during active runtime.
  - Procedural Gen Debug and runtime outputs show realism-constrained furniture placements for identical seed/chunk inputs.
- Exit criteria:
  - Runtime can create furniture objects deterministically.
  - Runtime composition + generation hydration baseline is stable.
  - Runtime clock/HUD baseline is stable without lighting/scene visual changes.
  - Procedural furniture realism baseline is stable.

#### Phase 1 Subphase Sequence (Locked)

1. `1A` Domain Contract Lock
   - Freeze catalog/store schema, ID policy, and day/time contract.
2. `1B` Generation Descriptor Emission
   - Emit deterministic room/chunk furniture descriptors.
3. `1C` Runtime Hydration and Occupancy Baseline
   - Hydrate descriptors into runtime entities and occupancy indexes.
4. `1D` Simulation Clock and HUD Surface
   - Ship deterministic day/time progression and top-right `Day N` clock.
5. `1E` Baseline Diagnostics and Contract Sync
   - Lock baseline debug observability and contract synchronization for Phase 1 surfaces.
6. `1F` Procedural Realism Placement Pass
   - Lock deterministic, procedural, and realistic furniture placement constraints in generation outputs.

Phase 1 subphase detail source:

- `documentation/Furniture System Expansion Documentation/FURNITURE_SYSTEM_EXPANSION_PHASE_1_DOMAIN_AND_PERSISTENCE.md`

### Phase 2: Placement and Movement Effects

- Goal:
  - Enforce valid placement and integrate `block`/`slow` traversal behavior.
- Files:
  - `apps/phaser/furniture/furniturePlacementValidator.js` (new)
  - `engine/world/subTilePathfinder.js`
  - `apps/phaser/phaserRuntimeAdapter.js`
- Work:
  - Implement validator and reason codes.
  - Integrate occupancy/effect queries into pathing.
- Verification:
  - Invalid placements reject deterministically.
  - Path choice changes when `slow` vs `block` furniture is present.
- Exit criteria:
  - Movement/pathing honors furniture profiles.

### Phase 3: Interaction Pipeline (Use/Move/Store/Dismantle)

- Goal:
  - Make survivor orders mutate furniture state through a stable command pipeline.
- Files:
  - `apps/phaser/furniture/furnitureInteractionSystem.js` (new)
  - `apps/phaser/furniture/furnitureInventoryModel.js` (new)
  - `apps/phaser/furniture/furnitureSalvageModel.js` (new)
  - `apps/phaser/human/humanCommandController.js`
  - `apps/phaser/human/humanManager.js`
- Work:
  - Add interaction dispatch and operation contracts.
  - Implement storage insert/remove and dismantle flows.
- Verification:
  - Moving furniture preserves inventory and ID.
  - Dismantle applies deterministic salvage and pre-removal item policy.
- Exit criteria:
  - Core interaction loop is stable and deterministic.

### Phase 4: Resource Object Contracts (Sink + Mini-Bar)

- Goal:
  - Ship MVP resource behavior on top of furniture objects.
- Files:
  - `apps/phaser/furniture/furnitureResourceSourceModel.js` (new)
  - `apps/phaser/furniture/furnitureCatalog.js`
- Work:
  - Implement infinite sink water access.
  - Implement mini-bar day-based restock cadence using deterministic simulation day index.
- Verification:
  - Sink interactions never fail due to depletion.
  - Mini-bar restock occurs exactly once per deterministic day boundary.
- Exit criteria:
  - MVP resource source contracts are functional.

### Phase 5: Tactical Metadata and Debug Observability

- Goal:
  - Expose tactical attributes and diagnostic clarity.
- Files:
  - `apps/phaser/debug/humanDebugOverlay.js`
  - `apps/phaser/debug/firstContactDiagnosticsPanel.js`
- Work:
  - Render tactical tags and occupancy overlays.
  - Expand debug/diagnostics from prior phases to include interactions, salvage, and restock telemetry.
- Verification:
  - Debug mode can explain furniture state transitions and failures across phases 1-4.
- Exit criteria:
  - Debug-first observability standard met.

### Phase 6: Hardening and Documentation Sync

- Goal:
  - Lock deterministic behavior and synchronize docs.
- Files:
  - `documentation/GAME_ARCHITECTURE.md`
  - `documentation/GAME_RUNTIME.md`
  - `documentation/MODULE_API_REFERENCE.md`
  - `documentation/Furniture System Expansion Documentation/FURNITURE_SYSTEM_EXPANSION_IMPLEMENTATION_PLAN.md`
- Work:
  - Validate determinism edge cases.
  - Sync module/runtime docs to final implementation.
- Verification:
  - No unresolved contract drift between code and docs.
- Exit criteria:
  - Furniture Expansion implementation marked complete and documentation-consistent.

## Acceptance Criteria

1. Furniture exists as explicit runtime objects with stable identity and deterministic runtime state.
2. Generated chunk/room data hydrates deterministic furniture objects in active runtime.
3. Placement preview rejects invalid destinations with deterministic reason codes.
4. `block` and `slow` movement effects are respected by pathing/locomotion.
5. Storage furniture supports deterministic insert/remove with persisted inventory.
6. Furniture move preserves object ID and inventory contents.
7. Dismantle removes object, resolves stored-item handling, and yields deterministic resources.
8. Sink and mini-bar MVP contracts are correctly enforced:
   - sink infinite supply,
   - mini-bar daily restock.
9. Mini-bar restock cadence is tied to deterministic simulation day index (not wall clock).
10. Top-right HUD clock displays day label (`Day N`) and time-of-day from deterministic simulation time.
11. No week/month/calendar representation exists in the time model; only incremental day number is used.
12. Tactical metadata (`cover`, `barricade`, `line-of-sight block`) is represented in furniture contracts and exposed in debug.
13. Documentation is synchronized with shipped behavior.
14. Phase 1 furniture realism baseline is shipped:
   - furniture placement is procedural, deterministic, and passes agreed realism constraints,
   - Procedural Gen Debug surfaces realism outcomes for generated chunk placements.

## Risks and Mitigations

1. Risk: Occupancy/index desync causes phantom collisions.
   - Mitigation: transactional state updates + invariant checks in debug diagnostics.
2. Risk: Pathing regressions from furniture integration.
   - Mitigation: narrow occupancy/effect interfaces and deterministic replay checks.
3. Risk: Interaction race conditions (move vs dismantle vs store).
   - Mitigation: operation locking per furniture ID during mutation tick.
4. Risk: Restock timing drift by runtime clock variance.
   - Mitigation: restock by deterministic day-boundary tick math, not frame time accumulation.
5. Risk: Scope creep into combat/fog systems.
   - Mitigation: enforce non-goals and phase gates in this plan.
6. Risk: Generated furniture descriptors drift from runtime furniture schema.
   - Mitigation: add schema adapter validation during chunk hydration and fail-fast debug diagnostics.

## Completion Declaration Template

When this expansion is complete, record:

- completion date,
- locked behavior outcomes,
- unresolved follow-up items deferred to later roadmap phases.

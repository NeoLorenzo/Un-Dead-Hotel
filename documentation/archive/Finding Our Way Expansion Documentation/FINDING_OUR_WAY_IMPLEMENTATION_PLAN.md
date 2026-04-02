# Finding Our Way Implementation Plan (Expansion Phase 2+, Complete and Archived)

## Purpose

Define the implementation plan for the **Finding Our Way** gameplay/AI overhaul:

- decouple Guest AI behavior planning from Zombie wander planning,
- add a low-resolution danger influence map layer for threat-aware path costing,
- replace Guest static mode switching with a weighted utility brain,
- make Guest objective selection pathfinding-driven (seek shelter, wander, evade).

## Status

- Draft created on **March 20, 2026**.
- Expansion Phase 1 locomotion standardization completed on **March 21, 2026**.
- Expansion Phase 3 danger recognition and response completed on **March 31, 2026**.
- Expansion Phase 4 brain-to-movement integration completed on **March 31, 2026**.
- Post-Phase-4 final polish decisions locked on **April 2, 2026**.
- Finding Our Way expansion implementation is complete and ready-to-ship as of **April 2, 2026**.
- Finding Our Way documentation archived on **April 2, 2026**.

## Master Addendum (March 28, 2026)

- Phase-level docs now exist and should be treated as active implementation detail sources:
  - `documentation/archive/Finding Our Way Expansion Documentation/FINDING_OUR_WAY_PHASE_1_LOCOMOTION.md`
  - `documentation/archive/Finding Our Way Expansion Documentation/FINDING_OUR_WAY_PHASE_2_MENTAL_MODEL.md`
  - `documentation/archive/Finding Our Way Expansion Documentation/FINDING_OUR_WAY_PHASE_3_DANGER_PATHFINDING.md`
  - `documentation/archive/Finding Our Way Expansion Documentation/FINDING_OUR_WAY_PHASE_4_BRAIN_MOVEMENT_INTEGRATION.md`
- Phase 3 planning now includes subphase `3E`:
  - if a guest has danger while in room context, nearest-door egress takes priority before generic danger flee routing.
- Debug-mode-first rule is locked:
  - Debug mode is a primary development surface.
  - Every mechanic must be observable in debug mode when implemented.
- Guest memory architecture rule is locked:
  - danger memory and related runtime memory remain per-guest only.
- Phase 4 integration scope was tightened on **March 31, 2026**:
  - completion target is brain-to-locomotion finalization (objective authority + shelter completion + planner decoupling + feedback-loop closure),
  - global influence-map revival and weighted traversal rollout are explicitly deferred out of Phase 4.
- Phase 4 completion outcomes recorded on **March 31, 2026**:
  - objective dispatch contract and path-feedback loop shipped,
  - shelter objective finalized with safe-zone targeting and completion handoff,
  - danger objective priority over shelter/wander enforced,
  - shelter excludes danger-marked rooms from candidate targets,
  - guest planning decoupled from zombie wander planner.
- Final polish decisions locked on **April 2, 2026**:
  - no feature flags for Finding Our Way rollout,
  - survivor conversion behavior remains as currently implemented (touch conversion, no additional cooldown/guard),
  - no dedicated formal regression-check gate is required for this release pass,
  - implementation is declared complete and ready-to-ship.

## Expansion Sequencing Update (Locked)

- **Expansion Phase 1 is complete** and documented in `documentation/FINDING_OUR_WAY_PHASE_1_LOCOMOTION.md`.
- Phase 1 removed steered vector locomotion and standardized Zombies, Guests, and Survivors onto shared `0.25`-tile traversal contracts.
- This master plan is now explicitly scoped to **post-Phase-1** work: influence mapping, danger memory, weighted utility decisions, and objective-driven Guest planning.

## Core Verbatim Constraints (Locked)

The following two constraints are copied verbatim and are implementation-critical:

1. Influence Map System
   > "Instead of modifying the A* tile grid where objects are, we instead create a new layer which acts as an influence map. This influence map should not use the regular pathfinding grid, instead it will use a lower resolution version. The tile where a zombie is standing on wil be, lets say +50, and the tile at the edge of the danger heatmap will be +2, with each tile between the center and edge forming a danger gradient. Then when the A* algorithm calculates a path it checks both the grid and the influence map."
2. Weighted Utility AI Brain
   > "Guest brains should be weighted. The base mental state will have a high weight to seek shelter, and a small weight to wander. Then if they see danger the danger weight will go up until it supercedes the other weight. Pathfinding is based on this weighted system."

## Scope (Locked For Expansion Phase 2+)

- Treat Expansion Phase 1 locomotion unification as a fixed prerequisite.
- Introduce a new Guest-only danger influence map subsystem at lower resolution than the base `0.25` tile navigation grid.
- Add a danger-point memory model for Guests:
  - when a Guest sees a Zombie, store/update last-known danger point,
  - keep that danger point when line of sight breaks,
  - feed danger points into influence-map generation.
- Extend pathfinding cost evaluation so Guest path planning combines:
  - base navigation traversability,
  - additive influence-map danger penalty.
- Replace Guest flee/wander hard switch logic with weighted utility objective selection:
  - `SeekShelterWeight` (high baseline),
  - `WanderWeight` (low baseline),
  - `DangerWeight` (dynamic).
- Add explicit Guest objectives:
  - `seek_shelter` (target safe-zone room),
  - `wander` (low-priority fallback),
  - `flee/evade` (danger override behavior).
- Preserve current survivor conversion behavior (Guest touch survivor -> Guest becomes survivor).
- Add diagnostics/debug overlays for:
  - influence-map state,
  - guest brain weights/objectives,
  - danger memory points and pathing outcomes.

## Non-Goals (Locked For Expansion Phase 2+)

- No Zombie utility brain migration in this update.
- No additional locomotion architecture rewrite in this slice; locomotion standardization was delivered in Expansion Phase 1.
- No combat/weapon expansion for survivors.
- No multiplayer/network behavior changes.
- No final art/UI polish pass beyond readable debug and diagnostics.

## Player Interaction Requirements (Locked)

- Existing survivor controls remain unchanged:
  - `Left Click` select,
  - `Shift + Left Click` additive/toggle selection,
  - drag-box multi-select,
  - `Ctrl + Left Click` group movement command.
- Guests remain non-selectable until converted to survivors.
- Debug toggle continues to expose runtime diagnostics, now including Guest utility and influence-map information.

## Core Behavior Requirements (Locked)

1. Influence map separation
   - Influence map is a separate data layer from base navigation grid.
   - Influence map resolution is lower than base pathfinding cell resolution.
2. Danger gradient
   - Zombie epicenter influence weight: `+50`.
   - Outer radius edge influence weight: `+2`.
   - Intermediate cells interpolate a gradient from center to edge.
3. A* integration
   - Path traversal cost for Guest planning includes both navigation movement cost and sampled influence-map penalty.
   - Influence penalties affect route choice without mutating base walkability.
4. Guest utility brain
   - Guest objective is chosen by weighted evaluation each behavior tick.
   - Baseline preference is shelter over wander.
   - Danger signal can override baseline and force evade behavior.
5. Danger override and recovery
   - When Zombie is detected, danger weight rises until it can exceed shelter weight.
   - When danger fades or LOS breaks long enough, danger weight decays.
   - Objective can transition back from evade to shelter/wander.
6. Threat memory persistence
   - Guest keeps last-known danger point after LOS break.
   - Influence map continues to include remembered danger until memory decay/expiry rules remove it.
7. Decoupled planning ownership
   - Guest planning does not depend on `zombieWanderPlanner` implementation details.
   - Guest planning modules own objective selection and target/path planning.

## Technical Design

1. Runtime composition and policy
   - Keep mixed runtime (humans + zombies) and introduce Feature-Flag/Mode policy for post-Phase-1 rollout.
   - Treat the Phase 1 grid locomotion contract as locked input for all new Guest systems.
   - Guest behavior pipeline becomes:
   - perception -> danger memory -> influence map update -> utility evaluation -> objective targeting -> weighted path plan -> controller command.
2. Influence map subsystem
   - Add a low-resolution world-space influence grid service.
   - Maintain danger sources from guest-visible or remembered zombie points.
   - Rebuild/update influence grid on a bounded cadence, not every frame.
3. Weighted pathfinding integration
   - Extend `subTilePathfinder` to accept an optional traversal-cost callback for additive per-cell penalties.
   - Influence map sampling converts pathfinder cell center world position to low-res influence-cell value.
4. Utility brain subsystem
   - Introduce a Guest brain state model with baseline and dynamic weights.
   - Weight evaluator computes active objective per guest each behavior tick.
   - Objective transitions and reason codes are recorded for diagnostics.
5. Objective planners
   - `seek_shelter`: target nearest valid safe-zone room anchor.
   - `wander`: low-priority exploration fallback.
   - `flee/evade`: choose route/goal that minimizes danger-weighted path cost.
6. Safe-zone indexing
   - Build room/safe-zone candidate index from runtime world/chunk data.
   - Expose stable APIs for nearest shelter lookup.
7. Observability and debug
   - Human debug overlay can render influence-map cells, danger memory points, and guest objective state.
   - Diagnostics panel reports utility weights, objective counts, influence stats, and replanning success/failure rates.

## SOLID Guardrails (Locked)

1. Single Responsibility Principle (SRP)
   - Influence map, utility scoring, objective targeting, and path dispatch remain separate modules.
2. Open/Closed Principle (OCP)
   - Objective policies (`seek_shelter`, `wander`, `flee`) are strategy-style and extensible.
3. Liskov Substitution Principle (LSP)
   - Human controller movement contract remains stable regardless of planner implementation.
4. Interface Segregation Principle (ISP)
   - Keep narrow ports for:
   - danger source intake,
   - influence sampling,
   - utility scoring,
   - safe-zone lookup,
   - path planning dispatch.
5. Dependency Inversion Principle (DIP)
   - High-level guest brain depends on planner/influence interfaces, not concrete zombie modules.

## File-Level Implementation Plan

1. `apps/phaser/phaserApp.js`
   - Add Finding Our Way behavior config/tuning for guest utility + influence services.
   - Wire guest policies into `humanManager` composition without coupling to zombie planner internals.
2. `apps/phaser/human/humanManager.js`
   - Remove Guest behavior dependence on `createZombieWanderPlanner` for core decision/planning.
   - Integrate utility-brain tick, danger memory updates, influence-map updates, and objective-driven path dispatch.
3. `apps/phaser/human/humanPerception.js`
   - Extend perception outputs as needed for danger intensity inputs (distance, LOS continuity, timestamps).
4. `apps/phaser/human/humanFleePlanner.js` (refactor/split)
   - Convert into generic objective path planner or keep as flee-specialized helper under utility pipeline.
5. `apps/phaser/human/guestUtilityBrain.js` (new)
   - Weight state model, evaluation loop, transitions, and debug payloads.
6. `apps/phaser/human/guestDangerMemory.js` (new)
   - Last-known danger point lifecycle, decay/expiry, and query APIs.
7. `apps/phaser/human/guestInfluenceMapService.js` (new)
   - Low-resolution grid build/update, gradient propagation, and sampling API.
8. `apps/phaser/human/guestObjectivePlanner.js` (new)
   - Objective-specific goal selection (`seek_shelter`, `wander`, `flee`) and path request packaging.
9. `apps/phaser/human/guestSafeZoneIndex.js` (new)
   - Safe-zone extraction/indexing from room data and nearest-valid lookup.
10. `engine/world/subTilePathfinder.js`
    - Add optional weighted traversal hook for danger penalties.
11. `apps/phaser/phaserRuntimeAdapter.js`
    - Add helper APIs needed by safe-zone indexing and low-res influence sampling alignment.
12. `apps/phaser/debug/humanDebugOverlay.js`
    - Render influence-map heat cells, danger points, and utility objective indicators.
13. `apps/phaser/debug/firstContactDiagnosticsPanel.js`
    - Add utility/influence diagnostics lines and summary metrics.
14. `documentation/`
    - Sync architecture/runtime/module docs after implementation.

## Milestones

1. Milestone 1: Locomotion standardization complete (Phase 1).
2. Milestone 2: Weighted mental model complete (Phase 2).
3. Milestone 3: Danger recognition/response complete (Phase 3).
4. Milestone 4: Brain-to-movement integration complete (Phase 4).
5. Milestone 5: Final polish decisions locked post-Phase-4 (no new phase).

## Acceptance Criteria

1. Guest behavior no longer depends on zombie wander planner logic for objective selection.
2. Utility brain objective dispatch remains authoritative for `danger`, `shelter`, and `wander`.
3. Danger priority, shelter completion handoff, and danger-room shelter exclusion are stable and deterministic.
4. Deterministic replan reasons and path-feedback envelopes are emitted and inspectable.
5. Rollout policy is locked to no feature flags.
6. Survivor conversion policy is locked to current as-is behavior.
7. No dedicated formal regression-check gate is required for this release pass.
8. Documentation is synchronized with shipped behavior and completion status.
9. Finding Our Way expansion is declared implementation-complete and ready-to-ship.

## Risks and Mitigations

1. Risk: Guests oscillate objectives (flee/shelter thrash).
   - Mitigation: hysteresis thresholds, minimum objective hold time, smoothed danger decay.
2. Risk: Safe-zone lookup becomes inconsistent across streamed chunks.
   - Mitigation: bounded local index refresh and fallback target strategy when nearest room is invalid.
3. Risk: Regression in survivor command pathfinding from behavior-path updates.
   - Mitigation: maintain backward-compatible behavior and continue continuous in-development playtesting.
4. Risk: Late-stage decision changes cause release drift.
   - Mitigation: lock final polish decisions post-Phase-4 and avoid reopening expansion scope.

## Post-Phase-4 Final Polish Decisions (Locked)

1. Rollout mode is locked to no feature flags.
2. Survivor conversion behavior remains as currently implemented.
3. No dedicated formal regression-check gate is required for this release pass.
4. Expansion scope is closed at Phase 4 + final polish decisions.

## Completion Declaration (April 2, 2026)

Finding Our Way expansion implementation is complete and ready-to-ship.

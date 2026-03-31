# Finding Our Way Implementation Plan (Expansion Phase 2+)

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
- This document now tracks remaining implementation work for Expansion Phase 2+.

## Master Addendum (March 28, 2026)

- Phase-level docs now exist and should be treated as active implementation detail sources:
  - `documentation/Finding Our Way Expansion Documentation/FINDING_OUR_WAY_PHASE_1_LOCOMOTION.md`
  - `documentation/Finding Our Way Expansion Documentation/FINDING_OUR_WAY_PHASE_2_MENTAL_MODEL.md`
  - `documentation/Finding Our Way Expansion Documentation/FINDING_OUR_WAY_PHASE_3_DANGER_PATHFINDING.md`
  - `documentation/Finding Our Way Expansion Documentation/FINDING_OUR_WAY_PHASE_4_BRAIN_MOVEMENT_INTEGRATION.md`
  - `documentation/Finding Our Way Expansion Documentation/FINDING_OUR_WAY_PHASE_5_HARDENING_AND_POLISH.md`
- Phase 3 planning now includes subphase `3E`:
  - if a guest has danger while in room context, nearest-door egress takes priority before generic danger flee routing.
- Debug-mode-first rule is locked:
  - Debug mode is a primary development surface.
  - Every mechanic must be observable in debug mode when implemented.
- Guest memory architecture rule is locked:
  - danger memory and related runtime memory remain per-guest only.

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

1. Milestone 1: Pathfinder weighting foundation
   - `subTilePathfinder` supports additive traversal penalty callbacks with no regressions.
2. Milestone 2: Danger representation core
   - Low-res influence grid and per-guest danger memory pipeline produce stable sampled danger values.
3. Milestone 3: Objective planning baseline
   - Objective planning builds on the completed Phase 2 weighted mental-model baseline.
4. Milestone 4: Objective completion in integration loop
   - Remaining shelter and evade planner completion is delivered inside Human Manager integration.
5. Milestone 5: Decoupling completion
   - Guest behavior no longer relies on zombie wander planner implementation.
6. Milestone 6: Stability and docs sync
   - Performance/stability pass complete and documentation updated.

## Acceptance Criteria

1. Guest behavior no longer depends on zombie wander planner logic for objective selection.
2. Influence map exists as a separate, lower-resolution grid and is not a mutation of base nav data.
3. Influence gradient applies `+50` at threat center and approaches `+2` at configured edge radius.
4. Guest path planning uses additive influence penalties on top of base navigation cost.
5. Utility brain selects among `seek_shelter`, `wander`, and `flee` based on weighted evaluation.
6. Danger detection can override shelter bias; danger decay can return guests to shelter bias.
7. LOS break preserves last-known threat memory until configured expiry.
8. Guests can target safe-zone rooms and idle/hold behavior there per locked policy.
9. Debug overlays/diagnostics expose influence-map and utility state in real time.
10. All post-Phase-1 systems preserve the shared grid locomotion contract introduced in Expansion Phase 1.

## Risks and Mitigations

1. Risk: Weighted pathfinding increases CPU cost.
   - Mitigation: low-res influence grid, capped update cadence, and optional sampling cache.
2. Risk: Guests oscillate objectives (flee/shelter thrash).
   - Mitigation: hysteresis thresholds, minimum objective hold time, smoothed danger decay.
3. Risk: Safe-zone lookup becomes inconsistent across streamed chunks.
   - Mitigation: bounded local index refresh and fallback target strategy when nearest room is invalid.
4. Risk: Influence values overpower base movement cost and create unnatural detours.
   - Mitigation: clamp penalties and expose tuning constants for balancing.
5. Risk: Regression in survivor command pathfinding from pathfinder changes.
   - Mitigation: strict backward-compat behavior when weight callback is omitted and regression checks in command flow.

## Phase 2.0 Decision Checklist (Post-Phase-1)

- [ ] Runtime rollout policy locked (`first_contact` feature-gated vs dedicated mode).
- [ ] Influence map resolution locked (example: `1.0` or `2.0` world-tile cells).
- [ ] Influence radius and gradient function locked.
- [ ] Danger memory expiry/decay rule locked.
- [x] Danger memory ownership locked as per-guest only (no shared guest memory).
- [ ] Utility baseline weights and danger growth/decay curves locked.
- [ ] Safe-zone definition locked (room center, room interior sample, or tagged nodes).
- [ ] Shelter completion behavior locked (idle in room, patrol inside room, or timed reevaluate).

## Questions To Resolve (Must Be Answered)

1. Should this ship in existing `first_contact` mode behind a feature flag, or as a new runtime mode (for example `finding_our_way`)?
2. What exact low-resolution influence cell size should we lock first (`1.0` tiles vs `2.0` tiles)?
3. What exact danger influence radius should use the `+50` center -> `+2` edge gradient?
4. What exact danger growth function should be used when zombie is visible (distance-only, LOS-duration-only, or combined)?
5. What exact danger decay and memory expiry timing should apply after LOS is lost?
6. Resolved on March 28, 2026: danger points are per-guest memory only (no shared guest memory model).
7. What precise safe-zone anchor should `seek_shelter` target (room center, nearest room-floor tile, doorway-adjacent tile, or another rule)?
8. When a guest reaches shelter, should they idle in place, wander within shelter bounds, or immediately seek a deeper interior point?
9. Should survivor pathfinding remain unweighted, or optionally use influence-map weights in a future phase?
10. Do we keep current guest conversion-on-touch exactly as-is during this overhaul, or add any conversion cooldown/guard rules?

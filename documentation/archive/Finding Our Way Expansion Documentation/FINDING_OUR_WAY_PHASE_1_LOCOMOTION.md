# Finding Our Way - Phase 1 Locomotion Implementation Plan (Complete)

## Purpose

Phase 1 is strictly about unifying movement physics.

This phase removes steered vector locomotion from gameplay movement execution so all active agents use the same discrete traversal model:

- Zombies move tile-by-tile on the `0.25` tile grid in both `wander` and `pursuit`.
- Guests (while wandering or fleeing) move tile-by-tile on the `0.25` tile grid.
- Survivors remain tile-path driven as they are today.

Outcome: one locomotion paradigm across the simulation, so juking, interception, spacing, and collision outcomes happen on a shared grid contract.

## Status

- Draft created on **March 21, 2026**.
- Implementation completed on **March 21, 2026**.
- Post-implementation pursuit cadence tuning completed on **March 21, 2026**.

## Implementation Outcome (Completed)

- Shared raster locomotion utility added:
  - `engine/world/lineTileRasterizer.js`
- Zombie locomotion execution migrated to queued path arrays:
  - `apps/phaser/zombie/zombieController.js`
  - `apps/phaser/zombie/zombieManager.js`
- Guest locomotion execution migrated to queued path arrays:
  - `apps/phaser/human/humanManager.js`
  - `apps/phaser/human/humanController.js` (`setWaypointWorld` removed from public API)
- Debug overlays updated to render queued path arrays instead of single steering rays:
  - `apps/phaser/debug/zombieDebugOverlay.js`
  - `apps/phaser/debug/humanDebugOverlay.js`
- Pursuit responsiveness/stability tuning applied:
  - target-visible pursuit replanning now uses cooldown + displacement checks against `lastPlannedWorld`.

## Scope (Locked)

- Remove continuous vector velocity movement for:
  - zombie `wander`,
  - zombie `pursuit`,
  - guest `wander`,
  - guest `flee`.
- Implement tile-by-tile traversal for all locomotion modes above.
- Retain existing Wander waypoint selection behavior:
  - random point selection within unobstructed vision cone,
  - current cone clipping and blocked-sector recovery behavior.
- Replace direct waypoint steering with a lightweight line-drawing path build:
  - use a Bresenham-style line algorithm over the `0.25` tile grid,
  - rasterize tiles from current agent tile to selected waypoint tile,
  - validate each sampled tile for walkability.
- Use 8-way (diagonal-allowed) sub-tile stepping.
- On blocked traversal, allow short local salvage:
  - trim to the furthest walkable prefix,
  - walk the trimmed path,
  - repick when exhausted.
- Feed resulting tile arrays into each agent movement controller so movement is executed discretely along tile centers.
- Keep existing behavior cadences/recovery defaults unchanged for this phase.
- Remove vector-waypoint execution APIs immediately (`setWaypointWorld`-style steer commands).

## Non-Goals (Locked)

- Do NOT implement A* pathfinding for Wander state.
- Do NOT implement Influence Map, Danger Points, or Danger Auras.
- Do NOT implement Weighted Utility Brain or new Guest objectives.
- Do NOT redesign pursuit/combat tuning outside locomotion execution updates required by the tile-path model.
- Do NOT retune no-candidate/recovery cadences in this phase.

## Current Problem Statement

Current locomotion contracts are mismatched:

- Survivors already execute path arrays on grid-aligned movement.
- Zombies and Guests still execute continuous steered movement in key threat behaviors (pursuit/flee/wander).

This produces unfair interaction geometry where grid-bound humans cannot reliably juke vector-moving threats that cut across sub-tile lines.

## Technical Design

### Design Summary

Keep the existing waypoint chooser and replace only the execution layer:

1. Wander planner still picks a candidate waypoint world position in cone.
2. Zombie pursuit target world points are also rasterized into ordered `0.25`-grid tile steps.
3. Guest flee target world points are rasterized with the same line routine.
4. Controller consumes these step lists as path arrays, identical in structure to survivor movement consumption.
5. Agent advances node-by-node; if blocked by dynamic occupancy, traversal trims to furthest valid prefix and then repicks.

### Locomotion Contract (Phase 1)

- Input to movement execution: ordered tile array (`[{x, y}, ...]`) on `0.25` grid.
- Output: deterministic logical progression along tile centers with smooth visual interpolation between centers.
- Movement connectivity: 8-way stepping is permitted when sampled tiles are walkable.
- Removed input contract: single freeform world waypoint for steering-based movement.
- API cleanup mandate: remove `setWaypointWorld`-style execution paths instead of keeping adapters.

### Line-Drawing Approach (Bresenham-Style)

- Convert start world and waypoint world to sub-tile coordinates aligned to `0.25` grid.
- Run integer line stepping across sub-tile lattice.
- Emit only walkable tiles.
- Deduplicate contiguous duplicates.
- Convert accepted tiles to world centers for controller interpolation between nodes.
- If a blocked tile is reached:
  - keep and execute the walkable prefix,
  - discard the blocked suffix,
  - repick after the trimmed segment completes.
- If no walkable prefix exists, immediately repick.

### Performance Notes

- Raster path construction remains O(n) in line length with no open/closed set overhead.
- No per-agent A* calls for unobstructed wandering, fleeing, or pursuit raster execution.
- Keep existing replan cooldowns and no-candidate recovery controls.
- Benchmark success is relative to the current stable horde baseline (example baseline: `150` zombies + `50` guests at `60 FPS`).
- Validate that path array allocation does not introduce observable GC/frame-time spikes.

## Technical Design & File Hooks

Likely implementation touchpoints to swap vector execution to tile traversal:

1. `apps/phaser/zombie/zombieController.js`
- Replace single `waypointWorld` steering contract with path-array traversal (`setPath`/`setWorldPath` style).
- Remove `setWaypointWorld` and vector-steering execution codepaths entirely.
- Remove vector-specific wander/pursuit state assumptions from update loop.
- Keep collision gate and heading updates, but drive them from current path node.

2. `apps/phaser/zombie/zombieManager.js`
- Where wander currently calls `zombie.setWaypointWorld(waypoint)`, rasterize line to sub-tile path and assign path.
- Apply the same rasterization contract to pursuit target dispatch.
- Preserve existing wander/pursuit mode handling and recovery state machine.

3. `apps/phaser/human/humanManager.js`
- Guest wander/flee currently assigns single waypoint via `controller.setWaypointWorld(...)`.
- Convert guest wander/flee execution to line-rasterized tile arrays before dispatching to controller.
- Keep perception and mode selection behavior unchanged in this phase.

4. `apps/phaser/human/humanController.js`
- Reuse existing path-array execution contract used by survivors.
- Confirm guest-assigned paths use same discrete traversal semantics.
- Remove any residual assumptions that guest wander depends on single-waypoint steering.

5. `apps/phaser/zombie/zombieWanderPlanner.js`
- Keep waypoint selection logic intact (non-goal to redesign planning).
- Optional: expose waypoint output in both world and sub-tile forms for cleaner handoff.

6. `engine/world/` (new utility module expected)
- Add a shared line-raster helper (for example `lineTileRasterizer.js`) to avoid duplicating Bresenham logic across zombie and guest flows.
- Define shared helpers for `world <-> 0.25-tile` coordinate conversion, 8-way stepping, dynamic-block trim, and tile dedupe.

7. `apps/phaser/debug/zombieDebugOverlay.js`
- Update waypoint visualization to render discrete queued path segments (not single steering ray).

8. `apps/phaser/debug/humanDebugOverlay.js`
- Ensure guest wander/flee overlays show the queued tile path and current node index consistently with survivor path rendering.

9. `apps/phaser/debug/firstContactDiagnosticsPanel.js`
- Update diagnostics labels/metrics if they still imply vector steering state.

10. `apps/phaser/phaserApp.js`
- Keep runtime wiring stable; only tune policy values if new path queue behavior needs minor cadence adjustments.

## Detailed Phase Breakdown

### Phase 1A: Locomotion Contract Lock + Shared Raster Utility (Completed)

Goal:
- Lock the new movement contract so all non-survivor locomotion execution consumes path arrays on the `0.25` grid.
- Introduce one shared Bresenham-style rasterization utility to prevent duplicated logic.

Primary files:
- `engine/world/` (new shared raster module, for example `lineTileRasterizer.js`)
- `apps/phaser/zombie/zombieManager.js`
- `apps/phaser/human/humanManager.js`
- `documentation/FINDING_OUR_WAY_PHASE_1_LOCOMOTION.md`

Implementation detail:
- Add helper APIs for:
  - world-to-subtile conversion (`0.25` resolution),
  - subtile-to-world-center conversion,
  - 8-way raster stepping,
  - contiguous dedupe,
  - blocked-prefix trimming.
- Define canonical function signatures and return payloads:
  - success path payload,
  - trimmed path payload,
  - no-walkable-prefix payload.
- Freeze "no adapters" rule in code comments near all dispatch callsites that previously used `setWaypointWorld`.
- Keep planner ownership unchanged: waypoint choosers keep selecting world targets; only execution payload changes.

Verification:
- Unit-level sanity checks (or lightweight runtime asserts) on raster helper:
  - horizontal, vertical, diagonal, and mixed-slope lines,
  - blocked tile encountered mid-line,
  - fully blocked immediate neighbor.
- Confirm both zombie and guest managers can import and call helper without behavior wiring changes yet.

Exit criteria:
- Shared raster helper exists and is callable from both manager domains.
- Locomotion contract is documented and consistent in callsites.
- No controller still requires single-waypoint execution to function.

### Phase 1B: Zombie Controller Migration (Remove Vector Execution) (Completed)

Goal:
- Remove zombie vector-waypoint execution from controller layer and migrate to path-array execution only.

Primary files:
- `apps/phaser/zombie/zombieController.js`
- `apps/phaser/debug/zombieDebugOverlay.js` (if controller debug payload shape changes)

Implementation detail:
- Replace `waypointWorld` internal state with:
  - queued path waypoints world array,
  - active waypoint index.
- Remove `setWaypointWorld`/single-waypoint execution path.
- Add/align path assignment methods with human-style contracts:
  - `setPath` tile array input,
  - optional `setWorldPath` internal helper.
- Preserve:
  - collision-gated movement,
  - smooth interpolation between waypoint centers,
  - heading updates from actual movement deltas.
- Keep dead/alive and HP behavior unchanged.

Verification:
- Zombie can accept a multi-node path and advance node-by-node.
- Zombie halts/clears path correctly when path is exhausted.
- Debug payload still exposes current waypoint and path for overlay usage.

Exit criteria:
- Zombie controller has no active vector execution route.
- Zombie movement works from path arrays only.

### Phase 1C: Zombie Wander + Pursuit Execution Wiring (Completed)

Goal:
- Route zombie wander and pursuit movement dispatch through rasterized tile arrays.

Primary files:
- `apps/phaser/zombie/zombieManager.js`
- `apps/phaser/zombie/zombieWanderPlanner.js` (only if normalization helpers are needed)
- `apps/phaser/debug/firstContactDiagnosticsPanel.js` (mode/perf metrics wording if needed)

Implementation detail:
- Wander:
  - keep existing cone candidate selection unchanged,
  - rasterize current position to selected waypoint,
  - trim at first blocked tile,
  - dispatch trimmed path to zombie controller.
- Pursuit:
  - rasterize current position to pursuit target world,
  - apply same blocked-prefix behavior,
  - dispatch path using same controller API as wander.
- Keep existing mode switching and recovery controls unchanged:
  - no-candidate streak,
  - failed-sector memory,
  - repick cooldown.
- Remove all manager-side calls to zombie `setWaypointWorld`.

Verification:
- Wander mode stays grid-bound and still repicks when needed.
- Pursuit mode stays grid-bound and does not corner-cut off-grid.
- No behavior deadlocks when dynamic agents temporarily block lines.

Exit criteria:
- Zombie wander and pursuit both move only via raster path arrays.
- No remaining manager callsites use removed vector methods.

### Phase 1D: Guest Wander + Flee Execution Wiring (Completed)

Goal:
- Route guest wander and flee execution through the same raster path contract as zombies.

Primary files:
- `apps/phaser/human/humanManager.js`
- `apps/phaser/human/humanController.js` (only if minor payload alignment needed)
- `apps/phaser/debug/humanDebugOverlay.js`

Implementation detail:
- Keep guest perception and decision logic unchanged.
- For guest wander:
  - keep current waypoint chooser behavior,
  - rasterize and dispatch path array.
- For guest flee:
  - keep current flee target derivation behavior,
  - rasterize and dispatch path array on existing replan cadence.
- Apply blocked-prefix trim behavior identically to zombie flow.
- Remove all guest manager calls to `controller.setWaypointWorld(...)`.

Verification:
- Guests in wander and flee remain grid-aligned at all times.
- Frequent flee replans do not cause off-grid drift.
- Guest conversion flow remains unaffected.

Exit criteria:
- Guest locomotion execution is fully path-array driven for wander/flee.
- No guest callsites use vector-waypoint execution.

### Phase 1E: Debug/Diagnostics Alignment + Performance Gate (Completed)

Goal:
- Align observability with the new locomotion contract and confirm no performance regression.

Primary files:
- `apps/phaser/debug/zombieDebugOverlay.js`
- `apps/phaser/debug/humanDebugOverlay.js`
- `apps/phaser/debug/firstContactDiagnosticsPanel.js`
- `documentation/FINDING_OUR_WAY_PHASE_1_LOCOMOTION.md`

Implementation detail:
- Update debug visuals from single steering ray to queued node path rendering where needed.
- Ensure diagnostics terminology reflects path-array execution (not vector steering).
- Add focused runtime counters (or verify existing counters) for:
  - replans attempted/succeeded,
  - trimmed-path occurrences,
  - empty-prefix failures.
- Run stress scenario at current stable horde baseline.
- Compare against pre-change baseline:
  - frame pacing stability,
  - peak/update-time spikes,
  - observable GC stutter from path allocations.

Verification:
- Debug overlays and diagnostics accurately represent live path-array behavior.
- Performance is not measurably worse than baseline.

Exit criteria:
- No stale vector-steering diagnostics remain.
- Baseline performance gate passes.
- Phase 1 documentation matches implemented behavior.

## Implementation Sequence (Locked)

Completion note:
- Sequence executed in order and Phase 1 implementation is complete.

1. Complete Phase 1A before any controller deletion.
2. Complete Phase 1B before wiring zombie managers.
3. Complete Phase 1C before guest execution migration.
4. Complete Phase 1D before final diagnostics/perf signoff.
5. Complete Phase 1E and freeze Phase 1 scope before Phase 2 work begins.

## Acceptance Criteria

- Zombies and Guests move exclusively on the `0.25` tile grid in `wander`, `pursuit`, and `flee`.
- Vector/steered locomotion execution is fully removed.
- Wander waypoint selection behavior remains intact (same cone-based candidate policy).
- Wander execution uses Bresenham-style line tile arrays, not A*.
- Pursuit and flee execution also use rasterized tile arrays from their target world points.
- Guests and Zombies consume discrete path arrays similarly to survivor movement contracts.
- Diagonal movement is supported via 8-way tile stepping when walkable.
- Blocked paths are trimmed to walkable prefix instead of being discarded immediately.
- Visual movement remains smooth (interpolated between tile centers) with no new jitter at normal camera zoom levels.
- `setWaypointWorld` (and equivalent vector-waypoint execution APIs) are removed.
- No measurable performance regression versus current stable horde baseline.

## Verification Plan

1. Functional checks
- Spawn mixed populations (Survivors, Guests, Zombies).
- Confirm zombie wander and pursuit both stay on rasterized grid paths.
- Confirm guest wander and flee both stay on rasterized grid paths.
- Confirm blocked-path behavior trims to walkable prefix, then repicks.
- Confirm diagonal path steps execute correctly (8-way).

2. Debug validation
- Confirm overlays render queued path nodes for Zombies and Guests.
- Confirm no stale single-waypoint debug artifacts remain.
- Confirm no runtime callers remain for removed `setWaypointWorld`-style APIs.

3. Performance validation
- Run horde-scale scenario with debug disabled.
- Compare frame pacing and update cost against pre-change stable-horde baseline.
- Monitor allocation/GC behavior for path array generation cadence.

## Decision Lock (Resolved)

1. Zombie pursuit is in-scope and must use the same tile-array locomotion contract as wander.
2. Guest flee is in-scope and must use the same Bresenham raster execution contract as wander.
3. Blocked traversal uses short local salvage (trim to first blocked tile), then repick.
4. Diagonal movement is allowed (8-way) when sampled tiles are walkable.
5. Visual movement keeps smooth interpolation between discrete tile centers (no hard stutter snapping).
6. Existing recovery controls remain unchanged (`noCandidateStreak`, failed-sector memory, repick cooldown).
7. Performance benchmark is the current stable horde baseline for this project; regression is measured relative to that baseline.
8. Backward-compatible vector-waypoint execution methods are removed immediately; do not keep adapter shims.

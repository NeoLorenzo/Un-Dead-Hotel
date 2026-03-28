# Finding Our Way - Phase 3 Danger Influence and Weighted Pathfinding

## Purpose

Phase 3 builds the danger-aware navigation layer.

This phase creates the low-resolution danger influence map and enables guest pathfinding to account for danger cost when selecting routes.

## Status

- Draft created on **March 28, 2026**.
- Phase 2 weighted mental model is the prerequisite.

## Locked Decisions

1. Influence-map separation
   - Danger influence is a separate data layer from base nav walkability.
2. Resolution model
   - Influence map uses lower resolution than the `0.25` tile movement grid.
3. Cost model
   - Pathfinder uses additive cost (`base traversal + danger penalty`), not walkability mutation.
4. Threat gradient
   - Threat center starts at `+50` and decays toward `+2` at configured edge radius.
5. Compatibility contract
   - When danger weighting is disabled, legacy path behavior remains unchanged.
6. Memory ownership
   - Danger memory remains per-guest only.

## Scope (Locked)

- Implement influence-map runtime service for danger sampling.
- Implement per-guest danger memory feed into influence-map source data.
- Extend sub-tile pathfinding to accept optional danger penalty callbacks.
- Wire guest path requests to consume influence danger penalties.
- Add debug visibility for influence cells, memory points, and weighted-route behavior.

## Non-Goals (Locked)

- No new mental states.
- No major objective-policy redesign.
- No zombie behavior architecture rewrite.
- No final balancing pass beyond proving route-shaping works.

## Technical Design

### Design Summary

1. Gather live and remembered threat points per guest.
2. Build/update low-resolution danger influence grid.
3. Sample influence values during path candidate evaluation.
4. Add sampled penalty to path traversal cost.
5. Return safer path variants when alternatives exist.

### Core File Hooks

- `engine/world/subTilePathfinder.js`
- `apps/phaser/human/guestInfluenceMapService.js`
- `apps/phaser/human/guestDangerMemory.js`
- `apps/phaser/human/humanPerception.js`
- `apps/phaser/phaserRuntimeAdapter.js`
- `apps/phaser/debug/humanDebugOverlay.js`

## Subphase Breakdown

### Phase 3A: Influence Grid Service

- Build world-to-influence coordinate conversion.
- Implement radius gradient propagation and cell sampling.
- Support bounded update cadence.

### Phase 3B: Danger Memory Feed

- Track per-guest live sightings and last-known threat points.
- Apply decay/expiry lifecycle.
- Feed memory points into influence source rebuild.

### Phase 3C: Weighted Path Hook

- Add optional per-cell penalty callback in pathfinder.
- Keep default unweighted behavior when callback is absent.
- Route guest path requests through weighted mode.

### Phase 3D: Debug Validation

- Render influence heat cells.
- Render remembered threat points.
- Show weighted-vs-unweighted route difference in deterministic test setups.

## Acceptance Criteria

1. Influence map is queryable and stable across frames.
2. Memory points survive LOS breaks until expiry.
3. Weighted path mode avoids high-danger corridors when alternatives exist.
4. Unweighted mode remains behaviorally compatible for unaffected systems.
5. Debug overlays clearly expose danger inputs and route impact.

## Canonical Breakdown (Lossless from Master)

- Goal:
  - Build the full danger representation pipeline and wire weighted pathfinding to consume that danger signal.
- Files:
  - `engine/world/subTilePathfinder.js`
  - `apps/phaser/human/humanCommandController.js` (regression verification only)
  - `apps/phaser/human/guestInfluenceMapService.js` (new)
  - `apps/phaser/human/guestDangerMemory.js` (new)
  - `apps/phaser/human/humanPerception.js`
  - `apps/phaser/phaserRuntimeAdapter.js`
- Work:
  - Add optional traversal-penalty callback support in `subTilePathfinder`.
  - Keep default pathfinder behavior unchanged when no penalty callback is provided.
  - Add low-res grid coordinate conversions and world sampling API.
  - Implement radius-based gradient propagation (`+50` center to `+2` edge).
  - Track per-guest threat memory from perception events.
  - Maintain last-known threat position after LOS break.
  - Apply decay/expiry lifecycle and feed live + remembered danger points into influence updates.
  - Feed sampled influence values into weighted path cost for guest path requests.
  - Support bounded incremental update cadence.
- Verification:
  - Existing survivor command paths remain valid when no extra weight is provided.
  - Weighted vs unweighted route differences are observable in controlled danger layouts.
  - Sampling returns expected values at center, mid, and edge distances.
  - Memory survives LOS break and clears only per configured decay/expiry policy.
  - Debug state reflects live vs remembered danger points.
  - Update cadence stays within frame budget during active zombie populations.
- Exit criteria:
  - Danger representation and weighted-path integration are deterministic, queryable, and stable across live/remembered threats.

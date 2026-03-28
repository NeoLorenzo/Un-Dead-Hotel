# Finding Our Way - Phase 4 Brain-to-Movement Integration

## Purpose

Phase 4 connects brain intent to real movement decisions.

This phase makes guest path and waypoint behavior directly follow Phase 2 brain outputs, using the danger-aware pathing produced in Phase 3.

## Status

- Draft created on **March 28, 2026**.
- Prerequisites:
  - Phase 2 weighted mental model complete.
  - Phase 3 danger map + weighted pathfinding complete.

## Locked Decisions

1. Brain authority
   - Brain-selected objective is the source of truth for movement intent.
2. Objective-to-movement contract
   - Objective change can trigger target refresh and path replan.
3. Danger preemption
   - Danger objective may interrupt non-danger movement per locked thresholds.
4. Fallback continuity
   - Existing deterministic fallback/retry behavior remains active.
5. Debug parity
   - Any new integration behavior must be visible in debug in the same subphase.

## Scope (Locked)

- Wire brain objective outputs into actionable waypoint/path requests.
- Integrate seek-shelter, wander, and flee objective planning with manager dispatch.
- Ensure objective transitions update live movement plans safely.
- Ensure weighted danger pathing is used where objective policy requires it.
- Add clear debug diagnostics for objective change -> target selection -> path result.

## Non-Goals (Locked)

- No addition of new brain states beyond current Phase 2 scope.
- No survivor control redesign.
- No zombie planner migration beyond guest decoupling requirements.
- No major performance hardening pass (reserved for next phase).

## Technical Design

### Design Summary

1. Brain evaluator chooses dominant objective intent.
2. Objective planner resolves target candidate.
3. Manager requests weighted/unweighted path per objective policy.
4. Controller receives path and executes movement.
5. Transition/fallback reasons are emitted for debug diagnostics.

### Core File Hooks

- `apps/phaser/human/humanManager.js`
- `apps/phaser/human/guestObjectivePlanner.js`
- `apps/phaser/human/guestSafeZoneIndex.js`
- `apps/phaser/human/humanFleePlanner.js`
- `apps/phaser/phaserApp.js`
- `apps/phaser/debug/humanDebugOverlay.js`
- `apps/phaser/debug/firstContactDiagnosticsPanel.js`

## Subphase Breakdown

### Phase 4A: Objective Dispatch Contract

- Standardize manager contract from brain objective to planner dispatch.
- Record transition reason and current objective metadata.

### Phase 4B: Targeting and Path Request Wiring

- Resolve objective targets (`shelter`, `wander`, `flee`).
- Route requests through weighted pathfinding policy where appropriate.

### Phase 4C: Live Replan and Waypoint Updates

- Trigger replans on objective changes, invalidated targets, and key danger shifts.
- Prevent rapid thrash via hold/preemption gates and retry timing.

### Phase 4D: Integration Debug and Diagnostics

- Show active objective, target, path status, and fallback reason.
- Confirm visible linkage from brain score change to movement/path change.

## Acceptance Criteria

1. Guests visibly change movement behavior when dominant objective changes.
2. Objective transitions produce deterministic path refresh behavior.
3. Flee behavior uses danger-aware routing in threat scenarios.
4. Shelter behavior consistently resolves and follows valid room targets.
5. Debug diagnostics expose complete brain-to-movement decision chain.

## Canonical Breakdown (Lossless from Master)

- Goal:
  - Replace existing guest behavior loop with utility + influence-driven orchestration and finish any remaining objective-planner work from prior phase slices.
- Files:
  - `apps/phaser/human/guestObjectivePlanner.js` (new)
  - `apps/phaser/human/guestSafeZoneIndex.js` (new)
  - `apps/phaser/human/humanFleePlanner.js` (refactor if retained)
  - `apps/phaser/human/humanManager.js`
  - `apps/phaser/phaserApp.js`
- Work:
  - Use Phase 2 weighted mental-model output as the objective intent source.
  - Complete remaining objective-planner/utility carryover work where still open:
    - objective transition recording consistency,
    - danger growth/decay integration with objective selection.
  - Ensure seek-shelter chooses nearest valid safe-zone anchor.
  - Keep wander as low-priority fallback behavior.
  - Ensure flee planner generates evasive goals with weighted path selection.
  - Remove guest reliance on `createZombieWanderPlanner` for primary behavior.
  - Integrate perception -> memory -> influence -> utility -> objective -> path pipeline.
  - Preserve survivor conversion and selection/control boundaries.
- Verification:
  - Shelter objective produces valid room-directed paths.
  - Flee objective routes avoid high-influence corridors when alternatives exist.
  - Guests no longer call zombie-wander planner for behavioral decision making.
  - Runtime remains stable under mixed populations.
- Exit criteria:
  - Guest behavior architecture is decoupled, objective-complete, and functional.

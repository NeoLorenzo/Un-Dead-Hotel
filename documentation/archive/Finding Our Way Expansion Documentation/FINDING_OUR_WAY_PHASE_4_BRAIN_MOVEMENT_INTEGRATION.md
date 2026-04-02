# Finding Our Way - Phase 4 Brain-to-Movement Integration

## Purpose

Phase 4 finalizes the guest brain system by making brain objective output the authoritative driver of real locomotion behavior.

This phase closes the remaining gap between:

- Phase 2 decision intent (weighted objective arbitration), and
- Phase 1/3 movement execution (controller path following + danger response).

## Status

- Draft created on **March 28, 2026**.
- Scope rewrite and rigor lock updated on **March 31, 2026**.
- **Phase 4 completed on March 31, 2026**.
- Prerequisites:
  - Phase 1 locomotion contract complete.
  - Phase 2 weighted mental model complete.
  - Phase 3 danger memory and danger movement response complete.

## Completion Summary (March 31, 2026)

1. Objective authority and dispatch contract completed
   - canonical objective dispatch and standardized path-feedback envelope shipped.
2. Shelter objective completed as real safe-zone behavior
   - shelter resolves explicit room anchors through guest safe-zone indexing.
3. Guest planning ownership decoupled from zombie planner internals
   - guest wander planning is guest-owned (`guestWanderPlanner`).
4. Danger dispatch consolidated under objective planner contract
   - room-egress-first + local danger candidate fallback behavior preserved.
5. Replan trigger matrix and feedback-loop resilience completed
   - reason-coded replans, deterministic failure reasons, and fallback coupling shipped.
6. Debug/diagnostics parity delivered
   - objective, dispatch, target, path state, failure reason, feedback, and aggregates exposed.
7. Post-integration corrections finalized
   - phantom danger-target regression fixed (invalid remembered threat no longer normalizes to `(0,0)`).
   - shelter completion handoff to wander added (`shelter_satisfied`) when in-room and low-danger.
   - danger objective priority override added (`danger_priority_override`).
   - shelter target exclusion for danger-marked rooms added.

## Finalization Definition (Locked)

Phase 4 is complete only when all of the following are true:

1. Brain authority is real, not advisory
   - guest movement planning starts from `evaluation.objectiveState` and never from hard-coded mode branching as primary source.
2. Objective completeness exists for all active Phase 2 states
   - `danger`, `shelter`, and `wander` each have explicit movement dispatch behavior.
3. Shelter is no longer a proxy alias
   - `shelter` resolves a concrete safe-zone target policy, not generic wander-only behavior.
4. Movement feedback closes the loop
   - planner/controller success/failure feeds deterministic `pathFeedback` back into brain fallback/retry logic.
5. Guest planning ownership is decoupled
   - guest primary objective planning no longer depends on zombie wander planner internals.
6. Full decision chain is debug-visible
   - objective transition -> dispatch strategy -> target -> path status -> fallback reason is inspectable live.

## Locked Decisions

1. Objective authority
   - The selected brain objective is the sole source of guest objective intent.
2. Active objective set
   - Phase 4 only dispatches `danger`, `shelter`, and `wander`.
   - `thirst` and `hunger` remain disabled and non-dispatching.
3. Inherited arbitration contract
   - Phase 2 hold/preemption/fallback thresholds remain unchanged in this phase.
4. Danger behavior continuity
   - Phase 3 danger room-egress and local danger candidate logic remain authoritative for `danger`.
5. Dispatch determinism
   - Objective-to-planner dispatch must be deterministic for equivalent inputs and geometry.
6. Replan determinism
   - Replan causes are explicit and reason-coded; hidden/implicit replans are disallowed.
7. Feedback loop contract
   - Planner/controller outcomes must be emitted as structured path feedback to brain evaluation.
8. Shelter target policy
   - `shelter` chooses nearest valid safe-zone anchor from a guest-owned safe-zone index.
9. Wander policy
   - `wander` remains low-priority fallback objective and never overrides active `danger`.
10. Failure policy continuity
    - Existing fallback timers stay locked:
    - `dangerRetrySeconds = 0.25`
    - `shelterRetrySeconds = 0.75`
11. Danger cadence continuity
    - `danger` replan cadence remains `0.35s` unless immediate invalidation trigger fires.
12. Controller handoff contract
    - Movement handoff is via controller world-path APIs; no new locomotion controller rewrite in this phase.
13. Decoupling requirement
    - Guest behavior loop must not rely on `createZombieWanderPlanner` for primary objective planning at phase exit.
14. Config ownership
    - Tunables and policy wiring are owned in `apps/phaser/phaserApp.js` and injected into manager/planner modules.
15. Debug parity gate
    - Every new integration behavior must ship with debug visibility in the same subphase.
16. Performance safety gate
    - Phase 4 must remain within `<= 3%` FPS regression versus post-Phase-3 baseline with debug off.

## Scope (Locked)

- Make objective dispatch (`danger` / `shelter` / `wander`) authoritative from brain output to movement plan.
- Add explicit objective planner layer for:
  - objective-to-target selection,
  - target validity checks,
  - planner strategy selection.
- Implement shelter target resolution against stable safe-zone indexing.
- Replace guest use of zombie wander planner internals with guest-owned planner logic.
- Add path-feedback bridge from movement planner/controller results into mental-model fallback handling.
- Standardize objective path status and reason-code taxonomy.
- Add debug/diagnostics visibility for full brain-to-locomotion pipeline.

## Non-Goals (Locked)

- No new mental states or score model changes.
- No thirst/hunger gameplay enablement.
- No survivor command/control redesign.
- No zombie architecture migration.
- No global danger influence-map reintroduction in this phase.
- No `subTilePathfinder` weighted traversal-cost rollout in this phase.
- No large hardening/polish expansion beyond integration safety gates.

## Technical Design

### Design Summary

1. Brain evaluates per guest and emits objective intent.
2. Objective dispatch maps intent to a planner strategy.
3. Objective planner resolves target and path request.
4. Controller receives world path and executes locomotion.
5. Planner/controller outcome emits standardized path feedback.
6. Brain arbitration consumes feedback for deterministic fallback/retry behavior.
7. Debug surfaces expose the full decision chain.

### Objective Dispatch Contract (Locked)

| Brain Objective | Dispatch Mode | Primary Planner Strategy | Replan Cadence | Failure Sink |
|---|---|---|---|---|
| `danger` | `danger_room_egress` or `danger_flee` | Phase 3 room-door egress first, then danger candidate scoring | `0.35s` + invalidation triggers | Brain fallback via danger retry contract |
| `shelter` | `shelter` | nearest valid safe-zone anchor selection + path assignment | event-driven + failure retry policy | Brain fallback to temporary wander, shelter retry in `0.75s` |
| `wander` | `wander` | guest-owned wander target selection | event-driven | remains wander with deterministic retry behavior |

Dispatch rule lock:

1. Room-danger override may elevate non-danger objective to danger dispatch when Phase 3 room-danger trigger is active.
2. Dispatch mode and reason code must be captured each planning cycle.

### Replan Trigger Contract (Locked)

Replan must occur when any of the following is true:

1. Objective changed from previous cycle.
2. Current path is absent for active objective.
3. Controller emits blocked-path event.
4. Objective target becomes invalid/unreachable.
5. Danger room-egress applicability toggles while in danger.
6. Objective-specific cadence timer expires.

Replan must not occur when:

1. Objective unchanged,
2. path remains valid/followable,
3. no invalidation trigger is active,
4. and objective cadence timer has not expired.

### Planner Feedback Contract (Locked)

Every objective planning attempt must emit one feedback envelope:

```js
{
  status: "success" | "failure" | "none",
  reason: string | null,
  objectiveState: "danger" | "shelter" | "wander" | null,
  dispatchMode: string | null,
  targetWorld: { x: number, y: number } | null
}
```

Feedback usage lock:

1. `success` must clear objective failure reason for that cycle.
2. `failure` must set deterministic failure reason and feed mental-model fallback contract.
3. `none` is allowed only when no planning was required.

### Shelter Targeting Contract (Locked)

1. Safe-zone source
   - shelter candidates are derived from room/safe-zone world metadata via a dedicated guest index.
2. Anchor policy
   - each safe zone exposes at least one stable walkable anchor point.
3. Selection order
   - candidates are sorted by linear world-distance from guest; planner attempts in deterministic order.
4. Path validation
   - first candidate with accepted path assignment wins.
5. Failure handling
   - if no valid safe-zone target/path is found, emit explicit shelter failure reason and rely on locked brain fallback contract.
6. Arrival handling
   - reaching shelter target is resolved by brain arbitration, with explicit shelter completion handoff (`shelter_satisfied`) when guest is in-room and danger signal is low.

### Configuration Ownership (Locked)

1. Runtime composition in `apps/phaser/phaserApp.js` owns active tunables/policy injection.
2. Planner modules may provide safe defaults only.
3. Inherited Phase 2/3 constants remain authoritative unless explicitly replaced in this phase doc:
   - `minimumHoldSeconds = 0.75`
   - `dangerPreemption.scoreThreshold = 0.70`
   - `dangerPreemption.scoreMargin = 0.15`
   - `objectiveFailureFallback.dangerRetrySeconds = 0.25`
   - `objectiveFailureFallback.shelterRetrySeconds = 0.75`
   - `dangerReplanSeconds = 0.35`

### Required Debug Payload Schema (Locked)

Per-guest debug payload must include:

```js
guest.debug.objectiveIntent = {
  objectiveState: "danger" | "shelter" | "wander",
  objectiveDispatchMode: string,         // "danger_room_egress" | "danger_flee" | "shelter" | "wander"
  objectiveReasonCode: string | null,    // arbitration/override reason
  objectivePathStatus: "idle" | "valid" | "following_path" | "retrying",
  objectiveFailureReason: string | null,
  objectiveTargetWorld: { x: number, y: number } | null,
  replanCooldownSeconds: number          // >= 0
};

guest.debug.pathFeedback = {
  status: "success" | "failure" | "none",
  reason: string | null,
  objectiveState: string | null,
  dispatchMode: string | null
};
```

Diagnostics panel must also expose aggregate counts:

1. guests by objective state (`danger`, `shelter`, `wander`)
2. guests by dispatch mode
3. guests with `objectivePathStatus = retrying`
4. planner replans attempted/succeeded/failed
5. shelter-target resolution failures (count + top reason)

### Core File Hooks

- `apps/phaser/human/humanManager.js`
- `apps/phaser/human/guestObjectivePlanner.js` (new)
- `apps/phaser/human/guestSafeZoneIndex.js` (new)
- `apps/phaser/human/guestWanderPlanner.js` (new)
- `apps/phaser/human/guestMentalModel.js`
- `apps/phaser/human/humanPerception.js`
- `apps/phaser/phaserRuntimeAdapter.js`
- `apps/phaser/phaserApp.js`
- `apps/phaser/debug/humanDebugOverlay.js`
- `apps/phaser/debug/firstContactDiagnosticsPanel.js`

## Subphase Breakdown

### Phase 4A: Contract Lock and Integration Skeleton

- Status:
  - Complete on **March 31, 2026**.
- Goal:
  - lock objective-dispatch and path-feedback contracts in code-level interfaces before behavior rewiring.
- Primary files:
  - `apps/phaser/human/humanManager.js`
  - `apps/phaser/human/guestObjectivePlanner.js` (new)
  - `apps/phaser/phaserApp.js`
- Work:
  - add canonical objective dispatch interface (`dispatchObjectivePlan(...)`).
  - add standardized `pathFeedback` envelope and reason-code catalog.
  - centralize policy/tunables injection points in runtime composition.
- Exit criteria:
  1. Brain objective dispatch contract is represented by one canonical interface.
  2. Path feedback envelope schema is emitted on every planning cycle.
  3. Reason-code taxonomy is deterministic and documented in-code.
  4. No duplicated one-off dispatch branches remain in manager update flow.

### Phase 4B: Shelter Objective Completion

- Status:
  - Complete on **March 31, 2026**.
- Goal:
  - convert shelter from proxy-wander behavior into explicit safe-zone targeting.
- Primary files:
  - `apps/phaser/human/guestSafeZoneIndex.js` (new)
  - `apps/phaser/human/guestObjectivePlanner.js`
  - `apps/phaser/human/humanManager.js`
  - `apps/phaser/phaserRuntimeAdapter.js`
- Work:
  - build safe-zone index from room metadata.
  - compute deterministic safe-zone anchors.
  - dispatch shelter objective through safe-zone target resolution and path assignment.
  - emit shelter-specific failure reasons for fallback consumption.
- Exit criteria:
  1. Shelter objective resolves valid room-directed targets in representative maps.
  2. Guests path toward selected shelter target when shelter dominates.
  3. Shelter failure reasons are explicit and feed locked fallback behavior.
  4. Shelter objective no longer aliases generic wander dispatch.

### Phase 4C: Guest Wander Planner Decoupling

- Status:
  - Complete on **March 31, 2026**.
- Goal:
  - remove guest behavior dependency on zombie wander planner internals.
- Primary files:
  - `apps/phaser/human/guestWanderPlanner.js` (new)
  - `apps/phaser/human/guestObjectivePlanner.js`
  - `apps/phaser/human/humanManager.js`
- Work:
  - migrate/replace guest wander candidate generation into guest-owned planner module.
  - preserve deterministic retry/recovery behavior already used by guests.
  - keep guest planner API isolated from zombie module internals.
- Exit criteria:
  1. Guest primary planning path does not call `createZombieWanderPlanner`.
  2. Wander selection behavior remains deterministic for equivalent seeds/setup.
  3. Existing recovery/repick semantics remain behaviorally compatible.
  4. No regression to survivor/zombie planning ownership boundaries.

### Phase 4D: Danger Dispatch Consolidation

- Status:
  - Complete on **March 31, 2026**.
- Goal:
  - ensure Phase 3 danger logic runs as explicit objective-dispatch strategy under the Phase 4 contract.
- Primary files:
  - `apps/phaser/human/guestObjectivePlanner.js`
  - `apps/phaser/human/humanManager.js`
  - `apps/phaser/human/guestDangerMemory.js`
- Work:
  - move danger dispatch through objective planner entrypoints.
  - preserve room-egress-first behavior and local danger candidate scoring.
  - standardize danger success/failure feedback reasons for brain fallback path.
- Exit criteria:
  1. Danger room-egress and candidate scoring are still active and unchanged in policy.
  2. Danger dispatch emits contract-compliant path feedback every attempt.
  3. Danger replans respect locked `0.35s` cadence + invalidation triggers.
  4. Danger fallback/retry behavior remains deterministic and debug-visible.

### Phase 4E: Objective Transition and Movement-Feedback Resilience

- Status:
  - Complete on **March 31, 2026**.
- Goal:
  - make objective transitions and movement replans robust under live runtime changes.
- Primary files:
  - `apps/phaser/human/humanManager.js`
  - `apps/phaser/human/guestMentalModel.js`
  - `apps/phaser/human/humanController.js` (integration touch only)
- Work:
  - enforce replan trigger matrix across objective changes, path invalidation, and blocked events.
  - guarantee controller blocked-path events map to deterministic failure reasons.
  - ensure mental-model fallback pipeline consumes path feedback without drift.
- Exit criteria:
  1. Transition-driven replans occur exactly when trigger matrix requires.
  2. Stable-path guests do not thrash replans without trigger cause.
  3. Blocked/invalid path events produce deterministic objective failure outcomes.
  4. Brain fallback timers/retry counters remain coherent with emitted feedback.

### Phase 4F: Debug and Diagnostics Parity

- Status:
  - Complete on **March 31, 2026**.
- Goal:
  - expose complete brain-to-locomotion cause chain for inspected guest and aggregates.
- Primary files:
  - `apps/phaser/debug/humanDebugOverlay.js`
  - `apps/phaser/debug/firstContactDiagnosticsPanel.js`
  - `apps/phaser/human/humanManager.js`
- Work:
  - render objective, dispatch mode, target, path status, failure reason, and path feedback.
  - add aggregate objective/dispatch/retry/replan counters.
  - add shelter-target resolution diagnostics.
- Exit criteria:
  1. Required debug payload schema is fully populated for inspected guest.
  2. Overlay updates in real time as objective and path state changes.
  3. Diagnostics aggregates are consistent with observed world behavior.
  4. Every new Phase 4 mechanic is inspectable in debug during same subphase.

## AI Headless Acceptance Criteria

1. Brain objective state is the primary source for guest objective dispatch every behavior cycle.
2. Only `danger`, `shelter`, and `wander` dispatch to locomotion in this phase.
3. Shelter objective resolves explicit safe-zone target(s) and no longer uses shelter-proxy-wander behavior.
4. Danger objective preserves Phase 3 room-egress-first behavior when room-danger conditions apply.
5. Danger objective preserves Phase 3 local candidate scoring and deterministic tie-break behavior.
6. Guest primary planning no longer depends on `createZombieWanderPlanner`.
7. Objective dispatch mode and reason code are emitted deterministically each planning cycle.
8. Replan trigger matrix is enforced (objective change, path missing, blocked event, invalid target, cadence expiry).
9. No unnecessary replans are issued when no trigger is active and path remains valid.
10. Planner/controller outcomes emit contract-compliant path feedback (`success`/`failure`/`none`).
11. `failure` feedback consistently drives locked Phase 2 fallback/retry rules.
12. `danger` fallback retry timing remains `0.25s`; `shelter` fallback retry timing remains `0.75s`.
13. `danger` replan cadence remains `0.35s` unless immediate invalidation trigger applies.
14. Objective path status (`idle`/`valid`/`following_path`/`retrying`) is coherent with runtime behavior.
15. Debug payload fields required by this doc are present and non-null where contract requires values.
16. Diagnostics panel objective/dispatch/replan counters match runtime state snapshots.
17. Survivor controls, conversion behavior, and non-guest control flow remain behaviorally compatible.
18. Runtime performance regression stays within `<= 3%` FPS versus post-Phase-3 baseline with debug off.

## AI Headless Validation Checklist

1. Objective authority checks
   - force objective transitions (`wander -> shelter -> danger`) and verify dispatch mode follows brain objective.
2. Shelter resolution checks
   - run room-rich map cases to confirm nearest valid safe-zone targeting and path acceptance.
3. Shelter failure checks
   - run no-safe-zone / blocked-safe-zone scenarios and verify deterministic failure reason + fallback retry timing.
4. Danger integration checks
   - run in-room danger case to verify doorway-egress dispatch before generic danger flee dispatch.
5. Decoupling checks
   - static code scan confirms guest primary planner path has no `createZombieWanderPlanner` dependency.
6. Replan trigger checks
   - validate replan behavior for each trigger and validate no-trigger stability case.
7. Path feedback checks
   - validate `success`, `failure`, and `none` feedback envelopes and reason-code consistency.
8. Fallback timer checks
   - verify `danger` retry (`0.25s`) and `shelter` retry (`0.75s`) in repeated fail/recover scenarios.
9. Diagnostics consistency checks
   - compare aggregate counters against sampled per-guest states in deterministic snapshots.
10. Performance comparison pass
    - compare post-Phase-3 baseline vs Phase-4-integrated runtime with debug disabled.

## Player Debug-Observation Acceptance Criteria

1. You can observe objective state and dispatch mode changing in sync with brain transitions.
2. You can see exactly which world target was chosen for each active objective.
3. You can see path status (`idle`, `valid`, `following_path`, `retrying`) match actual movement behavior.
4. You can see explicit failure reasons when path planning fails.
5. Shelter-dominant guests visibly move toward room/safe-zone targets rather than generic wander points.
6. Danger-in-room behavior visibly chooses doorway-egress before local flee behavior.
7. Objective retry/fallback timing behavior is visible and coherent in debug readouts.
8. Aggregate diagnostics counters reflect what is happening on screen.

## Player Debug-Observation Checklist

1. When dominant objective changes, does dispatch mode change immediately and correctly?
2. During shelter objective, do guests target room/safe-zone anchors instead of random roam points?
3. If shelter target/path fails, do you see explicit shelter failure reason and fallback/retry behavior?
4. In danger while inside a room, do guests attempt doorway egress first?
5. Do danger replans happen at expected cadence while threat pressure remains active?
6. When path gets blocked, do you see retrying state with a deterministic reason code?
7. When path is healthy and no trigger exists, do guests continue following path without repeated replans?
8. Do overlay fields for objective, dispatch, target, and failure reason update in real time?
9. Do panel aggregates for objective counts and retrying counts align with observed agents?

## Deferred Follow-Up (Post-Ship Backlog)

- Performance hardening beyond the `<= 3%` safety gate.
- Optional reintroduction of global influence-map and weighted path cost if local+objective integration proves insufficient.
- Additional objective polish and tuning after phase-exit validation data is collected.

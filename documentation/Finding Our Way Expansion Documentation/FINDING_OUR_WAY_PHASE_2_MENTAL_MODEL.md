# Finding Our Way - Phase 2 Weighted Guest Mental Model Implementation Plan

## Purpose

Phase 2 defines and implements a modular weighted guest brain model that replaces static flee/wander switching with state scoring and objective selection.

This phase introduces five initial guest mental states:

- `wander`
- `shelter`
- `danger`
- `thirst`
- `hunger`

The brain must support adding more states and inputs later without rewriting the core evaluator.

## Status

- Draft created on **March 27, 2026**.
- Phase 1 locomotion prerequisite completed on **March 21, 2026**.

## Locked Decisions

1. Memory ownership
   - Danger memory and all other guest memory models are **per-guest only**.
   - No shared global guest memory in this phase.
2. Brain architecture
   - Brain uses weighted scoring per state from a modular input set.
   - Initial state set is fixed to five states: `wander`, `shelter`, `danger`, `thirst`, `hunger`.
3. Debug UX
   - In debug mode, `Alt + Left Click` on a guest opens that guest's brain model panel.
   - Preferred panel placement is top-right of screen.
   - Panel visual style is neural-net-like and displays inputs, weights, and resulting state scores.
4. Initial environment semantics
   - Corridors are treated as danger-prone area input.
   - Rooms are treated as safe/shelter area input.
   - Doorway tiles are treated as `room` if they are part of a room prefab.
5. Danger-map distance input
   - Input slot exists now for zombie-distance-from-danger-map signal.
   - This signal may be stubbed/empty in Phase 2 if map is not yet implemented.
6. Input normalization and inactive-input behavior
   - Every brain input is normalized to `[0, 1]`.
   - Any inactive/unwired input is a constant `0`.
7. Disabled state behavior
   - `thirst` and `hunger` are visible in the debug model but disabled/greyed out in Phase 2.
   - Disabled states are excluded from dominant-state winner selection.
8. Scoring contract
   - `score_raw(state) = stateBias + sum(stateWeight[input] * inputValue)`.
   - `score(state) = clamp(score_raw, 0, 1)`.
9. Deterministic arbitration
   - Winner is the highest enabled-state score.
   - Tie-break order is fixed: `danger`, `shelter`, `wander`, `thirst`, `hunger`.
10. Anti-thrash and preemption
   - Minimum objective hold time is `0.75s` for non-danger states.
   - `danger` may preempt hold when `dangerScore >= 0.70` and `(dangerScore - currentScore) >= 0.15`.
11. Pathing fallback rules
   - `danger` objective path failure: assign short evasive local movement and retry in `0.25s`.
   - `shelter` objective path failure: fallback to temporary wander and retry shelter in `0.75s`.
12. Runtime cadence
   - Brain evaluation cadence is `4Hz` per guest (`0.25s` interval) with staggered updates.
   - Debug panel refresh cadence is `10Hz`.
13. Brain memory lifecycle
   - Per-guest brain runtime state resets on guest death, despawn, and guest-to-survivor conversion.
14. Config versioning
   - Brain config includes `brainConfigVersion`, starting at `1`.
15. Debug parity requirement
   - Any new behavior/mechanic introduced in a subphase must ship with its corresponding debug visibility in the same subphase.
   - No subphase is considered complete if the new logic is not inspectable in live debug mode.

## Scope (Locked)

- Add a modular guest brain evaluator that computes per-state scores on a fixed scheduled cadence.
- Compute strongest-state winner and use it as guest behavioral intent.
- Add brain input plumbing for:
  - current HP (normalized),
  - current area classification (`in_corridor` / `in_room`),
  - placeholder danger-distance input slot,
  - placeholder thirst and hunger inputs.
- Integrate brain output into guest behavior selection in `humanManager`.
- Keep all memory state attached per guest ID.
- Add debug rendering for selected-guest brain graph in top-right.
- Add diagnostics payload for brain scores and selected dominant state.

## Non-Goals (Locked)

- No full danger influence map implementation in this phase.
- No full thirst/hunger simulation gameplay systems in this phase.
- No shelter scoring based on final safe-zone index yet; use room/corridor semantics first.
- No survivor control, selection, or command changes.
- No zombie brain migration.

## Current Problem Statement

Guest behavior is currently driven by narrow mode switching (`flee` vs `wander`) and planner-specific logic. This limits extensibility and makes it hard to add richer needs (shelter, hunger, thirst, danger response) in a consistent way.

Phase 2 establishes one modular brain evaluator so behavior intent comes from comparable weighted state scores rather than hard-coded branching.

## Technical Design

### Design Summary

Each guest receives a scheduled brain evaluation:

1. Collect normalized inputs for that guest.
2. Score each mental state with linear weighted scoring plus bias.
3. Clamp each state score to `[0, 1]`.
4. Select dominant state with deterministic tie-break, anti-thrash, and danger preemption rules.
5. Translate dominant state into current objective (`wander`, `seek_shelter`, `flee`-style behavior now; thirst/hunger objective hooks later).

### Core Data Model

- `guestBrainConfig`
  - `brainConfigVersion`: integer schema/version marker.
  - `states`: ordered list of state IDs.
  - `inputs`: ordered list of input feature IDs.
  - `stateWeights[stateId][inputId]`: scalar weight table.
  - `stateBias[stateId]`: baseline per-state bias.
  - `stateClamp[stateId]`: min/max (`0..1` for Phase 2).
  - `disabledStates`: state IDs excluded from winner selection.
  - `tieBreakOrder`: fixed ordered list used for equal-score ties.
  - `minimumHoldSeconds`: default non-danger hold window.
  - `dangerPreemption`: threshold delta policy.
- `guestBrainRuntimeState` (per guest)
  - `lastScoresByState`
  - `lastDominantState`
  - `dominantStateHoldSeconds`
  - `lastObjectiveFailureReason`
  - optional transition counters for debug/diagnostics.

### Initial Inputs (Phase 2)

- Input range contract: all input values are normalized to `[0, 1]`.
- Inactive input contract: inactive/unwired inputs evaluate to constant `0`.
- `hp_normalized`
- `in_corridor` (`0` or `1`)
- `in_room` (`0` or `1`)
- `danger_distance_signal` (stub allowed in Phase 2 and defaults to `0` while inactive)
- `thirst_signal` (stub allowed in Phase 2 and defaults to `0` while inactive)
- `hunger_signal` (stub allowed in Phase 2 and defaults to `0` while inactive)

### Initial State Behaviors (Phase 2)

- `wander`
  - low-priority default roaming.
- `shelter`
  - seek nearest room when room preference dominates.
- `danger`
  - override to evasive behavior when danger dominates.
- `thirst`
  - disabled/greyed out in Phase 2; visible in debug model only.
- `hunger`
  - disabled/greyed out in Phase 2; visible in debug model only.

### Objective Arbitration Rules

- Winner is highest enabled-state score.
- Disabled states (`thirst`, `hunger`) are excluded from winner selection in Phase 2.
- Tie-break uses fixed order: `danger`, `shelter`, `wander`, `thirst`, `hunger`.
- Apply minimum hold window of `0.75s` for non-danger states.
- `danger` may preempt hold only when:
  - `dangerScore >= 0.70`, and
  - `dangerScore - currentStateScore >= 0.15`.
- If objective pathing fails, fallback rules are deterministic and recorded in debug reason codes:
  - `danger` fail -> short evasive local movement, retry in `0.25s`.
  - `shelter` fail -> temporary wander, retry shelter in `0.75s`.

### Runtime Cadence (Phase 2)

- Brain evaluation runs at `4Hz` per guest (`0.25s` interval), staggered across guests.
- Debug panel refresh runs at `10Hz`.

## File-Level Implementation Plan

1. `apps/phaser/human/guestMentalModel.js` (new)
   - Brain config schema, scoring function, dominant-state selection, transition reasons.
2. `apps/phaser/human/guestMentalModelInputs.js` (new)
   - Input extraction and normalization from controller/perception/runtime context.
3. `apps/phaser/human/humanManager.js`
   - Replace simple flee/wander mode choice with mental-model result wiring.
   - Store per-guest mental runtime state and transitions.
4. `apps/phaser/human/humanPerception.js`
   - Expose any missing perception metadata needed by input feature extraction.
5. `apps/phaser/phaserRuntimeAdapter.js`
   - Add helper APIs to classify room/corridor context for a world point.
6. `apps/phaser/debug/humanDebugOverlay.js`
   - Render selected guest brain neural-net panel in top-right.
   - Show inputs, weighted links, per-state scores, dominant state.
7. `apps/phaser/debug/firstContactDiagnosticsPanel.js`
   - Add aggregate guest mental-state distribution and transition metrics.
8. `apps/phaser/phaserApp.js`
   - Add Phase 2 config/tuning injection for brain weights and thresholds.
9. `documentation/`
   - Sync architecture docs after implementation.

## Detailed Phase Breakdown

### Phase 2A: Brain Contract and Config Lock

- Goal:
  - Lock state/input schema and default weight table for the five-state model.
- Primary files:
  - `apps/phaser/human/guestMentalModel.js` (contract/types/constants only in this phase)
  - `apps/phaser/phaserApp.js` (default config injection)
  - `documentation/Finding Our Way Expansion Documentation/FINDING_OUR_WAY_PHASE_2_MENTAL_MODEL.md`
- Work:
  - Define `guestBrainConfig` shape including:
    - `brainConfigVersion`,
    - `states`,
    - `inputs`,
    - `stateWeights`,
    - `stateBias`,
    - `stateClamp`,
    - `disabledStates`,
    - `tieBreakOrder`,
    - `minimumHoldSeconds`,
    - `dangerPreemption`.
  - Lock default values for all numeric thresholds and timing constants already agreed in this doc.
  - Add strict config validation and fail-fast errors for malformed tables.
  - Add one canonical config-construction helper so all runtime code uses the same contract.
- Verification:
  - Config validator rejects malformed/missing fields.
  - Tie-break order is deterministic and documented exactly once.
  - Defaults load with no implicit fallback behavior.
- Exit criteria:
  - Brain config contract is finalized and documented.

### Phase 2B: Per-Guest Brain Engine Core

- Goal:
  - Implement score evaluation data path without behavior dispatch coupling.
- Primary files:
  - `apps/phaser/human/guestMentalModel.js`
  - `apps/phaser/human/humanManager.js` (state storage hookup only)
- Work:
  - Implement linear scoring:
    - `score_raw = bias + sum(weight * input)`,
    - `score = clamp(score_raw, 0, 1)`.
  - Implement dominant-state selection over enabled states only.
  - Implement deterministic tie-break using locked order.
  - Implement per-guest runtime state initialization/reset API:
    - creation,
    - tick update,
    - reset on death/despawn/conversion.
  - Emit structured debug payload:
    - per-state scores,
    - dominant state,
    - disabled/enabled state set.
- Verification:
  - Fixture tests show deterministic scoring for same inputs/config.
  - Disabled `thirst`/`hunger` never win winner selection.
  - Runtime reset API clears per-guest memory correctly.
- Exit criteria:
  - Engine returns stable state scores and deterministic dominant state for each guest.
  - Score outputs are visible in debug data for inspected guests.

### Phase 2C: Input Pipeline and Environment Context

- Goal:
  - Feed HP, room/corridor context, and placeholder signals into the brain.
- Primary files:
  - `apps/phaser/human/guestMentalModelInputs.js`
  - `apps/phaser/human/humanPerception.js`
  - `apps/phaser/phaserRuntimeAdapter.js`
  - `apps/phaser/debug/humanDebugOverlay.js` (immediate parity rendering)
- Work:
  - Build input adapter that returns normalized `[0,1]` values for all configured inputs.
  - Implement room/corridor classification helper APIs in runtime adapter.
  - Enforce doorway rule in classifier: doorway tile belonging to room prefab => `in_room = 1`.
  - Wire inactive input policy:
    - unwired/stubbed inputs resolve to `0`,
    - no `NaN`/undefined propagation.
  - Add immediate debug fields for:
    - `in_room`,
    - `in_corridor`,
    - doorway-as-room classification decision.
- Verification:
  - Input adapter never emits values outside `[0,1]`.
  - Inactive signals are always `0`.
  - Doorway sample cases classify as room in both logic and debug output.
- Exit criteria:
  - Input vector is complete and modular for future feature growth.
  - Room/corridor classification logic is visible in debug at the same time it is introduced.

### Phase 2D: Arbitration, Preemption, and Fallback Wiring

- Goal:
  - Lock behavior-selection safety logic before runtime integration.
- Primary files:
  - `apps/phaser/human/guestMentalModel.js`
  - `apps/phaser/human/humanManager.js` (arbitration state bridge)
  - `apps/phaser/debug/humanDebugOverlay.js` (reason/timer fields)
- Work:
  - Implement hold-window enforcement (`0.75s` non-danger).
  - Implement danger preemption gate:
    - threshold `>= 0.70`,
    - margin `>= 0.15`.
  - Implement fallback transition state machine:
    - danger path fail => short evade + retry timer `0.25s`,
    - shelter path fail => temporary wander + retry timer `0.75s`.
  - Track and emit arbitration metadata:
    - winner reason,
    - preemption gate status,
    - fallback reason,
    - retry timer,
    - retry count.
- Verification:
  - Synthetic scenarios verify hold-window and preemption boundaries.
  - Fallback path-fail scenarios produce locked retry timings.
  - Debug payload contains complete reason/timer fields for every arbitration result.
- Exit criteria:
  - Arbitration decisions are deterministic and match locked thresholds/timers.
  - Arbitration/fallback decisions are inspectable in debug without additional tooling.

### Phase 2E: Human Manager Integration and Immediate Intent Debug

- Goal:
  - Replace static guest behavior switching with dominant-state-driven intent.
- Primary files:
  - `apps/phaser/human/humanManager.js`
  - `apps/phaser/human/humanFleePlanner.js` (if objective dispatch contract requires adaptation)
  - `apps/phaser/debug/humanDebugOverlay.js`
- Work:
  - Wire brain evaluation into guest behavior tick on the locked cadence.
  - Map `wander`, `shelter`, and `danger` to current actionable objectives.
  - Keep `thirst`/`hunger` disabled and excluded from objective dispatch.
  - Consume arbitration/fallback outputs from Phase 2D.
  - Expose objective intent in debug (active objective, selected target, path status).
  - Remove any remaining hard-coded flee/wander branch ownership from primary decision path.
- Verification:
  - Guest decision loop runs from brain output in mixed-population runtime.
  - Objective dispatch respects disabled states.
  - Objective intent debug values match actual runtime actions.
- Exit criteria:
  - Guest behavior mode is determined by brain output, not hard-coded flee/wander branch logic.
  - Runtime behavior remains stable.
  - Objective intent logic is visible in debug in the same subphase it is integrated.

### Phase 2F: Debug Panel Foundation

- Goal:
  - Deliver the minimum inspectable brain panel.
- Primary files:
  - `apps/phaser/debug/humanDebugOverlay.js`
  - `apps/phaser/phaserApp.js` (input routing for inspect interaction if needed)
- Work:
  - On `Alt + Left Click` guest in debug mode, render top-right neural-net panel.
  - Display input values, weighted edges, per-input contribution values, per-state scores, and dominant state.
  - Display disabled states (`thirst`, `hunger`) as greyed out.
  - Add clear empty/invalid states for:
    - no inspected guest,
    - dead/despawned guest,
    - missing debug payload.
- Verification:
  - Guest inspect selection is deterministic and does not break survivor controls.
  - Panel updates at `10Hz` and reflects latest `4Hz` brain tick state.
  - Disabled states consistently render greyed out.
- Exit criteria:
  - Core panel interaction and render path are stable and low-overhead.

### Phase 2G: Debug Decision-Cause Diagnostics

- Goal:
  - Expose why and when the selected state changes.
- Primary files:
  - `apps/phaser/debug/humanDebugOverlay.js`
  - `apps/phaser/human/guestMentalModel.js` (explainability payload fields)
- Work:
  - Add "Why this won" line with top 3 contribution terms for dominant state.
  - Add live timer badges for hold time and danger preemption gate status.
  - Add fallback diagnostics: last objective failure reason, retry timer, retry count.
  - Add objective transition reason codes (`threshold_crossed`, `hold_expired`, `preempted`, `fallback`).
- Verification:
  - Top contribution list matches computed contribution table.
  - Timer badges track hold/preemption/retry state without drift.
  - Transition reason codes line up with actual objective changes.
- Exit criteria:
  - Panel explains decision cause and retry behavior for any inspected guest.

### Phase 2H: Debug Spatial and Objective Overlays

- Goal:
  - Make world-context and objective-resolution state visually explicit.
- Primary files:
  - `apps/phaser/debug/humanDebugOverlay.js`
  - `apps/phaser/phaserRuntimeAdapter.js` (classification metadata exposure as needed)
- Work:
  - Upgrade existing context/intent debug visibility to richer world-space overlays.
  - Add/expand world-space overlays for room/corridor classification around inspected guest.
  - Add/expand doorway classifier overlay that marks doorway-prefab tiles as room.
  - Add/expand objective-path intent overlay for selected target and path status (`valid`, `fallback`, `retrying`).
  - Add overlay legend so color/shape mapping is unambiguous.
- Verification:
  - Overlay geometry matches actual classifier output around inspected guest.
  - Doorway-as-room visuals align with locked doorway classification rule.
  - Path intent overlay status matches manager objective status.
- Exit criteria:
  - Spatial context and objective-path state can be validated with high-clarity overlays in live simulation.

### Phase 2I: Debug Timeline, Anomalies, and Aggregate Diagnostics

- Goal:
  - Add higher-level tools for drift/thrash detection and tuning.
- Primary files:
  - `apps/phaser/debug/humanDebugOverlay.js`
  - `apps/phaser/debug/firstContactDiagnosticsPanel.js`
- Work:
  - Add mini timeline (`10-20s`) with per-state score sparklines.
  - Add anomaly warnings for:
    - all enabled-state scores near zero,
    - high-frequency winner switches.
  - Add aggregate diagnostics for population state distribution and switch frequency.
  - Add simple anomaly counters and last-occurrence timestamps for quick triage.
- Verification:
  - Timeline retains rolling window correctly under long runtime sessions.
  - Anomaly triggers fire for synthetic edge cases and stay quiet in nominal behavior.
  - Aggregate diagnostics track population distribution and switch-rate trends accurately.
- Exit criteria:
  - Debug tooling supports both per-guest diagnosis and population-level tuning.

## Implementation Sequence (Locked)

1. Complete `2A` before any runtime wiring.
2. Complete `2B` and its paired debug visibility before adding input adapters.
3. Complete `2C` and its paired debug visibility before arbitration logic.
4. Complete `2D` and its paired debug visibility before human manager integration.
5. Complete `2E` and its paired debug visibility before advanced debug additions.
6. Complete `2F` before decision-cause diagnostics.
7. Complete `2G` before spatial/objective overlay upgrades.
8. Complete `2H` before timeline/anomaly/aggregate diagnostics.
9. Complete `2I` before final phase signoff.
10. Debug parity gate: no subphase advances unless newly added behavior is observable in debug mode.

## Acceptance Criteria

1. Guest brain contains exactly the five initial states (`wander`, `shelter`, `danger`, `thirst`, `hunger`) and supports adding more.
2. Brain scoring and state selection run per guest on a fixed `4Hz` cadence.
3. All guest memory used by brain evaluation is per-guest (no shared guest memory model).
4. Room/corridor context contributes to state scoring.
5. Doorway tiles belonging to room prefabs are treated as room context.
6. Inactive inputs evaluate to constant `0`.
7. `thirst` and `hunger` are visible but greyed out and excluded from winner selection in Phase 2.
8. Dominant state determines guest intent with fixed deterministic tie-break behavior.
9. `danger` preemption and fallback timers match locked thresholds/timings in this document.
10. In debug mode, `Alt + Left Click` on a guest shows a top-right neural-net-style panel for that guest.
11. Panel shows at least: input values, weighted links, per-input contributions, per-state scores, dominant state.
12. Existing survivor controls and conversion behavior remain unaffected.
13. Panel includes a "Why this won" summary with top 3 dominant-state contribution terms.
14. Panel includes hold/preemption timer badges and current preemption gate status.
15. Panel includes fallback diagnostics (failure reason, retry timer, retry count).
16. Panel includes a `10-20s` per-state score timeline.
17. Debug world overlays show room/corridor classification and doorway-as-room interpretation for inspected guest context.
18. Debug objective overlay shows target and path status (`valid`, `fallback`, `retrying`).
19. Debug panel emits anomaly warnings for invalid/unstable score/state conditions.
20. Subphase debug parity holds: each newly introduced behavior in Phase 2 is inspectable in debug mode in that same subphase.

## Verification Plan

1. Functional checks
   - Validate score output follows locked formula: `bias + sum(weights * inputs)` then clamp to `[0, 1]`.
   - Validate deterministic tie-break and `0.75s` hold-window anti-thrash behavior.
   - Validate danger preemption only occurs at locked threshold (`>= 0.70`) and margin (`>= 0.15`).
   - Validate that corridor-heavy positions increase shelter/danger pressure relative to room positions.
   - Validate doorway-as-room classification rule.
2. Integration checks
   - Confirm guest behavior branch selection now comes from brain output.
   - Confirm disabled states do not dispatch objectives in Phase 2.
   - Confirm objective failure fallbacks use locked retry timings (`0.25s` danger, `0.75s` shelter).
   - Confirm no regression in existing movement and conversion loops.
   - Confirm each subphase ships its paired debug observability before progressing.
3. Debug checks
   - In debug mode, use `Alt + Left Click` on a guest and confirm neural-net panel appears top-right.
   - Confirm panel updates live as guest context changes.
   - Confirm inactive inputs render as `0` and disabled states render greyed out.
   - Confirm "Why this won" shows top 3 contribution terms for the dominant state each evaluation.
   - Confirm hold timer and danger-preemption gate badges update correctly under threshold and above-threshold scenarios.
   - Confirm fallback diagnostics update on objective path failure with reason, retry timer, and retry count.
   - Confirm score timeline renders `10-20s` history for each state and reflects score trend changes.
   - Confirm world-space overlays mark room/corridor classification around the inspected guest.
   - Confirm doorway-prefab tiles render as room in classification overlays.
   - Confirm objective intent overlay shows current target and path status (`valid`, `fallback`, `retrying`).
   - Confirm anomaly warnings appear for:
     - near-zero enabled-state score conditions,
     - high-frequency winner-switch conditions.
4. Performance checks
   - Confirm per-guest brain evaluation cost is stable at `4Hz` mixed-population scale.
   - Confirm debug panel refresh at `10Hz` does not cause unacceptable frame spikes when enabled.

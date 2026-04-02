# Finding Our Way - Phase 3 Danger Recognition and Response (Complete)

## Purpose

Phase 3 ensures guests can recognize danger and act accordingly.

This phase focuses on per-guest danger memory, brain danger input wiring, and danger-driven local movement response. Global weighted pathfinding is explicitly deferred.

## Status

- Draft created on **March 28, 2026**.
- Scope revised on **March 29, 2026**.
- Implementation completed on **March 31, 2026**.
- Phase 2 weighted mental model is the prerequisite.

## Locked Decisions

1. Goal-first scope
   - Phase 3 priority is danger recognition and reaction quality, not global route optimization.
2. Memory ownership
   - Danger memory remains per-guest only.
3. Danger memory lifetime
   - After LOS break, danger memory uses a hard expiry of `20.0s`.
4. Decay model
   - Danger memory decays linearly.
5. Threat tracking cardinality
   - Guests track nearest threat only (single active threat model).
6. Brain contract
   - Existing `danger_distance_signal` input is the canonical danger feed for the guest brain.
7. Danger signal mapping
   - Live signal uses distance mapping:
   - `signalLive = clamp01((8.0 - distanceTiles) / (8.0 - 1.5))`.
   - Distances `<= 1.5` tiles saturate near `1.0`; distances `>= 8.0` tiles map to `0.0`.
8. Remembered-threat weighting
   - Remembered danger signal is multiplied by `0.6` relative to live danger.
9. Reacquire behavior
   - LOS reacquire resets memory age immediately and uses live-signal strength in the same tick.
10. Movement contract
   - Guest danger response continues to use existing local/raster planner flow.
11. Danger-mode movement policy
   - Guests always move while in danger objective (no hold-position panic behavior in this phase).
12. Danger replan cadence
   - Danger response keeps current flee replan cadence of `0.35s`.
13. Local candidate ranking weights
   - Separation gain weight: `0.55`.
   - Heading-away alignment weight: `0.25`.
   - LOS-break potential weight: `0.20`.
14. Deferred systems
   - No danger influence map in this phase.
   - No weighted A* traversal-cost integration in this phase.
15. Performance gate
   - Phase 3 must stay within `<= 3%` FPS regression versus pre-Phase-3 baseline in first-contact mixed-population baseline with debug mode off.
16. Debug parity
   - Every new danger mechanic in this phase must be visible in debug mode.
17. Danger-in-room egress rule
   - If a guest is in `danger` objective while currently in a room area, the guest should attempt to leave the room first instead of circling inside it.
18. Room danger door-target policy
   - If danger is detected on a room-classified tile, the guest should path to the nearest valid doorway target.
   - If no valid doorway target/path exists, fallback to Phase 3C danger candidate behavior.
19. Damage reaction rule
   - If a guest takes damage, inject danger memory at attack source/impact location even if no current LOS threat exists.

## Scope (Locked)

- Add per-guest danger memory state:
  - live threat snapshot when zombie is visible,
  - last-known threat persistence when LOS breaks,
  - decay/expiry lifecycle.
- Derive normalized danger signal from live + remembered threat context.
- Wire danger signal into mental-model evaluation via `danger_distance_signal`.
- Ensure danger objective selection is driven by that signal and existing arbitration rules.
- Improve flee response quality using local threat-aware waypoint selection (distance/heading/LOS-break heuristics), without global weighted pathfinding.
- Add room-egress danger behavior:
  - in-room danger should route guests toward nearest doorway before generic flee movement.
- Add damage-triggered danger perception fallback:
  - damage events should seed danger memory for guests even when zombies approach from behind.
- Add debug visibility for:
  - live vs remembered threat source,
  - danger signal magnitude,
  - objective transitions caused by danger,
  - current danger-response target/path status.

## Non-Goals (Locked)

- No low-resolution influence-map runtime service.
- No `subTilePathfinder` traversal-penalty callback.
- No global weighted route-cost integration for guests or survivors.
- No new mental states beyond existing Phase 2 set.
- No zombie architecture rewrite.

## Technical Design

### Design Summary

1. Perception detects threat in LOS.
2. Guest danger memory stores/updates live and last-known threat data.
3. Input adapter computes `danger_distance_signal` from memory state using locked mapping and decay rules.
4. Mental model updates dominant/objective state (`danger` when warranted).
5. Behavior loop executes room-egress-first danger movement (when applicable), then local evasive movement tuned by threat context.
6. Debug surfaces expose full cause chain from threat perception to movement intent.

### Danger Signal Contract (Locked)

1. Live signal:
   - `signalLive = clamp01((8.0 - distanceTiles) / (8.0 - 1.5))`
2. Memory age after LOS break:
   - `memoryAgeSeconds` increases linearly over time.
3. Memory decay factor:
   - `memoryDecay = clamp01(1.0 - (memoryAgeSeconds / 20.0))`
4. Remembered signal:
   - `signalRemembered = signalLiveAtLosBreak * memoryDecay * 0.6`
5. Final signal:
   - use live signal when threat currently visible;
   - otherwise use remembered signal until expiry;
   - output `0` once memory age reaches `20.0s` or memory is invalid.

### Danger Signal Examples (Locked)

| Case | Distance (tiles) | Live Signal | Memory Age (s) | Memory Decay | Remembered Signal | Final Signal |
|---|---:|---:|---:|---:|---:|---:|
| Live, very close | `1.5` | `1.000` | `0.0` | `1.000` | `0.600` | `1.000` |
| Live, mid range | `5.0` | `0.462` | `0.0` | `1.000` | `0.277` | `0.462` |
| Live, max range | `8.0` | `0.000` | `0.0` | `1.000` | `0.000` | `0.000` |
| Remembered half-life sample (LOS break happened when live was `0.769`) | `n/a` | `n/a` | `10.0` | `0.500` | `0.231` | `0.231` |
| Remembered expired | `n/a` | `n/a` | `20.0` | `0.000` | `0.000` | `0.000` |

### Local Danger Candidate Scoring (Locked)

Candidate score in danger objective combines:

1. Separation gain score (`0.55`):
   - normalized increase in distance from threat if candidate is chosen.
2. Heading-away alignment score (`0.25`):
   - normalized dot/alignment between candidate direction and away-from-threat vector.
3. LOS-break potential score (`0.20`):
   - bonus when candidate path/endpoint is likely to break direct LOS from threat.

Deterministic tie-break order when weighted total score ties:

1. Higher `losBreakScore`
2. Higher `separationGainScore`
3. Higher `headingAwayScore`
4. Lower stable `candidateIndex` (first generated candidate wins)

Fallback when all danger candidates are invalid:

1. Keep existing Phase 2 deterministic retry/fallback behavior.
2. Emit objective path status `retrying` with explicit failure reason.
3. Do not introduce idle/hold behavior in danger objective.

### Room Egress Rule (Locked)

When danger is active in room contexts:

1. Trigger:
   - guest objective is `danger`, and
   - guest is currently on room-classified area context.
2. Room danger condition:
   - if danger source is on a room-classified tile, treat this as "room danger" and engage egress targeting.
3. Egress target:
   - select nearest valid doorway target from current room context.
4. Selection metric:
   - nearest is resolved by linear world-distance from guest world position.
5. Failure handling:
   - if no valid doorway/path is available, fallback to existing Phase 3C local danger candidate scoring.
6. Post-egress behavior:
   - once guest exits room context, continue existing danger response flow (no new objective state added).

### Configuration Ownership (Locked)

1. Tunable constants must be owned centrally in runtime composition (`apps/phaser/phaserApp.js`) and injected through manager/policy config.
2. `guestDangerMemory.js` contains safe defaults only; runtime-injected values are source of truth for active tuning.
3. Locked Phase 3 default tunables:
   - `dangerMemoryExpirySeconds = 20.0`
   - `dangerRememberedSignalMultiplier = 0.6`
   - `dangerLiveDistanceMinTiles = 1.5`
   - `dangerLiveDistanceMaxTiles = 8.0`
   - `dangerReplanSeconds = 0.35`
   - `dangerCandidateWeights = { separation: 0.55, headingAway: 0.25, losBreak: 0.20 }`

### Required Debug Payload Schema (Locked)

Per-guest debug payload must expose these fields at minimum:

```js
guest.debug.dangerMemory = {
  source: "none" | "live" | "remembered",
  hasLiveThreat: boolean,
  liveThreatId: string | number | null,
  liveThreatWorld: { x: number, y: number } | null,
  lastKnownThreatWorld: { x: number, y: number } | null,
  signalLive: number,          // [0,1]
  signalRemembered: number,    // [0,1]
  signalFinal: number,         // [0,1]
  memoryAgeSeconds: number,    // >= 0
  expiresInSeconds: number,    // >= 0 or 0 when expired
  expired: boolean
};

guest.debug.dangerResponse = {
  candidateCount: number,
  selectedCandidateIndex: number | null,
  selectedScore: number | null,
  tieBreakUsed: boolean,
  failureReason: string | null
};
```

Diagnostics panel must also show aggregate counts:

1. Guests with live danger source
2. Guests with remembered danger source
3. Guests currently in danger objective
4. Guests in danger retrying state

### Core File Hooks

- `apps/phaser/human/humanManager.js`
- `apps/phaser/human/guestDangerMemory.js` (new)
- `apps/phaser/human/guestMentalModelInputs.js`
- `apps/phaser/human/humanPerception.js`
- `apps/phaser/debug/humanDebugOverlay.js`
- `apps/phaser/debug/firstContactDiagnosticsPanel.js`
- `apps/phaser/phaserApp.js` (config/tuning injection if needed)

## Subphase Breakdown

### Phase 3A: Per-Guest Danger Memory Core

- Implement guest danger memory model and lifecycle.
- Capture:
  - current visible threat reference,
  - last-known threat world position,
  - timestamps/age,
  - decay/expiry timing fields.
- Reset memory cleanly on death/despawn/conversion.
- Lock nearest-only threat selection and LOS-break timestamp update behavior.

API contract for new module `apps/phaser/human/guestDangerMemory.js`:

```js
createGuestDangerMemoryState()
resetGuestDangerMemoryState(state)
updateGuestDangerMemoryFromPerception({ state, perceptionState, nowMs, config })
computeGuestDangerSignal({ state, guestWorld, nowMs, config })
getGuestDangerMemoryDebugSnapshot(state, nowMs, config)
```

Minimum state shape:

```js
{
  hasLiveThreat: false,
  liveThreatId: null,
  liveThreatWorld: null,
  lastKnownThreatWorld: null,
  signalAtLosBreak: 0,
  lastSeenAtMs: null,
  losBrokenAtMs: null
}
```

Exit criteria:

1. Per-guest memory updates deterministically from perception state.
2. LOS break transitions to remembered state without immediate loss of danger.
3. Memory expiry at `20.0s` clears remembered danger deterministically.
4. Reset behavior on death/despawn/conversion is verified and debug-visible.

### Phase 3B: Brain Danger Input Wiring

- Add memory-backed `danger_distance_signal` provider to input adapter flow.
- Normalize signal to `[0, 1]` with deterministic behavior when no valid memory exists (`0`), using locked numeric mapping.
- Ensure signal changes drive existing mental-model danger arbitration (hold/preemption/fallback remains unchanged).

Exit criteria:

1. `danger_distance_signal` is no longer inactive/stubbed for guests with danger context.
2. Signal follows locked examples and formula tolerances in deterministic checks.
3. Brain danger objective selection responds to signal without changing locked arbitration constants.
4. Input debug fields show live/remembered source and numeric signal values.

### Phase 3C: Local Danger-Response Movement

- Keep current raster/local guest movement architecture.
- Improve danger-mode target selection by ranking local candidates using threat-aware heuristics:
  - increase separation from threat,
  - prefer heading away from threat,
  - prefer LOS-breaking directions when available.
- Preserve deterministic fallback/retry behavior from Phase 2.
- Keep danger replanning cadence at `0.35s`.
- Keep always-move behavior while danger objective is active.

Exit criteria:

1. Danger candidate scoring uses locked weighted components.
2. Tie resolution follows locked deterministic order.
3. When candidates fail, system uses retry/fallback path without introducing idle danger behavior.
4. In representative layouts, danger-mode movement increases separation and attempts LOS break where possible.

### Phase 3D: Debug and Diagnostics Validation

- Show live vs remembered threat markers for inspected guest.
- Show current `danger_distance_signal` and source reason.
- Show objective transition reason when danger drives state change.
- Show danger-response planning status (`valid`, `retrying`, fallback reason).

Exit criteria:

1. Required debug payload schema is fully populated for inspected guest.
2. Overlay clearly distinguishes live vs remembered threat states.
3. Danger signal and objective/path reason labels update in real time with behavior changes.
4. Diagnostics panel aggregate danger counters are present and coherent with observed world behavior.

### Phase 3E: Room Egress on Danger

- Add danger-room egress decision layer before generic danger fleeing.
- When guest is in a room and danger is active on room tiles, set immediate objective target to nearest doorway.
- Keep deterministic nearest-door selection and existing replan cadence.
- Preserve Phase 3C fallback behavior when no doorway target/path is valid.

Exit criteria:

1. Guests in danger while in room context prefer doorway egress over in-room random flee routing.
2. Door target selection is nearest valid doorway by linear world-distance.
3. If doorway egress fails, guests continue danger movement via existing Phase 3C fallback/retry path.
4. Debug overlays/diagnostics show doorway-egress intent and reason while active.

## AI Headless Acceptance Criteria

1. Danger memory persists per guest for up to `20.0s` after LOS break, then expires deterministically.
2. Danger decay is linear over memory age, with no negative values and no values above `1`.
3. Nearest-threat-only model is enforced (single active threat source per guest evaluation).
4. Live danger signal follows locked distance mapping (`1.5` to `8.0` tile interval).
5. Remembered danger signal uses locked `0.6` multiplier and linear decay.
6. Reacquired LOS resets memory age and restores live-signal control immediately.
7. Danger objective transitions are driven by signal/arbitration rules without regression in hold/preemption/fallback contracts.
8. Danger-mode planner selects candidates using locked weighted heuristic (`0.55/0.25/0.20`).
9. Danger-mode movement remains continuous (no idle/hold insertion) while objective is `danger`.
10. Danger replanning cadence remains `0.35s` unless fallback/retry policy applies.
11. Existing survivor command pathing and non-danger guest behavior remain behaviorally compatible.
12. Runtime performance regression stays within `<= 3%` FPS in baseline first-contact mixed-population scenario with debug off.
13. In-room danger causes doorway-egress targeting before local flee candidate selection.
14. Nearest-door policy is deterministic for equivalent geometry/setup.
15. Doorway unavailable/path-failed scenarios cleanly fallback to Phase 3C behavior.
16. Damage taken by a guest without LOS still produces non-zero danger signal and danger response.

## AI Headless Validation Checklist

1. Run deterministic unit checks for signal function:
   - distance at `1.5`, `8.0`, midpoint;
   - memory age at `0`, `10.0`, `20.0`, `>20.0`;
   - reacquire reset case.
2. Run deterministic memory lifecycle checks:
   - visible -> remembered -> expired;
   - death/despawn/conversion resets.
3. Run behavior simulation checks:
   - straight corridor threat retreat;
   - T-junction LOS break and short-memory continuation;
   - threat removed recovery to non-danger objective.
4. Run nearest-threat arbitration check with multiple zombies:
   - confirm tracked threat switches only to nearest valid candidate.
5. Run local candidate scoring checks:
   - ensure ranking reflects weighted score components and deterministic tie behavior.
6. Run performance comparison pass:
   - pre/post Phase-3 baseline scenario with debug disabled.
7. Run room-egress behavior checks:
   - danger triggered inside room should target nearest doorway first;
   - post-doorway exit should hand off to regular danger fleeing;
   - blocked/no-doorway cases should fallback to Phase 3C retry path.
8. Run behind-attack damage checks:
   - apply zombie damage from outside guest vision cone;
   - verify danger memory source activates from damage event;
   - verify guest transitions into danger response behavior.

## Player Debug-Observation Acceptance Criteria

1. In debug view, you can clearly see when a guest has a live threat versus a remembered threat.
2. You can observe a live numeric/labelled danger signal value changing with threat distance/exposure.
3. After LOS break, you can observe the guest remain danger-reactive briefly, then calm down after memory expiry.
4. Guests in danger objective visibly try to move away and avoid direct exposure instead of stalling.
5. Guests do not freeze in panic while objective is danger; they keep attempting movement.
6. You can see objective/path status and danger-related reason codes while observing guests.
7. When danger occurs inside a room, guests visibly try to leave through a doorway instead of looping inside the room.
8. Guests react to taking damage even when attacker approaches from behind/outside current LOS.

## Player Debug-Observation Checklist

Use this as a visual yes/no pass list while observing debug mode:

1. Do you see a clear live-threat marker while zombie is visible to the guest?
2. After LOS break, do you see remembered-threat marker/state remain briefly?
3. Does remembered danger fade out and disappear after roughly `20s`?
4. While danger is active, does the guest keep moving instead of idling?
5. In open space, does the guest generally increase distance from the threat?
6. Near corners/doors, does the guest attempt to break direct sight when possible?
7. When threat is gone, does objective eventually return from `danger` to normal behavior?
8. Do debug labels show danger signal value and objective/path reason updates as behavior changes?
9. If danger starts while guest is inside a room, do you see the guest choose a doorway route first?
10. If nearest doorway is blocked/unusable, do you still see danger fallback/retrying behavior rather than idle behavior?
11. If a zombie hits a guest from behind, does the guest still enter danger behavior instead of continuing unaware?

## Deferred Follow-Up (Future Phase Candidate)

- Reintroduce low-resolution danger influence map if later testing shows local heuristics are insufficient.
- Add optional weighted traversal cost in `subTilePathfinder` only when/if global risk-aware routing is required.

# Ganging Up Implementation Plan (Complete)

## Purpose

Define the implementation plan for the **Ganging Up** gameplay slice:

- zombie pursuit pathfinding rework is deferred to the next update,
- guests naturally spawn and flee from zombies,
- survivor/guest roles are visually and behaviorally distinct,
- survivor roster expands by contact conversion,
- player can multi-select survivors and issue group movement commands.

## Status

- Draft created on **March 20, 2026**.
- Phase 1 implemented on **March 20, 2026**.
- Phase 2 implemented on **March 20, 2026**.
- Phase 3 implemented on **March 20, 2026**.
- Phase 4 implemented on **March 20, 2026**.
- Phase 5 implemented on **March 20, 2026**.
- Phase 6 implemented on **March 20, 2026**.
- Phase 7 implemented on **March 20, 2026**.
- Phase 8 implemented on **March 20, 2026**.
- Phase 9 implemented on **March 20, 2026**.
- Marked complete and archived on **March 20, 2026**.
- Historical follow-up: deferred zombie pursuit locomotion rework was completed in `documentation/FINDING_OUR_WAY_PHASE_1_LOCOMOTION.md` on **March 21, 2026**.

## Scope (Locked For This Slice)

- Keep first-contact mixed runtime (humans + zombies).
- Defer zombie pursuit pathfinding rework to the next update.
- Add natural human spawning policy that mirrors zombie ring spawning logic but at a static `1:10` human-to-zombie configured target ratio.
- Add human vision-cone mechanics equivalent to zombie vision geometry and line-of-sight checks.
- Add guest flee behavior: when a guest detects a zombie, guest runs away (pathing opposite threat direction).
- Guests wander when no zombie threat is currently detected.
- Split human roles:
  - `survivor`: player-controllable,
  - `guest`: AI-fleeing civilian.
- Visually differentiate survivor vs guest by clothing color.
- Add survivor conversion interaction: survivor touching guest converts guest into survivor.
- Add multi-survivor selection and group commands:
  - `Shift + Left Click` additive/toggle selection,
  - drag-box multi-selection,
  - `Ctrl + Left Click` group movement command.

## Non-Goals (Locked For This Slice)

- No human combat/weapon system.
- No guest attack behavior.
- No advanced survivor formations beyond practical anti-overlap spread for group movement.
- No zombie archetype expansion.
- No final art pass beyond placeholder color differentiation.
- No network/multiplayer controls.

## Player Interaction Requirements (Locked)

- Player can select one or many survivors.
- `Shift + Left Click` on survivors adds/removes individual survivors from current selection.
- Drag selection box over survivors selects multiple survivors at once.
- `Ctrl + Left Click` issues a group movement command to all selected survivors.
- Guests are not directly selectable while still guests.
- Converted guests immediately become selectable survivors.

## Core Behavior Requirements (Locked)

1. Zombie pursuit pathfinding deferral
   - Zombie pursuit pathfinding rework is explicitly deferred to the next update.
   - This slice keeps current zombie pursuit movement behavior unchanged.
2. Natural guest spawning
   - Guest spawning follows ring-based policy structure equivalent to zombie first-contact spawning.
   - Guest target population is `1/10` of configured zombie target population (default: `10` guests for `100` zombies).
   - Guest spawn rings anchor to all living survivors.
   - Guest spawn attempts use walkable/collision-safe checks and skip invalid samples.
   - Guest out-of-perimeter recycle policy mirrors zombie recycle behavior.
3. Human vision mechanics
   - Human vision uses the same cone semantics as zombies:
   - heading-based cone angle,
   - vision range in tiles,
   - line-of-sight blocking by world geometry.
4. Guest flee behavior
   - If guest detects at least one zombie in cone/LOS, guest enters flee mode.
   - Flee direction is opposite nearest detected zombie.
   - Guest flee movement is path-based, not straight-line.
   - On threat loss, guest exits flee and returns to wander behavior.
5. Role visuals
   - First spawned player-controlled human is `survivor` with distinct clothing color.
   - Naturally spawned humans are `guests` with different clothing color.
6. Contact conversion
   - Survivor-to-guest touch/contact converts guest role to survivor.
   - Converted unit becomes player-controllable and selectable immediately.
   - Converted unit is not auto-added to current player selection.
   - Converted survivor no longer runs autonomous guest flee logic.
7. Survivor-only direct control policy
   - Survivors are fully player-controlled in this slice (no autonomous vision/flee behavior).
   - Guests own vision+flee behavior in this slice.
8. Multi-select group command
   - On group command, each selected survivor claims the nearest unclaimed walkable tile around the clicked location.
   - Two survivors cannot be assigned the same destination tile from a single group command.
   - Each selected survivor receives an individual path assignment to its claimed tile.

## Technical Design

1. Runtime mode policy
   - Add/lock a `ganging_up` runtime mode in `apps/phaser/phaserApp.js`.
   - Keep existing first-contact mode intact for fallback comparison.
2. Human roster architecture
   - Introduce a human roster manager to support multiple concurrent humans with role metadata.
   - Keep per-agent controller modular (survivor/guest differ by policy, not hard-forked controller code).
   - Guest spawn/recycle anchors evaluate all living survivors.
3. Zombie movement architecture
   - Keep current zombie movement architecture unchanged for this slice.
   - Perform zombie pursuit pathfinding contract changes in the next update.
4. Human perception + flee
   - Add reusable human vision/perception utility.
   - Add guest flee planner that converts threat vector into reachable world-space flee goals and path assignments.
   - Add guest wander planner for no-threat baseline behavior.
5. Selection + command architecture
   - Replace single-human selection assumptions with selected-survivor set semantics.
   - Command controller upgrades from one controlled human to many.
   - Group command assignment resolves unique destination-tile claims per survivor.
6. Role visuals and overlays
   - Human visuals use role-tinted texture variants or tint overlays for survivor/guest differentiation.
   - HP overlay and debug diagnostics iterate full human roster (not one human).
7. Conversion handling
   - Add contact checks between survivors and guests each update tick.
   - Conversion updates role state, selection eligibility, control policy, and diagnostics.

## SOLID Guardrails (Locked)

1. Single Responsibility Principle (SRP)
   - Human roster, human perception/flee, zombie path pursuit, and selection/commands stay separated.
2. Open/Closed Principle (OCP)
   - Role policy (`survivor`, `guest`) is strategy/config driven so future roles can be added without rewriting controller core.
3. Liskov Substitution Principle (LSP)
   - Human agent contract stays stable across roles (`select`, `deselect`, `setWorldPath`, `update`, `getBoundsWorld`, health APIs).
4. Interface Segregation Principle (ISP)
   - Keep narrow ports for:
   - human roster queries,
   - selection state,
   - command dispatch,
   - perception queries,
   - spawn orchestration.
5. Dependency Inversion Principle (DIP)
   - High-level behavior modules depend on injected path/perception/spawn interfaces, not world-store internals.

## File-Level Implementation Plan

1. `apps/phaser/phaserApp.js`
   - Add `ganging_up` runtime mode constants and composition wiring.
   - Compose multi-human manager + upgraded selection/command controllers.
   - Provide zombie manager with human target providers from roster instead of single-human assumptions.
2. `apps/phaser/human/humanController.js`
   - Add role metadata (`survivor`/`guest`) and role visual styling hooks.
   - Keep movement/health APIs role-agnostic.
3. `apps/phaser/human/humanManager.js` (new)
   - Own human roster lifecycle, role assignment, natural guest spawning, guest wander/flee loops, role conversion, and per-human update/sync loops.
4. `apps/phaser/human/humanSelectionController.js`
   - Upgrade for multi-survivor selection sets, shift-toggle behavior, and drag-box multi-select.
5. `apps/phaser/human/humanCommandController.js`
   - Upgrade command dispatch to selected survivor sets with nearest-available unique destination tile assignment.
6. `apps/phaser/human/humanPerception.js` (new)
   - Shared cone + LOS detection helpers for human vision logic.
7. `apps/phaser/human/humanFleePlanner.js` (new)
   - Guest flee target generation and path request policy.
8. `apps/phaser/ui/agentHpBarOverlay.js`
    - Render HP bars for all humans in roster and preserve zombie cooldown bars.
9. `apps/phaser/debug/firstContactDiagnosticsPanel.js`
    - Extend diagnostics for:
    - survivor/guest counts,
    - guest flee state counts,
    - conversion events.
10. `apps/phaser/debug/humanDebugOverlay.js`
    - Add guest vision debug rendering (cone and detection state visualization).
11. `documentation/`
    - Sync architecture/runtime/module docs after implementation.

## Milestones

1. Milestone 1: Multi-human runtime foundation
   - Human roster manager active with survivor + guests in same scene lifecycle.
2. Milestone 2: Zombie pursuit pathfinding deferral
   - Zombie pursuit pathfinding rework is explicitly scheduled for the next update.
3. Milestone 3: Guest natural spawn loop
   - Guest population stabilizes at static `1/10` zombie target ratio using ring spawn/recycle policy anchored to all living survivors.
4. Milestone 4: Human vision mechanics
   - Guests detect zombies via cone+LOS with deterministic perception diagnostics.
5. Milestone 5: Human vision debug visibility
   - Debug mode renders human/guest vision cone state and detection indicators.
6. Milestone 6: Guest flee behavior
   - Guests flee via path-based movement when threats are detected and wander while no threat is visible.
7. Milestone 7: Survivor/guest role visuals + conversion
   - Role colors are clear and survivor-touch conversion is deterministic.
8. Milestone 8: Multi-select + group movement
   - Shift-click, drag-box multi-select, and group command loop are stable.
9. Milestone 9: Stability + docs sync
   - Performance, diagnostics, and docs aligned with runtime behavior.

## Detailed Phase Breakdown

### Phase 0: Alignment Lock

- Goal:
  - Freeze role policy, spawn ratios, selection semantics, and pathfinding deferral rules.
- Files:
  - `documentation/archive/GANGING_UP_IMPLEMENTATION_PLAN.md`
- Work:
  - Lock survivor-vs-guest control policy.
  - Lock guest spawn ratio and ring defaults.
  - Lock zombie pursuit pathfinding deferral to the next update.
  - Lock multi-select input semantics.
- Verification:
  - Decision checklist completed.
- Exit criteria:
  - Scope and contracts approved.

### Phase 1: Human Roster Foundation (Multi-Human)

- Goal:
  - Replace single-human assumptions with roster-based composition.
- Files:
  - `apps/phaser/human/humanManager.js` (new)
  - `apps/phaser/phaserApp.js`
  - `apps/phaser/ui/agentHpBarOverlay.js`
- Work:
  - Add roster manager owning all human agents.
  - Spawn first `survivor` at runtime boot.
  - Route update/sync loops through roster manager.
  - Migrate overlays to iterate roster humans.
- Verification:
  - Runtime boots with one survivor through roster manager with no regressions.
- Exit criteria:
  - Human systems no longer rely on singleton human controller assumptions.

#### Phase 1 Status

- Implemented on March 20, 2026:
  - Added `apps/phaser/human/humanManager.js` as roster owner for human lifecycle/update/sync.
  - Updated `apps/phaser/phaserApp.js` to compose humans through `humanManager` (with primary survivor bootstrap).
  - Updated first-contact zombie target sourcing to read living human targets from roster entries instead of a hardcoded singleton.
  - Updated `apps/phaser/ui/agentHpBarOverlay.js` to render human HP bars from manager-provided controller roster iteration.
- Verification completed:
  - Syntax check passed (`node --check apps/phaser/human/humanManager.js`).
  - Syntax check passed (`node --check apps/phaser/phaserApp.js`).
  - Syntax check passed (`node --check apps/phaser/ui/agentHpBarOverlay.js`).

### Phase 2: Survivor/Guest Role Differentiation

- Goal:
  - Implement role metadata and visual differentiation.
- Files:
  - `apps/phaser/human/humanController.js`
  - `apps/phaser/human/humanManager.js`
- Work:
  - Add role enum/state (`survivor`, `guest`).
  - Add color differentiation for clothing visuals.
  - Ensure selection eligibility only for survivors.
- Verification:
  - Visual distinction is clear at runtime for both roles.
- Exit criteria:
  - Role state is stable and queryable across systems.

#### Phase 2 Status

- Implemented on March 20, 2026:
  - Extended `apps/phaser/human/humanController.js` with explicit role state (`survivor`/`guest`) and role-driven visual style hooks.
  - Added survivor/guest clothing-color differentiation in generated human placeholder textures.
  - Added survivor-only selection eligibility gates (`isSelectable`) in human controller behavior.
  - Updated `apps/phaser/human/humanSelectionController.js` to enforce selection only when controller eligibility allows it.
  - Updated `apps/phaser/human/humanManager.js` to create primary human as explicit `survivor` role and surface role from controller state.
- Verification completed:
  - Syntax check passed (`node --check apps/phaser/human/humanController.js`).
  - Syntax check passed (`node --check apps/phaser/human/humanManager.js`).
  - Syntax check passed (`node --check apps/phaser/human/humanSelectionController.js`).
  - Syntax check passed (`node --check apps/phaser/phaserApp.js`).

### Phase 3: Natural Guest Spawn Loop

- Goal:
  - Add guest ring spawn/recycle policy at 1/10 zombie ratio.
- Files:
  - `apps/phaser/human/humanManager.js`
  - `apps/phaser/phaserApp.js`
- Work:
   - Mirror zombie ring spawn policy for guests.
   - Set static target guest population from configured zombie target count ratio.
   - Anchor guest ring sampling to all living survivors.
   - Add bounded spawn attempts and skip telemetry for invalid samples.
   - Add perimeter recycle logic.
- Verification:
  - Guest population converges to ratio target in normal geometry.
- Exit criteria:
  - Stable natural guest population management.

#### Phase 3 Status

- Implemented on March 20, 2026:
  - Extended `apps/phaser/human/humanManager.js` with natural guest population policy:
    - static target-count policy support (`targetGuestCount`),
    - ring spawn sampling with min/max radius,
    - spawn attempt budget and skipped-attempt accounting,
    - perimeter recycle pass for out-of-range guests,
    - dead-guest cleanup during recycle cadence,
    - cycle diagnostics (`naturalGuestPopulation`, `lastGuestSpawnAttempt`).
  - Updated `apps/phaser/phaserApp.js` human composition to inject a natural guest policy in first-contact runtime:
    - static guest target derived from configured zombie target count (`1/10`),
    - ring radius aligned with first-contact zombie ring defaults,
    - perimeter anchors resolved from all living survivors.
- Verification completed:
  - Syntax check passed (`node --check apps/phaser/human/humanManager.js`).
  - Syntax check passed (`node --check apps/phaser/phaserApp.js`).
  - Syntax check passed (`node --check apps/phaser/human/humanController.js`).
  - Syntax check passed (`node --check apps/phaser/human/humanSelectionController.js`).
  - Syntax check passed (`node --check apps/phaser/ui/agentHpBarOverlay.js`).

### Phase 4: Human Vision Mechanics (Guest-Enabled)

- Goal:
  - Add zombie-like vision mechanics for humans (enabled for guests in this slice).
- Files:
  - `apps/phaser/human/humanPerception.js` (new)
  - `apps/phaser/human/humanManager.js`
  - `apps/phaser/debug/firstContactDiagnosticsPanel.js`
- Work:
  - Implement cone angle/range + LOS checks equivalent to zombie detection.
  - Expose perception outputs for flee planner consumption.
  - Add debug metrics for detection cycles.
- Verification:
  - Guests only detect zombies when in-cone and LOS-valid.
- Exit criteria:
  - Perception signals are deterministic and reusable.

#### Phase 4 Status

- Implemented on March 20, 2026:
  - Added `apps/phaser/human/humanPerception.js` with reusable cone + line-of-sight perception logic using bounded line-sampling checks.
  - Extended `apps/phaser/human/humanController.js` with vision/heading surface needed for perception:
    - human heading state tracking,
    - `getHeadingRadians()`,
    - `getVisionCone()`,
    - vision fields in debug state.
  - Extended `apps/phaser/human/humanManager.js` with guest perception cycle execution:
    - guest-only perception evaluation against injected zombie targets,
    - nearest visible target tracking per guest,
    - cycle summary metrics (`detectedGuestCount`, `targetCount`, cone/LOS aggregates),
    - perception diagnostics exposed in manager debug state (`guestPerception`).
  - Updated `apps/phaser/phaserApp.js` to inject guest perception target provider (zombies) into human manager policy wiring.
  - Updated `apps/phaser/debug/firstContactDiagnosticsPanel.js` to consume manager diagnostics and display guest perception cycle metrics.
- Verification completed:
  - Syntax check passed (`node --check apps/phaser/human/humanPerception.js`).
  - Syntax check passed (`node --check apps/phaser/human/humanController.js`).
  - Syntax check passed (`node --check apps/phaser/human/humanManager.js`).
  - Syntax check passed (`node --check apps/phaser/debug/firstContactDiagnosticsPanel.js`).
  - Syntax check passed (`node --check apps/phaser/phaserApp.js`).

### Phase 5: Human Vision Debug Overlay

- Goal:
  - Make human/guest vision state directly visible in runtime debug mode.
- Files:
  - `apps/phaser/debug/humanDebugOverlay.js`
  - `apps/phaser/human/humanManager.js`
  - `apps/phaser/phaserApp.js`
- Work:
  - Render guest vision cone geometry when debug mode is enabled.
  - Render nearest-detected zombie indicator/line for guests currently detecting threats.
  - Distinguish no-target vs target-locked guest perception states with clear colors.
  - Ensure overlay is bounded to debug-mode render flow and does not affect normal runtime visuals.
- Verification:
  - Debug view clearly shows guest perception cone direction and current detection lock state.
- Exit criteria:
  - Human vision behavior is inspectable in debug mode.

#### Phase 5 Status

- Implemented on March 20, 2026:
  - Expanded `apps/phaser/debug/humanDebugOverlay.js` to render guest vision diagnostics in debug mode:
    - zombie-style raycast-clipped guest vision cones,
    - per-ray cone visualization for parity with zombie vision debug,
    - guest heading line,
    - active detection lock line/marker to nearest detected zombie target.
  - Wired human roster perception state into overlay rendering via `humanManager` debug state.
  - Updated `apps/phaser/phaserApp.js` to pass `humanManager` into human debug overlay composition.
  - Resolved human-debug darkness mismatch by disabling duplicate human overlay blackout/collision passes when zombie debug overlay is active.
- Verification completed:
  - Syntax check passed (`node --check apps/phaser/debug/humanDebugOverlay.js`).
  - Syntax check passed (`node --check apps/phaser/phaserApp.js`).

### Phase 6: Guest Flee Behavior

- Goal:
  - Make guests run opposite detected zombie direction using pathfinding.
- Files:
  - `apps/phaser/human/humanFleePlanner.js` (new)
  - `apps/phaser/human/humanManager.js`
  - `apps/phaser/human/humanCommandController.js` (shared path assignment helpers)
- Work:
   - Compute opposite-direction flee target from nearest threat vector.
   - Resolve reachable flee target through sub-tile nav.
   - Add guest wander assignment when no zombie threat is detected.
   - Apply repath cadence/budgets and fallback behavior.
- Verification:
  - Guests retreat from nearby zombies and avoid straight-line wall collisions.
- Exit criteria:
  - Flee loop is stable and path-based.

#### Phase 6 Status

- Implemented on March 20, 2026:
  - Added `apps/phaser/human/humanFleePlanner.js` for guest flee/wander path planning over sub-tile navigation grids.
  - Extended `apps/phaser/human/humanManager.js` with guest behavior orchestration:
    - mode switching (`flee` vs `wander`) from perception state,
    - path replanning cadence and blocked-path recovery,
    - path assignment to guest controllers using planner outputs,
    - guest behavior diagnostics (`guestBehavior` per-guest state and cycle summaries).
  - Updated guest wander policy in `apps/phaser/human/humanManager.js` to use the same waypoint selection logic as zombie wander (`createZombieWanderPlanner`) with short no-candidate retry cadence.
  - Updated `apps/phaser/phaserApp.js` to inject first-contact guest behavior tuning policy into human manager composition.
  - Updated `apps/phaser/debug/firstContactDiagnosticsPanel.js` to surface guest behavior cycle summaries (flee/wander counts and replan success).
- Verification completed:
  - Syntax check passed (`node --check apps/phaser/human/humanFleePlanner.js`).
  - Syntax check passed (`node --check apps/phaser/human/humanManager.js`).
  - Syntax check passed (`node --check apps/phaser/phaserApp.js`).
  - Syntax check passed (`node --check apps/phaser/debug/firstContactDiagnosticsPanel.js`).

### Pathfinding Rework Deferral (Next Update)

- Zombie pursuit pathfinding rework is removed from this implementation slice.
- Zombie pursuit pathfinding will be reworked in the next update as a dedicated pathing-focused pass.

### Phase 7: Survivor Touch Conversion

- Goal:
  - Convert guests to survivors on contact.
- Files:
  - `apps/phaser/human/humanManager.js`
  - `apps/phaser/human/humanController.js`
  - `apps/phaser/debug/firstContactDiagnosticsPanel.js`
- Work:
   - Add survivor-guest proximity/contact checks using world collider bounds.
   - Flip guest role to survivor on contact.
   - Keep converted survivors unselected by default (player selects manually).
   - Disable guest autonomous flee post-conversion.
   - Expose conversion events in diagnostics.
- Verification:
  - Contact conversion is deterministic and immediate.
- Exit criteria:
  - New survivors are commandable and persist as survivors.

#### Phase 7 Status

- Implemented on March 20, 2026:
  - Added survivor-guest collider overlap conversion loop in `apps/phaser/human/humanManager.js`.
  - Converted guests now flip role to survivor immediately on contact and are explicitly left unselected by default.
  - Guest autonomous behavior state is removed on conversion (perception/behavior/wander-recovery entries cleared).
  - Added conversion diagnostics to human manager debug state (`guestConversion` total + last-cycle events/counts).
  - Updated `apps/phaser/debug/firstContactDiagnosticsPanel.js` to display survivor/guest split and conversion totals/cycle counts.
- Verification completed:
  - Syntax check passed (`node --check` equivalent) for `apps/phaser/human/humanManager.js`.
  - Syntax check passed (`node --check` equivalent) for `apps/phaser/debug/firstContactDiagnosticsPanel.js`.

### Phase 8: Multi-Selection and Group Commands

- Goal:
  - Enable player control over multiple survivors.
- Files:
  - `apps/phaser/human/humanSelectionController.js`
  - `apps/phaser/human/humanCommandController.js`
  - `apps/phaser/phaserApp.js`
- Work:
   - Implement selected survivor ID set.
   - Add shift-click toggle semantics.
   - Add drag-box multi-select across all survivors.
   - Implement group `Ctrl + Left Click` command where each survivor claims a nearest unclaimed walkable destination tile.
- Verification:
  - Multiple survivors move on one command without severe overlap stacking.
- Exit criteria:
  - Multi-select + group movement loop is playable and stable.

#### Phase 8 Status

- Implemented on March 20, 2026:
  - Upgraded `apps/phaser/human/humanSelectionController.js` from single-agent selection to roster-based survivor selection set semantics.
  - Added `Shift + Left Click` toggle behavior for individual survivor membership.
  - Added drag-box multi-select across all selectable survivors (replacement by default, additive when shift is held).
  - Upgraded `apps/phaser/human/humanCommandController.js` to issue group movement commands for selected survivors.
  - Implemented unique destination-claim assignment where each selected survivor gets a nearest unclaimed walkable tile around the clicked point.
  - Updated `apps/phaser/phaserApp.js` wiring to pass full human roster provider into selection and selected-survivor provider into command dispatch.
- Verification completed:
  - Syntax check passed (`node --check`) for `apps/phaser/human/humanSelectionController.js`.
  - Syntax check passed (`node --check`) for `apps/phaser/human/humanCommandController.js`.
  - Syntax check passed (`node --check`) for `apps/phaser/phaserApp.js`.

### Phase 9: Stability, Diagnostics, and Documentation Sync

- Goal:
  - Harden behavior and align docs to implementation.
- Files:
  - `apps/phaser/debug/*.js`
  - `documentation/GAME_ARCHITECTURE.md`
  - `documentation/GAME_RUNTIME.md`
  - `documentation/MODULE_API_REFERENCE.md`
  - `documentation/GAME_OVERVIEW.md`
  - `documentation/README.md`
  - `README.md`
- Work:
  - Add diagnostics for pathing budgets, guest flee states, and conversion counts.
  - Stress test multi-agent spawn/flee/pursuit/convert/command loops.
  - Sync runtime and API docs.
- Verification:
  - No runtime errors during repeated stress cycles.
- Exit criteria:
  - Ganging Up slice is stable and documented.

#### Phase 9 Status

- Implemented on March 20, 2026:
  - Extended `apps/phaser/debug/firstContactDiagnosticsPanel.js` with additional human command/path telemetry:
    - survivor group-command assignment/accept/fail counts,
    - pathfinding budget/search counters (`expanded/maxNodes/open/closed`),
    - expansion-attempt diagnostics summary.
  - Added live guest behavior-state counters in diagnostics (current flee/wander/replan-cooldown distribution).
  - Added survivor soft-separation behavior to prevent survivor overlap stacking:
    - `nudge(...)` support in `apps/phaser/human/humanController.js`,
    - survivor-only separation pass in `apps/phaser/human/humanManager.js`.
  - Synced runtime/architecture/module overview docs to current multi-human roster, survivor/guest role loop, and group-command behavior.
- Verification completed:
  - Syntax check passed (`node --check` equivalent) for:
    - `apps/phaser/debug/firstContactDiagnosticsPanel.js`,
    - `apps/phaser/phaserApp.js`,
    - `apps/phaser/human/humanController.js`,
    - `apps/phaser/human/humanManager.js`.

## Acceptance Criteria

- Zombie pursuit pathfinding rework is deferred to the next update.
- Guest spawn rings anchor to all living survivors and use a static `1/10` ratio from configured zombie target.
- Human vision cone + LOS mechanics function and drive guest detection.
- In debug mode, guest vision cones and active detection locks are visible and readable.
- Guests flee opposite nearby zombie threat direction using path-based movement.
- Guests wander when no zombie threat is detected.
- Survivor and guest visuals are clearly differentiated by clothing color.
- Survivor touching guest converts guest into survivor.
- Converted survivors are immediately selectable and controllable.
- Converted survivors are not auto-selected.
- Survivors do not auto-flee; guests do.
- `Shift + Left Click` toggles survivor membership in selection.
- Drag box can select multiple survivors.
- `Ctrl + Left Click` issues one group movement instruction to selected survivors.
- Group movement never assigns the same destination tile to two survivors from one command.
- Existing camera/zoom/chunk streaming behaviors remain stable.

## Risks and Mitigations

- Risk: Guest pathfinding can spike CPU with large populations.
  - Mitigation: path refresh cooldowns, low capped node budgets, staggered path updates per tick.
- Risk: Multi-agent command causes clumping and collider jitter.
  - Mitigation: nearest-unclaimed tile claim assignment and small separation nudges.
- Risk: Conversion checks become expensive at high counts.
  - Mitigation: broad-phase distance culling before precise overlap checks.
- Risk: Spawn rings fail often in dense blocked regions.
  - Mitigation: bounded retries + skip telemetry + ratio target treated as best-effort under geometry constraints.
- Risk: Role policy confusion (vision requested for humans, but survivors should remain manual-only).
  - Mitigation: shared human vision module exists, but enabled only for guests in this slice by explicit policy flag.

## Phase 0 Locked Decisions (March 20, 2026)

1. Runtime mode policy
   - Lock new mode: `ganging_up`.
2. Zombie pursuit movement policy
   - Zombie pursuit pathfinding rework is deferred to the next update.
3. Human spawn ratio policy
   - Guest population target = zombie target count * `0.1`.
   - Ratio source is static configured zombie target count (not dynamic live zombie count).
4. Guest spawn anchor policy
   - Guest spawn/recycle ring anchors are all living survivors.
5. Human vision policy
   - Human vision mechanics match zombie cone+LOS model.
   - This slice enables vision-driven autonomy for guests only.
6. Guest flee policy
   - Flee target is opposite nearest detected zombie and uses pathfinding.
   - Guests wander when no threat is detected.
7. Role control policy
   - Survivors are fully player-controlled and do not run autonomous flee behavior.
8. Role visual policy
   - Survivor and guest use distinct clothing colors.
9. Conversion policy
   - Survivor touching guest converts guest into survivor immediately.
   - Converted survivors are not auto-selected.
10. Multi-select policy
   - Shift-click toggle + drag-box multi-select + group command are required in this slice.
   - Group command assigns each survivor a nearest unclaimed destination tile; duplicate tile assignment is disallowed.
11. Zombie pathfinding budget policy
   - Deferred to the next update with the zombie pursuit pathfinding rework.

## Phase 0 Decision Checklist

- [x] Zombie pursuit pathfinding rework deferred to next update.
- [x] Human natural spawn ratio policy locked.
- [x] Human vision + guest-only autonomy policy locked.
- [x] Guest flee behavior policy locked.
- [x] Survivor/guest visual differentiation policy locked.
- [x] Contact conversion policy locked.
- [x] Multi-select and group command interaction policy locked.
- [x] Guest spawn anchor policy locked.
- [x] Zombie low-budget local pathing policy locked.

## Resolved Clarifications (March 20, 2026)

1. Guest spawn anchors
   - Natural guest ring spawns anchor to all living survivors.
2. Guest no-threat baseline
   - Guests wander when no threat is visible, and flee when zombies are detected.
3. Conversion selection
   - Converted guests become survivors but are not auto-selected.
4. Group destination assignment
   - Group move assigns each survivor a nearest unclaimed walkable destination tile around the clicked point.
   - Two survivors cannot be assigned the same destination tile from the same command.
5. Zombie pathfinding complexity/budget
   - Zombie pathfinding remains intentionally simple and performant with strict local budgets.
6. Spawn ratio source
   - Guest `1/10` ratio uses static configured zombie target count.

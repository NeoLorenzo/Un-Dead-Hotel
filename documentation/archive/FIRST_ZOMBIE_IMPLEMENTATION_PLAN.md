# First Zombie Implementation Plan (Wander Slice Draft)

## Purpose

Define the step-by-step plan for implementing the first zombie slice in the Phaser runtime with only spawning and wandering behavior.

## Status

- Updated on **March 19, 2026**.
- This version replaces the previous combat/chase-oriented draft.
- Base wander slice Phases 1-9 is implemented.

## Scope (Locked For This Slice)

- Zombies only.
- Humans are temporarily disabled during this implementation track.
- Player can spawn zombies with simple `Left Click` input.
- Zombies wander using random waypoints inside each zombie's vision cone.
- Zombie movement is straight-line toward chosen waypoint.
- No complex spawn systems, no chase, no attack, no combat loop.

## Non-Goals (Locked For This Slice)

- No human spawn/control loop active in runtime.
- No zombie detection of humans.
- No zombie chase behavior.
- No zombie attack/damage behavior.
- No advanced spawn mechanics (stairwell waves, timed director, biome rules).
- No complex pathfinding (A* or sub-tile planner for zombie wandering).

## Player Interaction Requirements (Locked)

- `Left Click` on map attempts to spawn one zombie.
- Spawn target resolves to clicked world location if walkable.
- If click location is blocked, runtime resolves nearest walkable location within a small fixed radius.
- If no walkable location is found in radius, spawn is rejected.
- Existing human command controls are disabled while in zombie-wander implementation mode.
- Backquote debug mode is expanded for zombies and visualizes:
  - zombie hitbox/collider,
  - zombie vision cone,
  - zombie movement/pathfinding diagnostics.

## Core Behavior Requirements (Locked)

1. Zombie vision cone
   - Each zombie has a forward-facing field-of-vision cone with:
   - heading direction,
   - cone angle,
   - cone range.
   - Wall-clipped enhancement:
   - clip cone reach by world geometry so sampled forward space ends at walls, not through walls.
2. Waypoint selection
   - Zombie picks a random waypoint inside its own cone.
   - Waypoint must be farther than a minimum local distance from zombie center (reject self-hitbox or near-zero targets).
   - Waypoint is constrained to walkable world space.
   - Waypoint candidate must be line-of-sight reachable from zombie position (vision cone cannot pass through walls).
   - Waypoint expansion policy:
   - candidate waypoint `A` should be preferred only if at least one continuation waypoint `B` exists from `A` under the same walkable + line-of-sight rules.
   - If no expanded candidate is found within budget, planner falls back to best single-step candidate.
3. Movement
   - Zombie moves in a straight line toward current waypoint.
   - No pathfinding algorithm is used for this slice.
4. Waypoint cycling
   - On waypoint reach, zombie picks a new random waypoint inside its current cone and continues.
5. Block handling
   - If zombie gets blocked while moving, it immediately repicks a new waypoint.
   - If planner repeatedly fails to find/assign a viable waypoint, apply a short repick cooldown to avoid per-frame retry spam.
6. Zombie-zombie interaction
   - Zombies apply soft separation to avoid stacking while still allowing smooth crowd flow.

## Technical Design

1. Runtime composition
   - `apps/phaser/phaserApp.js` remains composition/orchestration root.
   - Add a zombie-only runtime mode flag for this slice.
2. Zombie runtime modules
   - `apps/phaser/zombie/zombieManager.js`
   - Owns spawned zombie set and update/sync loops.
   - `apps/phaser/zombie/zombieController.js`
   - Owns per-zombie state (position, heading, waypoint, cone params).
   - `apps/phaser/zombie/zombieWanderPlanner.js`
   - Owns random in-cone waypoint generation and repick policy.
3. Movement/collision integration
   - Use existing adapter world-geometry helpers for walkability checks.
   - Move with direct steering; resolve blocked motion via immediate repick logic.
   - Use collision-aware line checks for waypoint candidate acceptance.
4. Input handling
   - Handle `Left Click` world-space spawn requests.
   - Disable human selection/command handlers in this mode.
5. Debug overlay
   - Debug mode ownership is runtime-level, not human-controller-level.
   - `apps/phaser/debug/runtimeDebugController.js` owns debug toggle state and renderer orchestration.
   - `apps/phaser/debug/zombieDebugOverlay.js` shows:
   - zombie hitbox/collider,
   - cone shape,
   - chosen waypoint,
   - current movement vector,
   - current pathing line to waypoint and waypoint-selection diagnostics.
6. Waypoint expansion planner
   - Extend wander planner with short-horizon viability scoring (`current -> A -> B`) to reduce corner commitment.
   - Keep bounded fallback to one-step candidate to avoid stalls in tight geometry.
7. Wall-clipped cone + stuck recovery
   - Add ray-clipped cone sampling so waypoint candidates come from visible reachable forward space only.
   - Add no-candidate recovery behavior (temporary heading rotate / wall-follow bias) to break wall face-plant loops.
   - Add short failed-sector memory to avoid immediately re-picking known blocked sectors.
8. Waypoint spam guard
   - Reject too-close waypoint candidates near zombie center.
   - Add short no-candidate repick cooldown so failed plans do not thrash every frame.

## SOLID Guardrails (Locked)

1. Single Responsibility Principle (SRP)
   - Manager, per-zombie controller, and wander planner stay separate.
2. Open/Closed Principle (OCP)
   - Wander planner is injected so future behaviors can replace it without rewriting controller core.
3. Liskov Substitution Principle (LSP)
   - Zombie controller exposes a stable update/sync contract that can be replaced by richer agents later.
4. Interface Segregation Principle (ISP)
   - Keep small ports:
   - spawn port,
   - movement/walkability port,
   - debug render port.
5. Dependency Inversion Principle (DIP)
   - Zombie modules depend on runtime adapter interfaces, not world-store internals.

## File-Level Implementation Plan

1. `apps/phaser/phaserApp.js`
   - Add zombie-wander mode composition.
   - Disable human spawn/composition and human input handlers in this mode.
   - Add left-click spawn routing to zombie manager.
2. `apps/phaser/zombie/` (new)
   - `zombieManager.js`
   - `zombieController.js`
   - `zombieWanderPlanner.js`
3. `apps/phaser/debug/` (new file)
   - `runtimeDebugController.js`
   - `zombieDebugOverlay.js`
4. `documentation/`
   - Sync runtime/API docs once implementation lands.

## Milestones

1. Milestone 1: Runtime mode switch
   - Human spawn/control is disabled for this track.
2. Milestone 2: Click-to-spawn
   - Left click reliably spawns zombie at click/nearest walkable position.
3. Milestone 3: Zombie baseline actor
   - Zombie placeholder visual and movement state are stable.
4. Milestone 4: Cone waypoint wandering
   - Zombies continuously repick in-cone waypoints and move straight-line.
5. Milestone 5: Debug visibility
   - Hitbox + cone + waypoint/path overlays are readable and accurate.
6. Milestone 6: Stability pass
   - Spawn rejection and blocked-movement repick behavior are deterministic.
7. Milestone 7: Waypoint expansion pass
   - Planner uses two-step viability checks to reduce corner trapping without adding full A*.
8. Milestone 8: Wall-clipped cone and recovery pass
   - Cone sampling is wall-clipped and zombies recover from no-candidate loops without repeated wall face-planting.
9. Milestone 9: Waypoint anti-spam pass
   - Planner rejects too-close waypoints and manager throttles failed repick loops.

## Detailed Phase Breakdown

### Phase 0: Alignment Lock

- Goal:
  - Freeze wander-only scope and temporary human-disable policy.
- Files:
  - `documentation/FIRST_ZOMBIE_IMPLEMENTATION_PLAN.md`
- Work:
  - Lock input map (`Left Click` spawn).
  - Lock no-pathfinding policy for wander movement.
  - Lock initial cone and movement tuning defaults.
- Exit criteria:
  - Scope and interfaces approved.

### Phase 1: Runtime Mode Gating (Disable Humans)

- Goal:
  - Run runtime in zombie-only mode.
- Files:
  - `apps/phaser/phaserApp.js`
- Work:
  - Bypass human controller creation.
  - Bypass human selection and command input handlers.
  - Keep architecture boundaries intact.
- Verification:
  - Runtime boots with no human spawned.
- Exit criteria:
  - Human systems are inactive for this slice.

#### Phase 1 Status

- Implemented on March 19, 2026:
  - Added zombie-wander runtime mode gating in `apps/phaser/phaserApp.js`.
  - Human controller composition is now bypassed in zombie-wander mode.
  - Human selection and command pointer handlers are now bypassed in zombie-wander mode.
- Verification completed:
  - Syntax check passed (`node --check apps/phaser/phaserApp.js`).

### Phase 2: Left-Click Zombie Spawn

- Goal:
  - Spawn one zombie per click with nearest-walkable fallback.
- Files:
  - `apps/phaser/zombie/zombieManager.js`
  - `apps/phaser/phaserApp.js`
- Work:
  - Convert click to world position.
  - Validate or resolve walkable spawn point.
  - Use nearest-walkable fallback radius of `3 tiles`.
  - Reject spawn when no nearby walkable point exists.
- Verification:
  - Click spawning is reliable in open/blocked locations.
- Exit criteria:
  - Manual spawn loop is functional.

#### Phase 2 Status

- Implemented on March 19, 2026:
  - Added `apps/phaser/zombie/zombieManager.js`.
  - Added `Left Click` spawn routing in zombie-wander mode in `apps/phaser/phaserApp.js`.
  - Implemented blocked-click nearest-walkable spawn fallback with `3 tile` search radius.
  - Added spawn rejection when no walkable fallback exists.
  - Added zombie world-to-screen sync so spawned zombies remain camera-anchored in world space.
- Verification completed:
  - Syntax check passed (`node --check apps/phaser/phaserApp.js`).
  - Syntax check passed (`node --check apps/phaser/zombie/zombieManager.js`).

### Phase 3: Zombie Actor + Movement Core

- Goal:
  - Add stable per-zombie controller state and motion update.
- Files:
  - `apps/phaser/zombie/zombieController.js`
- Work:
  - Add position, heading, speed, and active waypoint state.
  - Move directly toward waypoint with collision-aware checks.
  - Add soft-separation nudge pass between nearby zombies.
- Verification:
  - Zombies move smoothly without path planner dependency when waypoint is assigned.
- Exit criteria:
  - Base controller update loop is stable.

#### Phase 3 Status

- Implemented on March 19, 2026:
  - Added `apps/phaser/zombie/zombieController.js` for per-zombie movement state and update lifecycle.
  - Refactored `apps/phaser/zombie/zombieManager.js` to create/manage controller instances.
  - Added collision-aware direct movement toward assigned waypoint in zombie controller.
  - Added manager-level soft-separation nudging between nearby zombies.
  - Added manager waypoint APIs (`setZombieWaypoint`, `clearZombieWaypoint`) for upcoming Phase 4 planner wiring.
- Verification completed:
  - Syntax check passed (`node --check apps/phaser/zombie/zombieController.js`).
  - Syntax check passed (`node --check apps/phaser/zombie/zombieManager.js`).

### Phase 4: Vision Cone Waypoint Planner

- Goal:
  - Implement random in-cone waypoint generation cycle.
- Files:
  - `apps/phaser/zombie/zombieWanderPlanner.js`
  - `apps/phaser/zombie/zombieController.js`
- Work:
  - Generate random candidate points within cone angle/range.
  - Accept first walkable candidate under capped attempts when line-of-sight is clear.
  - Repick on reach or immediate blocked event.
- Verification:
  - Zombies continuously wander with visible directional bias from cone.
  - Waypoint lines do not pass through walls.
- Exit criteria:
  - Wandering loop is complete and deterministic.

#### Phase 4 Status

- Implemented on March 19, 2026:
  - Added `apps/phaser/zombie/zombieWanderPlanner.js`.
  - Implemented random in-cone waypoint generation using current zombie heading.
  - Implemented walkability + line-of-sight validation for waypoint candidates.
  - Wired manager update loop to auto-assign waypoints before movement and immediately repick after waypoint clear events.
  - Extended zombie controller with planner-facing getters (`getHeadingRadians`, `getVisionCone`).
- Verification completed:
  - Syntax check passed (`node --check apps/phaser/zombie/zombieWanderPlanner.js`).
  - Syntax check passed (`node --check apps/phaser/zombie/zombieController.js`).
  - Syntax check passed (`node --check apps/phaser/zombie/zombieManager.js`).

### Phase 5: Debug Overlay + Stability

- Goal:
  - Make wander behavior inspectable and tuneable.
- Files:
  - `apps/phaser/debug/zombieDebugOverlay.js`
  - `apps/phaser/phaserApp.js`
  - `apps/phaser/zombie/zombieManager.js`
  - `documentation/GAME_RUNTIME.md`
  - `documentation/MODULE_API_REFERENCE.md`
  - `documentation/GAME_ARCHITECTURE.md`
- Work:
  - Render per-zombie hitbox, cone, waypoint marker, and heading vector.
  - Render wander pathfinding diagnostics:
  - active path segment (zombie -> waypoint),
  - candidate/accepted waypoint debug markers (when debug enabled).
  - Validate blocked/spawn-fail edge cases.
  - Sync docs to actual runtime interfaces.
- Verification:
  - Debug output matches internal state.
- Exit criteria:
  - First zombie wander slice is documented and stable.

#### Phase 5 Status

- Implemented on March 19, 2026:
  - Expanded zombie debug overlay with waypoint-selection candidate markers:
  - accepted candidate points,
  - blocked candidate points,
  - line-of-sight blocked candidate points.
  - Added planner debug payload for waypoint selection attempts and outcomes.
  - Added manager stability diagnostics (`lastSpawnAttempt`) for blocked/spawn-fail visibility.
  - Synced runtime documentation to current runtime mode and debug-controller ownership.
  - Synced module API and architecture docs to include zombie/runtime-debug modules and interfaces.
- Verification completed:
  - Syntax check passed (`node --check apps/phaser/phaserApp.js`).
  - Syntax check passed (`node --check apps/phaser/zombie/zombieWanderPlanner.js`).
  - Syntax check passed (`node --check apps/phaser/zombie/zombieController.js`).
  - Syntax check passed (`node --check apps/phaser/zombie/zombieManager.js`).
  - Syntax check passed (`node --check apps/phaser/debug/zombieDebugOverlay.js`).
  - Syntax check passed (`node --check apps/phaser/debug/runtimeDebugController.js`).

### Phase 6: Waypoint Expansion (Corner-Avoidance Enhancement)

- Goal:
  - Reduce corner-trap behavior by preferring waypoints with known forward continuation.
- Files:
  - `apps/phaser/zombie/zombieWanderPlanner.js`
  - `apps/phaser/zombie/zombieManager.js`
  - `apps/phaser/debug/zombieDebugOverlay.js`
  - `documentation/FIRST_ZOMBIE_IMPLEMENTATION_PLAN.md`
- Work:
  - Add two-step candidate viability checks (`current -> A` and `A -> B`).
  - Score/accept `A` only when continuation exists within budget.
  - Add bounded fallback to one-step candidate when geometry is too constrained.
  - Expand debug diagnostics to distinguish one-step fallback selection from expanded selection.
- Verification:
  - Corner-stick frequency drops in stress runs while zombies still maintain smooth wandering.
- Exit criteria:
  - Expansion is stable and does not cause planner stalls.

#### Phase 6 Status

- Implemented on March 19, 2026:
  - Added two-step candidate viability checks in `apps/phaser/zombie/zombieWanderPlanner.js`.
  - Planner now prefers expanded selections (`current -> A -> B`) and falls back to best single-step candidate when continuation fails.
  - Added explicit debug selection modes (`expanded_selected`, `fallback_selected`, `no_continuation`).
  - Added manager option plumbing for continuation attempts (`waypointContinuationAttempts`).
  - Expanded debug overlay coloring to distinguish expanded vs fallback vs no-continuation candidates.
- Verification completed:
  - Syntax check passed (`node --check apps/phaser/zombie/zombieWanderPlanner.js`).
  - Syntax check passed (`node --check apps/phaser/zombie/zombieManager.js`).
  - Syntax check passed (`node --check apps/phaser/debug/zombieDebugOverlay.js`).

### Phase 7: Wall-Clipped Cone + Stuck Recovery

- Goal:
  - Prevent repeated wall face-plant loops when forward cone points mostly lie behind nearby walls.
- Files:
  - `apps/phaser/zombie/zombieWanderPlanner.js`
  - `apps/phaser/zombie/zombieController.js`
  - `apps/phaser/zombie/zombieManager.js`
  - `apps/phaser/debug/zombieDebugOverlay.js`
  - `documentation/FIRST_ZOMBIE_IMPLEMENTATION_PLAN.md`
- Work:
  - Add ray-clipped cone sampling so candidate generation is bounded by first wall hit per ray.
  - Keep waypoint expansion (`A -> B`) on top of clipped candidate set.
  - Track no-candidate streaks and trigger short recovery mode (heading rotate / wall-follow bias).
  - Add short failed-sector memory to avoid immediate retries into the same blocked angular sector.
  - Extend debug overlay with:
  - clipped cone boundary rays,
  - recovery-active indicator,
  - failed-sector markers/angles.
- Verification:
  - Zombies do not repeatedly run into the same room wall when cornered.
  - Recovery exits low-progress/no-candidate states within bounded time.
- Exit criteria:
  - Wall-loop frequency is materially reduced while preserving natural wandering motion.

#### Phase 7 Status

- Implemented on March 19, 2026:
  - Added wall-clipped cone ray sampling in `apps/phaser/zombie/zombieWanderPlanner.js`.
  - Added blocked-sector filtering in planner candidate selection.
  - Added manager-side failed-sector memory with TTL decay.
  - Added no-candidate streak handling and bounded recovery rotation steering.
  - Added manager recovery debug state (`wanderRecovery`) and planner ray debug payload (`raySamples`).
  - Expanded zombie debug overlay with clipped-ray rendering, failed-sector arcs, and recovery-active ring.
- Verification completed:
  - Syntax check passed (`node --check apps/phaser/zombie/zombieWanderPlanner.js`).
  - Syntax check passed (`node --check apps/phaser/zombie/zombieManager.js`).
  - Syntax check passed (`node --check apps/phaser/zombie/zombieController.js`).
  - Syntax check passed (`node --check apps/phaser/debug/zombieDebugOverlay.js`).

### Phase 9: Waypoint Anti-Spam Stabilization

- Goal:
  - Prevent repeated self-near waypoint picks and frame-by-frame repick thrashing in tight spaces.
- Files:
  - `apps/phaser/zombie/zombieWanderPlanner.js`
  - `apps/phaser/zombie/zombieManager.js`
  - `apps/phaser/debug/zombieDebugOverlay.js`
  - `documentation/FIRST_ZOMBIE_IMPLEMENTATION_PLAN.md`
- Work:
  - Add minimum waypoint distance gate in planner (`too_close` candidate rejection).
  - Apply same minimum distance gate to continuation checks (`A -> B`) to avoid trivial continuation acceptance.
  - Add manager-level short repick cooldown when selection fails or controller rejects waypoint.
  - Extend debug payload/overlay with `too_close` candidate diagnostics and cooldown visibility state.
- Verification:
  - Zombies stop spamming near-zero waypoints around their own center in constrained geometry.
  - Failed selection loops no longer repick every frame.
- Exit criteria:
  - Wander remains responsive while avoiding local waypoint thrashing.

#### Phase 9 Status

- Implemented on March 19, 2026:
  - Added planner minimum waypoint distance filter and `too_close` debug marker.
  - Added continuation-distance guard so expansion validates meaningful forward progress.
  - Added manager repick cooldown timer after failed selection/rejected assignment.
  - Added cooldown state to manager debug output and visual marker support in zombie debug overlay.
- Verification completed:
  - Syntax check passed (`node --check apps/phaser/zombie/zombieWanderPlanner.js`).
  - Syntax check passed (`node --check apps/phaser/zombie/zombieManager.js`).
  - Syntax check passed (`node --check apps/phaser/debug/zombieDebugOverlay.js`).

## Phase 0 Decisions (Locked March 19, 2026)

1. Mode toggle policy
   - Locked: hard-coded temporary zombie-only mode for this implementation track.
2. Spawn fallback radius
   - Locked: nearest-walkable search radius is `3 tiles`.
3. Spawn cap
   - Locked: no active zombie cap in this slice.
4. Cone geometry defaults
   - Locked: `90 degree` cone angle, `8 tile` cone range.
5. Waypoint distance policy
   - Locked: any point inside full cone range is valid.
   - Constraint: waypoint candidate must pass line-of-sight check (cone does not pass through walls).
6. Blocked movement recovery
   - Locked: immediate waypoint repick on blocked movement.
7. Zombie-zombie interaction
   - Locked: soft separation (no hard full blocking and no full overlap).
8. Debug toggle behavior
   - Locked: reuse existing backquote debug toggle with runtime-level debug controller ownership.
9. Waypoint expansion policy
   - Locked:
   - Prefer waypoint `A` only if planner finds a valid continuation `B` from `A`.
   - If expansion fails after configured attempts, allow single-step fallback candidate.
10. Wall-clipped cone and recovery policy
   - Locked:
   - Candidate sampling should use wall-clipped cone rays.
   - On repeated no-candidate states, trigger bounded recovery steering instead of repeated direct retries.
   - Maintain short failed-sector memory to reduce immediate blocked-sector re-selection.
11. Waypoint anti-spam policy
   - Locked:
   - Reject waypoint candidates closer than the configured minimum local distance from zombie center.
   - Apply a short repick cooldown after failed selection/rejected assignment to avoid per-frame thrashing.

## Suggested Initial Tuning Baseline (For First Wander Playtest)

- Zombie speed: `1.0 tiles/sec`
- Vision cone angle: `90 degrees`
- Vision cone range: `8 tiles`
- Waypoint reach threshold: `0.2 tiles`
- Blocked repick cooldown: `0 sec` (immediate repick)
- In-cone candidate attempts per repick: `10`
- Waypoint expansion mode: `enabled` (Phase 6)
- Continuation attempts from candidate `A`: `6`
- Cone clipping rays: `20`
- No-candidate streak threshold: `6`
- Recovery duration: `0.6 sec`
- Failed-sector memory TTL: `1.5 sec`
- Min waypoint distance: `0.42 tiles` (default)
- No-candidate repick cooldown: `0.12 sec`
- Spawn nearest-walkable fallback radius: `3 tiles`
- Active zombie cap: `none` in this slice

These values are starting defaults for implementation and tuning, not balance-locked.

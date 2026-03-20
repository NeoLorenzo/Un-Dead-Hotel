# First Contact Implementation Plan (Draft)

## Purpose

Define the implementation plan for the first direct human-vs-zombie contact slice:

- humans and zombies both use HP,
- zombies actively pursue and attack humans,
- human death triggers game over.

## Status

- Draft created on **March 19, 2026**.
- Phases 1-10 implemented on **March 19, 2026**.
- Documentation synced for first-contact runtime behavior and module APIs.

## Scope (Locked For This Slice)

- Re-enable human runtime systems alongside zombies.
- Add HP to both agent types:
  - human max HP: `100`
  - zombie max HP: `100`
- Render HP bars above both human and zombie heads.
- Spawn zombies around the first human with distance constraints:
  - minimum distance: `10 tiles`
  - maximum distance: `100 tiles`
- Add zombie pursuit behavior against humans.
- Add zombie attack behavior that damages humans.
- Set zombie movement speed to `50%` of human speed.
- Show game-over screen when no humans remain alive.

## Non-Goals (Locked For This Slice)

- No advanced zombie archetypes.
- No weapon/combat system for humans yet.
- No loot/inventory integration.
- No multi-floor behavior changes.
- No final UI art pass beyond readable functional bars and game-over panel.

## Player Interaction Requirements (Locked)

- Human selection and command loop returns (`Left Click`, drag-box select, `Ctrl + Left Click` move).
- Zombies spawn via first-contact spawn system around the first human (not manual click-to-spawn for this slice unless re-enabled later).
- Game-over state appears when no humans remain; world simulation continues behind the overlay.

## Core Behavior Requirements (Locked)

1. Health model
   - Every human and zombie has `currentHp` and `maxHp`.
   - Initial values are `100/100`.
2. HP bars
   - HP bars render above each agent and track movement.
   - HP bars update immediately on damage.
   - HP bars are always visible.
   - Zombie attack cooldown bar renders below zombie HP bar.
3. Human runtime reactivation
   - Human controller, selection controller, and command controller are active again.
4. Zombie spawn ring around first human
   - Runtime spawns zombies at startup (initial target: `100` zombies).
   - Spawn candidates must be between `10` and `100` tiles from first human.
   - Spawn location must be walkable and collision-safe.
   - If a zombie leaves the human perimeter (outside the `100 tile` boundary from the nearest living human), despawn it and spawn a replacement in-range.
   - If no valid spawn point is found in the ring, skip that spawn attempt.
5. Zombie pursuit
   - Pursuit starts when a human enters zombie vision cone.
   - Zombie locks nearest valid human target and chases a moving waypoint anchored to that human.
   - If line-of-sight is lost, zombie moves to last known waypoint, then resumes wandering.
6. Zombie attack
   - Zombies attack by touch/contact with humans.
   - Each successful attack deals `20` HP damage.
   - Attack cooldown is `1.0 second` per zombie.
   - Cooldown progress is visualized with a bar below zombie HP bar.
7. Speed ratio
   - Zombie movement speed is always `0.5 * human movement speed`.
8. Human death and game over
   - When human HP reaches `0`, human is marked dead/inactive.
   - Game-over overlay appears when no humans remain alive.
   - World simulation continues running while game-over overlay is visible.

## Technical Design

1. Runtime composition and mode policy
   - Add/lock a `first_contact` runtime mode in `apps/phaser/phaserApp.js`.
   - Compose both human and zombie systems in same scene lifecycle.
2. Shared health/combat state
   - Add focused health utilities for apply-damage, death-state checks, and clamped HP updates.
   - Keep health logic framework-agnostic where possible.
3. UI overlays
   - Add a world-space HP bar renderer for both agent types.
   - Add zombie attack cooldown bar renderer below zombie HP bar.
   - Add a scene-level game-over overlay controller.
4. Zombie AI state expansion
   - Extend zombie behavior state to include at least `wander`, `pursuit`, `attack`.
   - Keep pursuit/attack decisions in zombie modules, not in `phaserApp.js`.
5. Spawn orchestration
   - Add startup batch spawn policy for `100` zombies in the `10-100 tile` ring around first human.
   - Add perimeter recycle policy: despawn zombies outside perimeter and attempt replacement spawn in-range.
   - Skip spawn attempts when no valid ring location is found.
6. Speed governance
   - Bind zombie speed from human baseline speed at composition time or through shared tuning constants.

## SOLID Guardrails (Locked)

1. Single Responsibility Principle (SRP)
   - Health model, HP rendering, zombie behavior, and game-over UI remain separate modules.
2. Open/Closed Principle (OCP)
   - Zombie behavior transitions are strategy/state-driven and extensible.
3. Liskov Substitution Principle (LSP)
   - Agent-facing contracts remain stable for both humans and zombies.
4. Interface Segregation Principle (ISP)
   - Keep small interfaces for health updates, target acquisition, attack resolution, and UI rendering.
5. Dependency Inversion Principle (DIP)
   - High-level gameplay flow depends on interfaces, not direct world-store internals.

## File-Level Implementation Plan

1. `apps/phaser/phaserApp.js`
   - Re-enable human composition path.
   - Compose first-contact systems (spawn policy, health UI, game-over controller).
2. `apps/phaser/human/humanController.js`
   - Add HP state integration and death hooks.
3. `apps/phaser/human/humanSelectionController.js`
   - Ensure selection flow respects dead/inactive humans.
4. `apps/phaser/human/humanCommandController.js`
   - Ensure command path safely no-ops when no living humans remain.
5. `apps/phaser/zombie/zombieManager.js`
   - Add first-contact spawn policy around first human.
   - Drive zombie behavior updates for wander/pursuit/attack switching.
6. `apps/phaser/zombie/zombieController.js`
   - Add HP state, pursuit/attack state machine hooks, speed ratio enforcement.
7. `apps/phaser/zombie/zombieWanderPlanner.js`
   - Keep wander logic as fallback state when no valid pursuit target exists.
8. `apps/phaser/ui/` (new)
   - `agentHpBarOverlay.js` for world-space HP bars.
   - Zombie attack cooldown bars are rendered by `agentHpBarOverlay.js` (below zombie HP bars).
   - `gameOverOverlay.js` for game-over panel presentation.
9. `apps/phaser/combat/` (new)
   - `healthModel.js` for HP helpers and damage/death transitions.
   - `zombieAttackResolver.js` for attack-range/cooldown/damage application.
10. `documentation/`
   - Sync architecture/runtime/API docs once implementation is complete.
11. `engine/world/subTilePathfinder.js`
   - Add 8-direction path expansion and corner-safe diagonal traversal rules for human command pathing.

## Milestones

1. Milestone 1: Mixed runtime restored
   - Humans and zombies run together without mode conflicts.
2. Milestone 2: HP foundations
   - Both agent types have stable HP state and damage/death plumbing.
3. Milestone 3: HP bars
   - HP bars render and update correctly over moving agents.
4. Milestone 4: First-contact spawning
   - `100` zombies spawn at runtime start in valid `10-100 tile` ring around first human.
   - Out-of-perimeter zombies are recycled with in-range replacements.
5. Milestone 5: Pursuit and attack loop
   - Zombies lock nearest in-cone human targets, pursue, and apply touch damage with cooldown.
6. Milestone 6: Game-over flow
   - All-human extinction triggers game-over overlay while world keeps running.
7. Milestone 7: Stability + docs
   - Edge cases handled and documentation synced.
8. Milestone 8: Human 8-direction movement
   - Human pathing/movement supports diagonal traversal with collision-safe corner handling.

## Detailed Phase Breakdown

### Phase 0: Alignment Lock

- Goal:
  - Freeze first-contact rules, defaults, and interface contracts.
- Files:
  - `documentation/archive/FIRST_CONTACT_IMPLEMENTATION_PLAN.md`
- Work:
  - Lock mode policy (`first_contact`).
  - Lock HP defaults (`100/100`) and speed ratio (`zombie = 0.5 * human`).
  - Resolve open design questions in this document.
- Verification:
  - Decision checklist completed.
- Exit criteria:
  - Scope and contracts approved.

### Phase 1: Runtime Recomposition (Humans + Zombies)

- Goal:
  - Re-enable humans while preserving zombie systems.
- Files:
  - `apps/phaser/phaserApp.js`
  - `apps/phaser/human/*.js`
  - `apps/phaser/zombie/*.js`
- Work:
  - Re-activate human spawn/control composition.
  - Keep zombie composition active in same runtime mode.
- Verification:
  - Runtime boots with active human and active zombies.
- Exit criteria:
  - Both systems run concurrently without input/runtime conflicts.

#### Phase 1 Status

- Implemented on March 19, 2026:
  - Added explicit `first_contact` runtime mode in `apps/phaser/phaserApp.js`.
  - Re-enabled human controller/selection/command composition in first-contact mode.
  - Enabled zombie manager/debug composition in first-contact mode (alongside humans).
  - Restricted legacy left-click zombie spawn input to `zombie_wander` mode to avoid mixed-mode input conflicts.
  - Added temporary Phase 1 bootstrap spawn of one zombie near the human so both systems were active immediately on boot (later replaced by Phase 4 ring-based spawn policy).
- Verification completed:
  - Syntax check passed (`node --check apps/phaser/phaserApp.js`).

### Phase 2: Shared Health Model + Agent Integration

- Goal:
  - Add HP model and death-state plumbing.
- Files:
  - `apps/phaser/combat/healthModel.js` (new)
  - `apps/phaser/human/humanController.js`
  - `apps/phaser/zombie/zombieController.js`
- Work:
  - Add `maxHp/currentHp`, clamp rules, and `isDead` transitions.
  - Integrate damage application hooks.
- Verification:
  - HP updates are deterministic and never exceed bounds.
- Exit criteria:
  - Both agent types support damage and death state.

#### Phase 2 Status

- Implemented on March 19, 2026:
  - Added framework-agnostic health module `apps/phaser/combat/healthModel.js`.
  - Added human HP state integration in `apps/phaser/human/humanController.js`:
    - `maxHp/currentHp/isDead` state,
    - clamped damage/heal/setters,
    - death hook integration (path clear, deselect, dead visual state),
    - health fields exposed in controller debug state.
  - Added zombie HP state integration in `apps/phaser/zombie/zombieController.js`:
    - `maxHp/currentHp/isDead` state,
    - clamped damage/heal/setters,
    - death hook integration (waypoint clear, dead visual state),
    - dead-state movement/waypoint rejection guards,
    - health fields exposed in controller debug state.
- Verification completed:
  - Syntax checks passed:
    - `node --check apps/phaser/combat/healthModel.js`
    - `node --check apps/phaser/human/humanController.js`
    - `node --check apps/phaser/zombie/zombieController.js`

### Phase 3: HP Bar Rendering

- Goal:
  - Show live HP bars above humans and zombies.
- Files:
  - `apps/phaser/ui/agentHpBarOverlay.js` (new)
  - `apps/phaser/phaserApp.js`
- Work:
  - Render bars in world-space overlay anchored to agent positions.
  - Update each frame and hide for despawned/dead units as configured.
- Verification:
  - Bars follow agents and update immediately after damage events.
- Exit criteria:
  - HP bars are readable and correct for both factions.

#### Phase 3 Status

- Implemented on March 19, 2026:
  - Added world-space HP bar overlay module `apps/phaser/ui/agentHpBarOverlay.js`.
  - Implemented always-visible HP bar rendering above:
    - human agent head,
    - zombie agent heads.
  - Wired HP bar overlay into Phaser runtime composition in `apps/phaser/phaserApp.js`:
    - create on scene boot,
    - render each runtime frame,
    - destroy on scene shutdown.
- Verification completed:
  - Syntax checks passed:
    - `node --check apps/phaser/ui/agentHpBarOverlay.js`
    - `node --check apps/phaser/phaserApp.js`

### Phase 4: Zombie Spawn Radius Around First Human

- Goal:
  - Spawn zombies around first human within distance band.
- Files:
  - `apps/phaser/zombie/zombieManager.js`
  - `apps/phaser/phaserRuntimeAdapter.js`
- Work:
  - Add startup batch spawn flow for `100` zombies.
  - Add ring sampling constrained to `10-100` tile distance.
  - Validate walkability and collision-safe spawn placement.
  - Add perimeter-outflow recycle flow: despawn out-of-perimeter zombies and spawn replacements.
  - Skip spawn attempt when no valid point is found.
- Verification:
  - Spawn distance metrics show all accepted spawns inside required band.
  - Active zombie count converges to target unless spawn attempts are skipped for invalid ring samples.
- Exit criteria:
  - Zombie spawns are stable and compliant with radius constraints.

#### Phase 4 Status

- Implemented on March 19, 2026:
  - Added first-contact zombie population policy in `apps/phaser/zombie/zombieManager.js`:
    - startup population fill toward target `100`,
    - ring-based spawn sampling constrained to `10-100` tiles around perimeter anchor,
    - walkability/collision-safe ring sample acceptance,
    - strict ring-spawn behavior with no nearest-walkable fallback for policy-driven spawns,
    - perimeter recycle flow that despawns zombies outside max radius and attempts in-ring replacement,
    - skip behavior when no valid ring spawn sample is found.
  - Added first-contact perimeter anchor wiring in `apps/phaser/phaserApp.js` using live human world position when a living human exists.
  - Removed the temporary single-zombie Phase 1 bootstrap spawn in favor of Phase 4 policy-driven population control.
  - Added first-contact population diagnostics to zombie manager debug state.
- Verification completed:
  - Syntax checks passed:
    - `node --check apps/phaser/zombie/zombieManager.js`
    - `node --check apps/phaser/phaserApp.js`

### Phase 5: Zombie Pursuit State

- Goal:
  - Add human target acquisition and pursuit behavior.
- Files:
  - `apps/phaser/zombie/zombieController.js`
  - `apps/phaser/zombie/zombieManager.js`
  - `apps/phaser/zombie/zombieWanderPlanner.js`
- Work:
  - Add cone-based detection and nearest-target selection.
  - Lock target to moving human waypoint and chase continuously.
  - Route pursuit movement through existing movement/collision primitives.
  - On line-of-sight loss, travel to last known waypoint then fall back to wander.
- Verification:
  - Zombies consistently pursue visible/reachable human targets.
- Exit criteria:
  - Pursuit is reliable and does not break wander fallback.

#### Phase 5 Status

- Implemented on March 19, 2026:
  - Added pursuit policy wiring in `apps/phaser/phaserApp.js` to provide live human targets to zombie systems in first-contact mode.
  - Extended `apps/phaser/zombie/zombieManager.js` with pursuit state machine behavior:
    - cone + line-of-sight target detection,
    - nearest-target acquisition for unlocked zombies,
    - lock-on pursuit behavior that continuously updates waypoint to tracked human position,
    - line-of-sight loss behavior that transitions to investigate mode and moves to last known waypoint before returning to wander,
    - wander gating so pursuit/investigate states are not overridden by random wander waypoint assignment.
  - Added pursuit diagnostics to zombie manager debug state (`pursuitPolicy` and per-zombie `pursuit` fields).
- Verification completed:
  - Syntax checks passed:
    - `node --check apps/phaser/phaserApp.js`
    - `node --check apps/phaser/zombie/zombieManager.js`

### Phase 6: Zombie Attack Loop + Human Damage

- Goal:
  - Add melee attack behavior that reduces human HP.
- Files:
  - `apps/phaser/combat/zombieAttackResolver.js` (new)
  - `apps/phaser/zombie/zombieController.js`
  - `apps/phaser/zombie/zombieManager.js`
  - `apps/phaser/human/humanController.js`
- Work:
  - Add touch-contact attack checks and `1.0s` cooldown timing.
  - Set attack damage to `20` HP per successful hit.
  - Apply damage to targeted human on successful attack ticks.
  - Render cooldown bar state for each zombie below HP bar.
  - Keep attack cadence deterministic under variable frame rates.
- Verification:
  - Human HP decreases only when attack rules are satisfied.
- Exit criteria:
  - End-to-end pursue -> attack -> damage loop works.

#### Phase 6 Status

- Implemented on March 19, 2026:
  - Added framework-agnostic attack resolver module `apps/phaser/combat/zombieAttackResolver.js`:
    - touch/contact range attack checks,
    - per-zombie cooldown ticking,
    - attack application with fixed damage and cooldown.
  - Extended `apps/phaser/phaserApp.js` zombie composition with first-contact `attackPolicy`:
    - damage per hit `20`,
    - cooldown `1.0s`,
    - live human target descriptors with:
      - world position,
      - touch radius,
      - `applyDamage(...)` callback.
  - Extended `apps/phaser/zombie/zombieManager.js` with attack loop integration:
    - per-zombie attack state tracking,
    - cooldown update and readiness checks each tick,
    - touch-contact attack execution against valid human targets,
    - pursuit-mode transition to `attack` while in contact and recovery back to pursuit/wander when out of range,
    - attack diagnostics exposed in manager debug state.
  - Updated `apps/phaser/ui/agentHpBarOverlay.js`:
    - zombie cooldown bar rendered below zombie HP bar,
    - cooldown fill reflects progress toward attack readiness.
- Verification completed:
  - Syntax checks passed:
    - `node --check apps/phaser/combat/zombieAttackResolver.js`
    - `node --check apps/phaser/zombie/zombieManager.js`
    - `node --check apps/phaser/phaserApp.js`
    - `node --check apps/phaser/ui/agentHpBarOverlay.js`

### Phase 7: Speed Ratio Enforcement

- Goal:
  - Enforce zombie speed at half human speed.
- Files:
  - `apps/phaser/human/humanController.js`
  - `apps/phaser/zombie/zombieController.js`
  - `apps/phaser/phaserApp.js`
- Work:
  - Define shared movement constants or injected tuning values.
  - Bind zombie speed to `humanSpeed * 0.5`.
- Verification:
  - Measured movement over identical interval confirms `0.5x` ratio.
- Exit criteria:
  - Speed ratio remains stable after runtime tuning reloads.

#### Phase 7 Status

- Implemented on March 19, 2026:
  - Added first-contact movement ratio constants in `apps/phaser/phaserApp.js`:
    - `FIRST_CONTACT_ZOMBIE_SPEED_RATIO_OF_HUMAN = 0.5`
    - `FIRST_CONTACT_ZOMBIE_MOVE_SPEED_TILES_PER_SECOND = HUMAN_MOVE_SPEED_TILES_PER_SECOND * 0.5`
  - Wired zombie move speed injection through runtime composition into `apps/phaser/zombie/zombieManager.js` so newly spawned zombies use the configured first-contact speed.
  - Extended `apps/phaser/zombie/zombieManager.js` debug output with `movementPolicy.configuredMoveSpeedTilesPerSecond`.
  - Normalized resolved human move speed usage in `apps/phaser/human/humanController.js` and exposed it via:
    - debug state (`moveSpeedTilesPerSecond`),
    - `getMoveSpeedTilesPerSecond()`.
  - Exposed resolved zombie move speed in `apps/phaser/zombie/zombieController.js` via:
    - debug state (`moveSpeedTilesPerSecond`),
    - `getMoveSpeedTilesPerSecond()`.
- Verification completed:
  - Syntax checks passed:
    - `node --check apps/phaser/human/humanController.js`
    - `node --check apps/phaser/zombie/zombieController.js`
    - `node --check apps/phaser/zombie/zombieManager.js`
    - `node --check apps/phaser/phaserApp.js`

### Phase 8: Human Death -> Game Over

- Goal:
  - Trigger game-over UI state on all-human extinction.
- Files:
  - `apps/phaser/ui/gameOverOverlay.js` (new)
  - `apps/phaser/phaserApp.js`
  - `apps/phaser/human/humanCommandController.js`
- Work:
  - Observe human roster and activate game-over overlay when no humans remain alive.
  - Keep world simulation running while game-over overlay is active.
- Verification:
  - Last-human death always transitions to game-over state with visible UI.
- Exit criteria:
  - Game-over flow is deterministic and passive (no button actions required in this slice).

#### Phase 8 Status

- Implemented on March 19, 2026:
  - Added game-over UI module `apps/phaser/ui/gameOverOverlay.js` for overlay-only game-over presentation (no buttons).
  - Added game-over overlay visual styling in `style.css`.
  - Wired game-over lifecycle in `apps/phaser/phaserApp.js`:
    - create overlay at runtime boot,
    - evaluate living-human count each update,
    - show overlay when no humans remain alive,
    - keep simulation loops running while overlay is visible,
    - destroy overlay on scene shutdown.
  - Added explicit dead-human command guard in `apps/phaser/human/humanCommandController.js` (`reason: "human_dead"`).
- Verification completed:
  - Syntax checks passed:
    - `node --check apps/phaser/ui/gameOverOverlay.js`
    - `node --check apps/phaser/phaserApp.js`
    - `node --check apps/phaser/human/humanCommandController.js`

### Phase 9: Stability, Debug Diagnostics, and Docs Sync

- Goal:
  - Harden first-contact loop and align docs with runtime reality.
- Files:
  - `apps/phaser/debug/*.js`
  - `documentation/GAME_ARCHITECTURE.md`
  - `documentation/GAME_RUNTIME.md`
  - `documentation/MODULE_API_REFERENCE.md`
  - `documentation/GAME_OVERVIEW.md`
- Work:
  - Add diagnostics for HP, pursuit targeting, and attack states.
  - Stress test spawn/pursuit/attack/death transitions.
  - Sync architecture/runtime/API docs.
- Verification:
  - No runtime errors in repeated first-contact test cycles.
- Exit criteria:
  - First-contact slice is stable and fully documented.

#### Phase 9 Status

- Implemented on March 19, 2026:
  - Expanded zombie manager diagnostics in `apps/phaser/zombie/zombieManager.js`:
    - added per-cycle pursuit summary metrics (`lastPursuitCycle`),
    - added per-cycle attack summary metrics (`lastAttackCycle`),
    - added aggregate zombie health/pursuit/attack summaries in `getDebugState()`.
  - Added first-contact debug panel module `apps/phaser/debug/firstContactDiagnosticsPanel.js`:
    - human HP/death status,
    - zombie HP summary,
    - pursuit mode/lock diagnostics,
    - attack readiness and per-cycle outcome diagnostics,
    - first-contact population cycle diagnostics.
  - Wired diagnostics panel into runtime composition in `apps/phaser/phaserApp.js` (first-contact mode only).
  - Added diagnostics panel styling in `style.css`.
  - Synced first-contact docs:
    - `documentation/GAME_ARCHITECTURE.md`
    - `documentation/GAME_RUNTIME.md`
    - `documentation/MODULE_API_REFERENCE.md`
    - `documentation/GAME_OVERVIEW.md`
- Verification completed:
  - Syntax checks passed:
    - `node --check apps/phaser/debug/firstContactDiagnosticsPanel.js`
    - `node --check apps/phaser/zombie/zombieManager.js`
    - `node --check apps/phaser/phaserApp.js`
- Manual runtime stress verification:
  - Pending interactive in-browser validation for prolonged spawn/pursuit/attack/game-over soak runs.

### Phase 10: Human 8-Direction Movement

- Goal:
  - Allow human movement/pathing in 8 directions (cardinal + diagonal).
- Files:
  - `engine/world/subTilePathfinder.js`
  - `documentation/GAME_RUNTIME.md`
  - `documentation/MODULE_API_REFERENCE.md`
- Work:
  - Expand pathfinder neighbor expansion from 4-direction to 8-direction.
  - Add directional movement costs:
    - cardinal step cost: `1.0`
    - diagonal step cost: `sqrt(2)`
  - Use octile heuristic for 8-direction grid search.
  - Enforce diagonal corner-safety policy:
    - reject diagonal steps that cut through blocked corner geometry.
  - Keep human speed constant (no diagonal speed boost from command input/path following).
  - Update debug/diagnostic output so diagonal path segments are observable during testing.
- Verification:
  - Commanded paths include diagonal segments when optimal.
  - Humans do not clip through wall corners during diagonal travel.
  - Pathfinding remains deterministic and within configured path-node budgets.
  - Existing command retry/expansion logic still resolves long-range goals.
- Exit criteria:
  - Human agent traverses in 8 directions reliably with no regression to collision or command stability.

#### Phase 10 Status

- Implemented on March 19, 2026:
  - Updated `engine/world/subTilePathfinder.js` to support 8-direction traversal:
    - added diagonal neighbors with `sqrt(2)` cost,
    - retained cardinal neighbors with `1.0` cost,
    - switched heuristic from Manhattan to octile distance.
  - Added diagonal corner-cut prevention in path expansion:
    - diagonal step is rejected unless both adjacent cardinal cells are walkable.
  - Synced runtime/API docs:
    - `documentation/GAME_RUNTIME.md`
    - `documentation/MODULE_API_REFERENCE.md`
  - Confirmed existing human command/controller/debug modules were already compatible with diagonal waypoint segments (no code changes required):
    - `apps/phaser/human/humanCommandController.js`
    - `apps/phaser/human/humanController.js`
    - `apps/phaser/debug/humanDebugOverlay.js`
- Verification completed:
  - Syntax checks passed:
    - `node --check engine/world/subTilePathfinder.js`
  - Behavior checks passed:
    - diagonal path selected in open-space scenario,
    - corner-cut diagonal correctly rejected when adjacent corner cell is blocked.

## Acceptance Criteria

- Human and zombie agents spawn with `100 HP`.
- Human and zombie HP bars are visible above heads and update correctly.
- Zombie attack cooldown bar is visible below zombie HP bar and reflects `1s` cooldown state.
- Human control loop is active again in runtime.
- Runtime attempts startup spawn target of `100` zombies using only `10-100` tile ring points from first human.
- Zombies that exit perimeter are despawned and replaced in-ring.
- Zombies pursue nearest in-cone humans and move to last known waypoint on line-of-sight loss.
- Zombies attack by touch contact and deal `20` damage per hit with `1s` cooldown.
- Zombie speed is `50%` of human speed.
- Game-over screen appears when no humans remain alive.
- World simulation continues while game-over overlay is visible.
- Human agent can traverse using 8-direction pathing (including diagonal movement) without corner clipping.
- Runtime does not regress core camera/streaming/input stability.

## Risks and Mitigations

- Risk: Spawn ring produces invalid points in dense blocked geometry.
  - Mitigation: bounded retries, skip invalid attempts, and rejection telemetry.
- Risk: Pursuit + attack state churn causes jitter or oscillation.
  - Mitigation: add hysteresis/timers for target loss and state transitions.
- Risk: HP bars add render cost with high zombie counts.
  - Mitigation: cull off-screen bars and batch draw where possible.
- Risk: Perimeter recycle churn can cause frequent despawn/spawn bursts.
  - Mitigation: enforce recycle checks on fixed interval and cap replacements per tick.
- Risk: Game-over overlay state can desync from living-human count during rapid death transitions.
  - Mitigation: derive overlay activation directly from authoritative living-human count each frame/tick.
- Risk: Diagonal movement can introduce corner clipping through obstacle corners.
  - Mitigation: enforce corner-block checks for diagonal neighbor expansion and add targeted corner-case tests.

## Phase 0 Locked Decisions (March 19, 2026)

1. Spawn cadence policy
   - Spawn full zombie set at runtime start.
   - If zombie exits perimeter, despawn and attempt replacement spawn in valid radius ring.
2. Spawn count/cap policy
   - Initial target active zombies: `100`.
3. Spawn fallback policy
   - If no valid spawn point exists in `10-100` tile ring, skip spawn attempt.
4. Pursuit detection policy
   - Pursuit starts when human enters zombie vision cone.
5. Target selection policy
   - Zombie selects nearest valid human target.
6. Attack tuning policy
   - Touch/contact attack only.
   - Damage per hit: `20`.
   - Cooldown: `1.0 second`.
   - Cooldown visualization: bar rendered below zombie HP bar.
7. Human death policy
   - Game-over triggers when no humans remain alive.
8. Game-over UX policy
   - No game-over buttons in this slice (manual page refresh reset).
9. Zombie death policy
   - Zombies cannot die in this slice.
   - Keep zombie HP foundations for future combat extension.
10. HP bar visibility policy
   - HP bars are always visible.
11. Pause semantics policy
   - World simulation continues while game-over overlay is shown.
12. Perimeter interpretation
   - Perimeter outflow uses max ring distance (`100 tiles`) from nearest living human.

## Phase 0 Decision Checklist

- [x] Runtime mode name/policy locked.
- [x] Spawn cadence/count/cap locked.
- [x] Pursuit detection policy locked.
- [x] Attack range/damage/cooldown locked.
- [x] Human death trigger policy locked.
- [x] Game-over UX + pause semantics locked.
- [x] HP bar visibility policy locked.

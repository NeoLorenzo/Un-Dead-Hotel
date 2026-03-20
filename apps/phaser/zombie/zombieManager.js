import {
  createZombieController,
  ZOMBIE_COLLIDER_RADIUS_TILES,
  ZOMBIE_TEXTURE_KEY,
} from "./zombieController.js";
import {
  createZombieAttackResolver,
  DEFAULT_ZOMBIE_ATTACK_COOLDOWN_SECONDS,
  DEFAULT_ZOMBIE_ATTACK_DAMAGE,
} from "../combat/zombieAttackResolver.js";
import { createZombieWanderPlanner } from "./zombieWanderPlanner.js";

const DEFAULT_SPAWN_SEARCH_RADIUS_TILES = 3;
const DEFAULT_WAYPOINT_CANDIDATE_ATTEMPTS = 10;
const DEFAULT_WAYPOINT_CONTINUATION_ATTEMPTS = 6;
const DEFAULT_WAYPOINT_CONE_CLIP_RAY_COUNT = 20;
const DEFAULT_NO_CANDIDATE_STREAK_THRESHOLD = 6;
const DEFAULT_RECOVERY_DURATION_SECONDS = 0.6;
const DEFAULT_RECOVERY_ROTATE_RADIANS_PER_SECOND = 4.8;
const DEFAULT_FAILED_SECTOR_MEMORY_TTL_SECONDS = 1.5;
const DEFAULT_FAILED_SECTOR_HALF_ANGLE_DEGREES = 18;
const DEFAULT_NO_CANDIDATE_REPICK_COOLDOWN_SECONDS = 0.12;
const SOFT_SEPARATION_MIN_DISTANCE_TILES = ZOMBIE_COLLIDER_RADIUS_TILES * 2;
const SOFT_SEPARATION_STRENGTH = 0.45;
const SOFT_SEPARATION_EPSILON = 0.000001;
const DEFAULT_FIRST_CONTACT_TARGET_ZOMBIES = 100;
const DEFAULT_FIRST_CONTACT_MIN_SPAWN_RADIUS_TILES = 10;
const DEFAULT_FIRST_CONTACT_MAX_SPAWN_RADIUS_TILES = 100;
const DEFAULT_FIRST_CONTACT_RING_SAMPLE_ATTEMPTS = 10;
const DEFAULT_FIRST_CONTACT_MAX_SPAWNS_PER_UPDATE = 16;
const DEFAULT_FIRST_CONTACT_MAX_RECYCLES_PER_UPDATE = 16;
const DEFAULT_FIRST_CONTACT_PERIMETER_CHECK_INTERVAL_SECONDS = 0.25;
const DEFAULT_PURSUIT_LINE_CHECK_STEP_TILES = 0.2;

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function normalizeWorldPoint(point) {
  return {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
  };
}

function normalizeAngleRadians(angleRadians) {
  let angle = Number(angleRadians) || 0;
  while (angle > Math.PI) {
    angle -= Math.PI * 2;
  }
  while (angle < -Math.PI) {
    angle += Math.PI * 2;
  }
  return angle;
}

function shortestAngleDeltaRadians(fromRadians, toRadians) {
  return normalizeAngleRadians(toRadians - fromRadians);
}

function normalizeTilePoint(point) {
  return {
    x: Math.floor(Number(point?.x) || 0),
    y: Math.floor(Number(point?.y) || 0),
  };
}

function buildZombieTexture(scene, textureKey) {
  if (scene.textures.exists(textureKey)) {
    return;
  }

  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const size = 64;
  const cx = size * 0.5;
  const bodyRadius = 19;
  const headRadius = 10;

  g.clear();
  g.fillStyle(0x4e8f58, 1);
  g.fillCircle(cx, cx + 5, bodyRadius);
  g.fillStyle(0xa4c58f, 1);
  g.fillCircle(cx, cx - 11, headRadius);
  g.lineStyle(3, 0x1b2b1e, 1);
  g.strokeCircle(cx, cx + 5, bodyRadius);
  g.lineStyle(2, 0x1b2b1e, 1);
  g.strokeCircle(cx, cx - 11, headRadius);
  g.generateTexture(textureKey, size, size);
  g.destroy();
}

function isWalkableWorldPoint(runtime, worldX, worldY) {
  if (typeof runtime.isWalkableWorldPoint === "function") {
    return runtime.isWalkableWorldPoint(worldX, worldY, ZOMBIE_COLLIDER_RADIUS_TILES);
  }
  const tile = runtime.worldToTile(worldX, worldY);
  return runtime.isWalkableTile(tile.x, tile.y);
}

function isWalkableTileCenter(runtime, tileX, tileY) {
  if (!runtime.isWalkableTile(tileX, tileY)) {
    return false;
  }
  const center = runtime.tileToWorldCenter(tileX, tileY);
  return isWalkableWorldPoint(runtime, center.x, center.y);
}

function findNearestWalkableTile(runtime, startTile, maxRadius) {
  if (!runtime || !startTile) {
    return null;
  }

  if (isWalkableTileCenter(runtime, startTile.x, startTile.y)) {
    return {
      x: startTile.x,
      y: startTile.y,
    };
  }

  const cappedRadius = Math.max(0, Math.floor(maxRadius));
  for (let radius = 1; radius <= cappedRadius; radius += 1) {
    const minX = startTile.x - radius;
    const maxX = startTile.x + radius;
    const minY = startTile.y - radius;
    const maxY = startTile.y + radius;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (Math.max(Math.abs(x - startTile.x), Math.abs(y - startTile.y)) !== radius) {
          continue;
        }
        if (isWalkableTileCenter(runtime, x, y)) {
          return { x, y };
        }
      }
    }
  }

  return null;
}

export function createZombieManager({
  scene,
  runtime,
  spawnSearchRadiusTiles = DEFAULT_SPAWN_SEARCH_RADIUS_TILES,
  moveSpeedTilesPerSecond = undefined,
  firstContactPolicy = null,
  pursuitPolicy = null,
  attackPolicy = null,
  waypointCandidateAttempts = DEFAULT_WAYPOINT_CANDIDATE_ATTEMPTS,
  waypointContinuationAttempts = DEFAULT_WAYPOINT_CONTINUATION_ATTEMPTS,
  waypointConeClipRayCount = DEFAULT_WAYPOINT_CONE_CLIP_RAY_COUNT,
  noCandidateStreakThreshold = DEFAULT_NO_CANDIDATE_STREAK_THRESHOLD,
  recoveryDurationSeconds = DEFAULT_RECOVERY_DURATION_SECONDS,
  recoveryRotateRadiansPerSecond = DEFAULT_RECOVERY_ROTATE_RADIANS_PER_SECOND,
  failedSectorMemoryTtlSeconds = DEFAULT_FAILED_SECTOR_MEMORY_TTL_SECONDS,
  failedSectorHalfAngleDegrees = DEFAULT_FAILED_SECTOR_HALF_ANGLE_DEGREES,
  noCandidateRepickCooldownSeconds = DEFAULT_NO_CANDIDATE_REPICK_COOLDOWN_SECONDS,
} = {}) {
  if (!scene || !runtime) {
    throw new Error("createZombieManager requires scene and runtime.");
  }

  buildZombieTexture(scene, ZOMBIE_TEXTURE_KEY);
  const wanderPlanner = createZombieWanderPlanner({
    runtime,
    candidateAttempts: waypointCandidateAttempts,
    continuationAttempts: waypointContinuationAttempts,
    coneClipRayCount: waypointConeClipRayCount,
  });

  const zombies = [];
  const waypointSelectionDebugById = new Map();
  const wanderStateById = new Map();
  const pursuitStateById = new Map();
  const attackStateById = new Map();
  let nextZombieId = 1;
  let lastSpawnAttempt = null;
  const failedSectorHalfAngleRadians = (failedSectorHalfAngleDegrees * Math.PI) / 180;
  const firstContactEnabled = Boolean(firstContactPolicy?.enabled);
  const firstContactSpawnMinRadiusTiles = Math.max(
    0,
    Number(firstContactPolicy?.minSpawnRadiusTiles) ||
      DEFAULT_FIRST_CONTACT_MIN_SPAWN_RADIUS_TILES
  );
  const firstContactSpawnMaxRadiusTiles = Math.max(
    firstContactSpawnMinRadiusTiles,
    Number(firstContactPolicy?.maxSpawnRadiusTiles) ||
      DEFAULT_FIRST_CONTACT_MAX_SPAWN_RADIUS_TILES
  );
  const firstContactTargetZombieCount = Math.max(
    0,
    Math.floor(
      Number(firstContactPolicy?.targetZombieCount) ||
        DEFAULT_FIRST_CONTACT_TARGET_ZOMBIES
    )
  );
  const firstContactRingSampleAttempts = Math.max(
    1,
    Math.floor(
      Number(firstContactPolicy?.ringSampleAttempts) ||
        DEFAULT_FIRST_CONTACT_RING_SAMPLE_ATTEMPTS
    )
  );
  const firstContactMaxSpawnsPerUpdate = Math.max(
    1,
    Math.floor(
      Number(firstContactPolicy?.maxSpawnsPerUpdate) ||
        DEFAULT_FIRST_CONTACT_MAX_SPAWNS_PER_UPDATE
    )
  );
  const firstContactMaxRecyclesPerUpdate = Math.max(
    1,
    Math.floor(
      Number(firstContactPolicy?.maxRecyclesPerUpdate) ||
        DEFAULT_FIRST_CONTACT_MAX_RECYCLES_PER_UPDATE
    )
  );
  const firstContactPerimeterCheckIntervalSeconds = Math.max(
    0.02,
    Number(firstContactPolicy?.perimeterCheckIntervalSeconds) ||
      DEFAULT_FIRST_CONTACT_PERIMETER_CHECK_INTERVAL_SECONDS
  );
  let firstContactPerimeterCheckCooldown = 0;
  let lastFirstContactCycle = null;
  let lastPursuitCycle = null;
  let lastAttackCycle = null;
  const pursuitEnabled = Boolean(pursuitPolicy?.enabled);
  const pursuitLineCheckStepTiles = Math.max(
    0.05,
    Number(pursuitPolicy?.lineCheckStepTiles) ||
      DEFAULT_PURSUIT_LINE_CHECK_STEP_TILES
  );
  const configuredZombieMoveSpeedTilesPerSecond = Number.isFinite(
    moveSpeedTilesPerSecond
  )
    ? Math.max(0.01, Number(moveSpeedTilesPerSecond))
    : null;
  const attackEnabled = Boolean(attackPolicy?.enabled);
  const zombieAttackResolver = createZombieAttackResolver({
    damagePerHit:
      Number(attackPolicy?.damagePerHit) || DEFAULT_ZOMBIE_ATTACK_DAMAGE,
    cooldownSeconds:
      Number(attackPolicy?.cooldownSeconds) ||
      DEFAULT_ZOMBIE_ATTACK_COOLDOWN_SECONDS,
    zombieTouchRadiusTiles:
      Number(attackPolicy?.zombieTouchRadiusTiles) || ZOMBIE_COLLIDER_RADIUS_TILES,
  });

  function createInitialWanderState(zombieId) {
    return {
      zombieId,
      noCandidateStreak: 0,
      recoveryRemainingSeconds: 0,
      recoveryDirection: zombieId % 2 === 0 ? 1 : -1,
      failedSectors: [],
      repickCooldownRemainingSeconds: 0,
    };
  }

  function createInitialPursuitState() {
    return {
      mode: "wander",
      targetId: null,
      lastKnownWorld: null,
      hasLineOfSight: false,
      distanceToTarget: null,
    };
  }

  function createInitialAttackState() {
    return {
      cooldownRemainingSeconds: 0,
      lastAttackTargetId: null,
      lastAttackDamage: 0,
      lastAttackApplied: false,
    };
  }

  function getWanderState(zombieId) {
    let state = wanderStateById.get(zombieId);
    if (!state) {
      state = createInitialWanderState(zombieId);
      wanderStateById.set(zombieId, state);
    }
    return state;
  }

  function getPursuitState(zombieId) {
    let state = pursuitStateById.get(zombieId);
    if (!state) {
      state = createInitialPursuitState();
      pursuitStateById.set(zombieId, state);
    }
    return state;
  }

  function getAttackState(zombieId) {
    let state = attackStateById.get(zombieId);
    if (!state) {
      state = createInitialAttackState();
      attackStateById.set(zombieId, state);
    }
    return state;
  }

  function decayWanderState(state, dtSeconds) {
    const dt = Math.max(0, Number(dtSeconds) || 0);
    if (dt <= 0) {
      return;
    }

    if (state.recoveryRemainingSeconds > 0) {
      state.recoveryRemainingSeconds = Math.max(0, state.recoveryRemainingSeconds - dt);
    }
    if (state.repickCooldownRemainingSeconds > 0) {
      state.repickCooldownRemainingSeconds = Math.max(
        0,
        state.repickCooldownRemainingSeconds - dt
      );
    }

    const nextFailedSectors = [];
    for (const sector of state.failedSectors) {
      const nextTtl = Math.max(0, (Number(sector?.ttlSeconds) || 0) - dt);
      if (nextTtl <= 0) {
        continue;
      }
      nextFailedSectors.push({
        centerRadians: normalizeAngleRadians(sector.centerRadians || 0),
        halfAngleRadians: Math.max(0, Number(sector.halfAngleRadians) || 0),
        ttlSeconds: nextTtl,
      });
    }
    state.failedSectors = nextFailedSectors;
  }

  function registerFailedSector(state, headingRadians) {
    state.failedSectors.push({
      centerRadians: normalizeAngleRadians(headingRadians),
      halfAngleRadians: Math.max(0, failedSectorHalfAngleRadians),
      ttlSeconds: Math.max(0, Number(failedSectorMemoryTtlSeconds) || 0),
    });
  }

  function activateRecovery(state) {
    state.recoveryRemainingSeconds = Math.max(0, Number(recoveryDurationSeconds) || 0);
    if (state.recoveryRemainingSeconds <= 0) {
      return;
    }
    if (state.recoveryDirection === 0) {
      state.recoveryDirection = state.zombieId % 2 === 0 ? 1 : -1;
    }
  }

  function activateRepickCooldown(state) {
    state.repickCooldownRemainingSeconds = Math.max(
      0,
      Number(noCandidateRepickCooldownSeconds) || 0
    );
  }

  function applyRecoveryHeading(zombie, state, dtSeconds) {
    if (state.recoveryRemainingSeconds <= 0) {
      return false;
    }
    const dt = Math.max(0, Number(dtSeconds) || 0);
    if (dt <= 0) {
      return false;
    }
    const rotateDelta =
      Math.max(0, Number(recoveryRotateRadiansPerSecond) || 0) *
      dt *
      (state.recoveryDirection || 1);
    if (Math.abs(rotateDelta) <= 0.000001) {
      return false;
    }
    return zombie.rotateHeading(rotateDelta);
  }

  function getPursuitTargets() {
    if (!pursuitEnabled) {
      return [];
    }
    if (typeof pursuitPolicy?.getTargets !== "function") {
      return [];
    }

    const rawTargets = pursuitPolicy.getTargets();
    if (!Array.isArray(rawTargets)) {
      return [];
    }

    const targets = [];
    for (const rawTarget of rawTargets) {
      const id = rawTarget?.id;
      const world = normalizeWorldPoint(rawTarget?.world);
      if ((typeof id !== "string" && !Number.isFinite(id)) || !isFiniteNumber(world.x) || !isFiniteNumber(world.y)) {
        continue;
      }
      targets.push({
        id,
        world,
      });
    }
    return targets;
  }

  function getAttackTargets() {
    if (!attackEnabled) {
      return [];
    }
    if (typeof attackPolicy?.getTargets !== "function") {
      return [];
    }

    const rawTargets = attackPolicy.getTargets();
    if (!Array.isArray(rawTargets)) {
      return [];
    }

    const targets = [];
    for (const rawTarget of rawTargets) {
      const id = rawTarget?.id;
      const world = normalizeWorldPoint(rawTarget?.world);
      const touchRadiusTiles = Math.max(
        0.01,
        Number(rawTarget?.touchRadiusTiles) || 0.29
      );
      if (
        (typeof id !== "string" && !Number.isFinite(id)) ||
        !isFiniteNumber(world.x) ||
        !isFiniteNumber(world.y)
      ) {
        continue;
      }
      if (typeof rawTarget?.isDead === "function" && rawTarget.isDead()) {
        continue;
      }
      if (typeof rawTarget?.applyDamage !== "function") {
        continue;
      }
      targets.push({
        id,
        world,
        touchRadiusTiles,
        applyDamage: rawTarget.applyDamage,
      });
    }
    return targets;
  }

  function hasClearLineOfSight(startWorld, endWorld) {
    const dx = endWorld.x - startWorld.x;
    const dy = endWorld.y - startWorld.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.000001) {
      return isWalkableWorldPoint(runtime, endWorld.x, endWorld.y);
    }

    const sampleCount = Math.max(1, Math.ceil(distance / pursuitLineCheckStepTiles));
    for (let i = 1; i <= sampleCount; i += 1) {
      const t = i / sampleCount;
      const sampleX = startWorld.x + dx * t;
      const sampleY = startWorld.y + dy * t;
      if (!isWalkableWorldPoint(runtime, sampleX, sampleY)) {
        return false;
      }
    }
    return true;
  }

  function isTargetInsideVisionCone(zombie, zombieWorld, targetWorld) {
    const cone = zombie.getVisionCone();
    const coneRangeTiles = Math.max(0, Number(cone?.rangeTiles) || 0);
    const coneHalfAngleRadians =
      ((Math.max(0, Number(cone?.angleDegrees) || 0) * Math.PI) / 180) * 0.5;

    const dx = targetWorld.x - zombieWorld.x;
    const dy = targetWorld.y - zombieWorld.y;
    const distance = Math.hypot(dx, dy);
    if (distance > coneRangeTiles) {
      return false;
    }
    if (distance <= 0.000001) {
      return true;
    }

    const heading = zombie.getHeadingRadians();
    const angleToTarget = Math.atan2(dy, dx);
    const delta = Math.abs(shortestAngleDeltaRadians(heading, angleToTarget));
    return delta <= coneHalfAngleRadians;
  }

  function findTargetById(targets, targetId) {
    if (!Array.isArray(targets)) {
      return null;
    }
    for (const target of targets) {
      if (target.id === targetId) {
        return target;
      }
    }
    return null;
  }

  function findNearestVisibleTarget(zombie, zombieWorld, targets) {
    let best = null;
    for (const target of targets) {
      if (!isTargetInsideVisionCone(zombie, zombieWorld, target.world)) {
        continue;
      }
      if (!hasClearLineOfSight(zombieWorld, target.world)) {
        continue;
      }
      const dx = target.world.x - zombieWorld.x;
      const dy = target.world.y - zombieWorld.y;
      const distance = Math.hypot(dx, dy);
      if (!best || distance < best.distance) {
        best = {
          target,
          distance,
        };
      }
    }
    return best;
  }

  function attemptSetZombieWaypoint(zombie, targetWorld) {
    if (!targetWorld) {
      return false;
    }
    return zombie.setWaypointWorld(targetWorld);
  }

  function runPursuitStep() {
    if (!pursuitEnabled) {
      lastPursuitCycle = {
        enabled: false,
      };
      return false;
    }

    const targets = getPursuitTargets();
    let changed = false;
    const cycle = {
      enabled: true,
      targetCount: targets.length,
      zombieCount: zombies.length,
      aliveZombieCount: 0,
      acquiredLockCount: 0,
      maintainedLockCount: 0,
      lostLockCount: 0,
      zombiesWithTargetLock: 0,
      zombiesWithLineOfSight: 0,
      modeCounts: {
        wander: 0,
        pursuit: 0,
        investigate: 0,
        attack: 0,
        unknown: 0,
      },
    };

    for (const zombie of zombies) {
      const pursuitState = getPursuitState(zombie.getId());
      if (typeof zombie.isDead === "function" && zombie.isDead()) {
        pursuitState.mode = "wander";
        pursuitState.targetId = null;
        pursuitState.lastKnownWorld = null;
        pursuitState.hasLineOfSight = false;
        pursuitState.distanceToTarget = null;
        continue;
      }
      cycle.aliveZombieCount += 1;

      const previousTargetId = pursuitState.targetId;
      const zombieWorld = zombie.getWorldPosition();
      let activeLock = false;
      if (pursuitState.targetId !== null) {
        const lockedTarget = findTargetById(targets, pursuitState.targetId);
        if (
          lockedTarget &&
          isTargetInsideVisionCone(zombie, zombieWorld, lockedTarget.world) &&
          hasClearLineOfSight(zombieWorld, lockedTarget.world)
        ) {
          const accepted = attemptSetZombieWaypoint(zombie, lockedTarget.world);
          if (accepted) {
            changed = true;
          }
          pursuitState.mode = "pursuit";
          pursuitState.hasLineOfSight = true;
          pursuitState.lastKnownWorld = { ...lockedTarget.world };
          pursuitState.distanceToTarget = Math.hypot(
            lockedTarget.world.x - zombieWorld.x,
            lockedTarget.world.y - zombieWorld.y
          );
          cycle.maintainedLockCount += 1;
          activeLock = true;
        } else {
          pursuitState.targetId = null;
          pursuitState.hasLineOfSight = false;
          cycle.lostLockCount += 1;
        }
      }

      if (!activeLock && pursuitState.targetId === null) {
        const nearestVisible = findNearestVisibleTarget(zombie, zombieWorld, targets);
        if (nearestVisible?.target) {
          pursuitState.targetId = nearestVisible.target.id;
          pursuitState.mode = "pursuit";
          pursuitState.hasLineOfSight = true;
          pursuitState.lastKnownWorld = { ...nearestVisible.target.world };
          pursuitState.distanceToTarget = nearestVisible.distance;
          const accepted = attemptSetZombieWaypoint(zombie, nearestVisible.target.world);
          if (accepted) {
            changed = true;
          }
          if (previousTargetId === null) {
            cycle.acquiredLockCount += 1;
          }
          cycle.zombiesWithTargetLock += 1;
          if (pursuitState.hasLineOfSight) {
            cycle.zombiesWithLineOfSight += 1;
          }
          cycle.modeCounts.pursuit += 1;
          continue;
        }
      }

      if (pursuitState.targetId === null && pursuitState.lastKnownWorld) {
        if (pursuitState.mode === "investigate") {
          if (!zombie.hasWaypoint()) {
            // Investigate destination reached: drop memory and return to wander.
            pursuitState.mode = "wander";
            pursuitState.lastKnownWorld = null;
            pursuitState.distanceToTarget = null;
          }
        } else {
          const accepted = attemptSetZombieWaypoint(zombie, pursuitState.lastKnownWorld);
          if (accepted) {
            changed = true;
            pursuitState.mode = "investigate";
            pursuitState.hasLineOfSight = false;
            pursuitState.distanceToTarget = null;
          } else {
            pursuitState.mode = "wander";
            pursuitState.lastKnownWorld = null;
            pursuitState.distanceToTarget = null;
          }
        }
      }

      if (pursuitState.targetId !== null) {
        cycle.zombiesWithTargetLock += 1;
      }
      if (pursuitState.hasLineOfSight) {
        cycle.zombiesWithLineOfSight += 1;
      }
      const mode = pursuitState.mode;
      if (mode === "wander") {
        cycle.modeCounts.wander += 1;
      } else if (mode === "pursuit") {
        cycle.modeCounts.pursuit += 1;
      } else if (mode === "investigate") {
        cycle.modeCounts.investigate += 1;
      } else if (mode === "attack") {
        cycle.modeCounts.attack += 1;
      } else {
        cycle.modeCounts.unknown += 1;
      }
    }

    lastPursuitCycle = cycle;
    return changed;
  }

  function runAttackStep(dtSeconds) {
    if (!attackEnabled) {
      lastAttackCycle = {
        enabled: false,
      };
      return false;
    }

    const targets = getAttackTargets();
    let changed = false;
    const dt = Math.max(0, Number(dtSeconds) || 0);
    const cycle = {
      enabled: true,
      zombieCount: zombies.length,
      aliveZombieCount: 0,
      deadZombieCount: 0,
      targetCount: targets.length,
      attackedCount: 0,
      cooldownBlockedCount: 0,
      outOfRangeCount: 0,
      invalidTargetCount: 0,
      noTargetCount: 0,
      otherFailureCount: 0,
      readyZombieCount: 0,
      cooldownActiveZombieCount: 0,
    };

    for (const zombie of zombies) {
      const zombieId = zombie.getId();
      const attackState = getAttackState(zombieId);
      zombieAttackResolver.tickCooldown(attackState, dt);

      if (typeof zombie.isDead === "function" && zombie.isDead()) {
        attackState.lastAttackApplied = false;
        cycle.deadZombieCount += 1;
        continue;
      }
      cycle.aliveZombieCount += 1;
      if (targets.length === 0) {
        attackState.lastAttackApplied = false;
        cycle.noTargetCount += 1;
        if (zombieAttackResolver.isOnCooldown(attackState)) {
          cycle.cooldownActiveZombieCount += 1;
        } else {
          cycle.readyZombieCount += 1;
        }
        continue;
      }

      const pursuitState = getPursuitState(zombieId);
      const zombieWorld = zombie.getWorldPosition();
      let target = null;
      if (pursuitState.targetId !== null) {
        target = findTargetById(targets, pursuitState.targetId);
      }
      if (!target) {
        let nearest = null;
        for (const candidate of targets) {
          const dx = candidate.world.x - zombieWorld.x;
          const dy = candidate.world.y - zombieWorld.y;
          const distance = Math.hypot(dx, dy);
          if (!nearest || distance < nearest.distance) {
            nearest = { target: candidate, distance };
          }
        }
        target = nearest?.target || null;
      }

      if (!target) {
        attackState.lastAttackApplied = false;
        cycle.noTargetCount += 1;
        if (zombieAttackResolver.isOnCooldown(attackState)) {
          cycle.cooldownActiveZombieCount += 1;
        } else {
          cycle.readyZombieCount += 1;
        }
        continue;
      }

      const attackResult = zombieAttackResolver.attemptAttack({
        zombieWorld,
        targetWorld: target.world,
        targetTouchRadiusTiles: target.touchRadiusTiles,
        attackState,
        applyTargetDamage: target.applyDamage,
        targetId: target.id,
      });
      if (attackResult.attacked) {
        attackState.lastAttackApplied = true;
        pursuitState.mode = "attack";
        cycle.attackedCount += 1;
        changed = true;
      } else {
        attackState.lastAttackApplied = false;
        if (attackResult.reason === "cooldown") {
          cycle.cooldownBlockedCount += 1;
        } else if (attackResult.reason === "out_of_range") {
          cycle.outOfRangeCount += 1;
        } else if (attackResult.reason === "invalid_target") {
          cycle.invalidTargetCount += 1;
        } else if (attackResult.reason === "missing_attack_state") {
          cycle.otherFailureCount += 1;
        } else {
          cycle.otherFailureCount += 1;
        }
        if (
          pursuitState.mode === "attack" &&
          attackResult.reason === "out_of_range"
        ) {
          pursuitState.mode =
            pursuitState.targetId !== null ? "pursuit" : "wander";
        }
      }

      if (zombieAttackResolver.isOnCooldown(attackState)) {
        cycle.cooldownActiveZombieCount += 1;
      } else {
        cycle.readyZombieCount += 1;
      }
    }

    lastAttackCycle = cycle;
    return changed;
  }

  function shouldUseWanderForZombie(zombieId) {
    if (!pursuitEnabled) {
      return true;
    }
    const pursuitState = getPursuitState(zombieId);
    return pursuitState.mode === "wander";
  }

  function getFirstContactPerimeterAnchors() {
    if (!firstContactEnabled) {
      return [];
    }
    if (typeof firstContactPolicy?.getPerimeterAnchors !== "function") {
      return [];
    }

    const rawAnchors = firstContactPolicy.getPerimeterAnchors();
    if (!Array.isArray(rawAnchors)) {
      return [];
    }

    const anchors = [];
    for (const rawAnchor of rawAnchors) {
      const anchor = normalizeWorldPoint(rawAnchor);
      if (!isFiniteNumber(anchor.x) || !isFiniteNumber(anchor.y)) {
        continue;
      }
      anchors.push(anchor);
    }
    return anchors;
  }

  function nearestAnchorDistanceTiles(worldX, worldY, anchors) {
    if (!Array.isArray(anchors) || anchors.length === 0) {
      return Number.POSITIVE_INFINITY;
    }
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const anchor of anchors) {
      const dx = worldX - anchor.x;
      const dy = worldY - anchor.y;
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) {
        bestDistance = distance;
      }
    }
    return bestDistance;
  }

  function removeZombieAtIndex(index) {
    if (!Number.isFinite(index) || index < 0 || index >= zombies.length) {
      return false;
    }
    const zombie = zombies[index];
    if (!zombie) {
      return false;
    }
    const zombieId = zombie.getId();
    zombie.destroy();
    zombies.splice(index, 1);
    waypointSelectionDebugById.delete(zombieId);
    wanderStateById.delete(zombieId);
    pursuitStateById.delete(zombieId);
    attackStateById.delete(zombieId);
    return true;
  }

  function sampleWorldPointInRing(anchorWorld, minRadiusTiles, maxRadiusTiles) {
    const anchor = normalizeWorldPoint(anchorWorld);
    const minRadius = Math.max(0, Number(minRadiusTiles) || 0);
    const maxRadius = Math.max(minRadius, Number(maxRadiusTiles) || minRadius);
    const angle = Math.random() * Math.PI * 2;
    const radiusSquared =
      minRadius * minRadius +
      Math.random() * (maxRadius * maxRadius - minRadius * minRadius);
    const radius = Math.sqrt(radiusSquared);
    return {
      x: anchor.x + Math.cos(angle) * radius,
      y: anchor.y + Math.sin(angle) * radius,
    };
  }

  function spawnInFirstContactRing(anchorWorld) {
    const anchor = normalizeWorldPoint(anchorWorld);
    for (let attempt = 0; attempt < firstContactRingSampleAttempts; attempt += 1) {
      const sampleWorld = sampleWorldPointInRing(
        anchor,
        firstContactSpawnMinRadiusTiles,
        firstContactSpawnMaxRadiusTiles
      );
      if (!isWalkableWorldPoint(runtime, sampleWorld.x, sampleWorld.y)) {
        continue;
      }
      const spawnResult = spawnAtWorld(sampleWorld.x, sampleWorld.y, {
        allowFallback: false,
        source: "first_contact_ring",
      });
      if (spawnResult?.accepted) {
        return spawnResult;
      }
    }
    return {
      accepted: false,
      reason: "no_valid_ring_spawn",
    };
  }

  function runFirstContactPopulationStep(dtSeconds) {
    if (!firstContactEnabled) {
      return false;
    }

    const anchors = getFirstContactPerimeterAnchors();
    if (anchors.length === 0) {
      lastFirstContactCycle = {
        enabled: true,
        anchorCount: 0,
        activeZombieCount: zombies.length,
        targetZombieCount: firstContactTargetZombieCount,
        recycledCount: 0,
        spawnAttempts: 0,
        spawnedCount: 0,
        skippedSpawnCount: 0,
        reason: "no_perimeter_anchor",
      };
      return false;
    }

    const dt = Math.max(0, Number(dtSeconds) || 0);
    firstContactPerimeterCheckCooldown = Math.max(
      0,
      firstContactPerimeterCheckCooldown - dt
    );

    let recycledCount = 0;
    const shouldRecycle = firstContactPerimeterCheckCooldown <= 0;
    if (shouldRecycle) {
      firstContactPerimeterCheckCooldown = firstContactPerimeterCheckIntervalSeconds;
      for (
        let index = zombies.length - 1;
        index >= 0 && recycledCount < firstContactMaxRecyclesPerUpdate;
        index -= 1
      ) {
        const zombie = zombies[index];
        const world = zombie.getWorldPosition();
        const distanceToPerimeterAnchor = nearestAnchorDistanceTiles(
          world.x,
          world.y,
          anchors
        );
        if (distanceToPerimeterAnchor <= firstContactSpawnMaxRadiusTiles) {
          continue;
        }
        if (removeZombieAtIndex(index)) {
          recycledCount += 1;
        }
      }
    }

    let spawnedCount = 0;
    let skippedSpawnCount = 0;
    let spawnAttempts = 0;
    const primaryAnchor = anchors[0];
    const deficit = Math.max(0, firstContactTargetZombieCount - zombies.length);
    const cappedAttempts = Math.min(deficit, firstContactMaxSpawnsPerUpdate);
    for (let attempt = 0; attempt < cappedAttempts; attempt += 1) {
      spawnAttempts += 1;
      const spawnResult = spawnInFirstContactRing(primaryAnchor);
      if (spawnResult?.accepted) {
        spawnedCount += 1;
      } else {
        skippedSpawnCount += 1;
      }
    }

    lastFirstContactCycle = {
      enabled: true,
      anchorCount: anchors.length,
      activeZombieCount: zombies.length,
      targetZombieCount: firstContactTargetZombieCount,
      recycledCount,
      spawnAttempts,
      spawnedCount,
      skippedSpawnCount,
      minSpawnRadiusTiles: firstContactSpawnMinRadiusTiles,
      maxSpawnRadiusTiles: firstContactSpawnMaxRadiusTiles,
      reason: "ok",
    };

    return recycledCount > 0 || spawnedCount > 0;
  }

  function spawnAtWorld(worldX, worldY, options = {}) {
    if (!isFiniteNumber(worldX) || !isFiniteNumber(worldY)) {
      lastSpawnAttempt = {
        accepted: false,
        reason: "invalid_input",
        source: options?.source || "manual",
        inputWorld: {
          x: Number(worldX),
          y: Number(worldY),
        },
      };
      return {
        accepted: false,
        reason: "invalid_input",
      };
    }

    let spawnWorldX = worldX;
    let spawnWorldY = worldY;
    let usedFallback = false;
    const allowFallback = options?.allowFallback !== false;

    if (!isWalkableWorldPoint(runtime, spawnWorldX, spawnWorldY)) {
      if (!allowFallback) {
        lastSpawnAttempt = {
          accepted: false,
          reason: "blocked_spawn",
          source: options?.source || "manual",
          inputWorld: {
            x: worldX,
            y: worldY,
          },
        };
        return {
          accepted: false,
          reason: "blocked_spawn",
        };
      }
      const startTile = normalizeTilePoint(runtime.worldToTile(spawnWorldX, spawnWorldY));
      const nearestTile = findNearestWalkableTile(
        runtime,
        startTile,
        spawnSearchRadiusTiles
      );
      if (!nearestTile) {
        lastSpawnAttempt = {
          accepted: false,
          reason: "no_walkable_spawn",
          source: options?.source || "manual",
          inputWorld: {
            x: worldX,
            y: worldY,
          },
        };
        return {
          accepted: false,
          reason: "no_walkable_spawn",
        };
      }
      const nearestCenter = runtime.tileToWorldCenter(nearestTile.x, nearestTile.y);
      spawnWorldX = nearestCenter.x;
      spawnWorldY = nearestCenter.y;
      usedFallback = true;
    }

    const zombie = createZombieController({
      id: nextZombieId,
      scene,
      runtime,
      initialWorld: {
        x: spawnWorldX,
        y: spawnWorldY,
      },
      moveSpeedTilesPerSecond:
        configuredZombieMoveSpeedTilesPerSecond ?? undefined,
    });
    nextZombieId += 1;
    zombies.push(zombie);
    wanderStateById.set(zombie.getId(), createInitialWanderState(zombie.getId()));
    pursuitStateById.set(zombie.getId(), createInitialPursuitState());
    attackStateById.set(zombie.getId(), createInitialAttackState());
    waypointSelectionDebugById.set(zombie.getId(), {
      reason: "spawned",
      attempts: 0,
      candidates: [],
    });
    const resolvedSpawn = zombie.getWorldPosition();
    lastSpawnAttempt = {
      accepted: true,
      reason: usedFallback ? "fallback_spawn" : "direct_spawn",
      source: options?.source || "manual",
      inputWorld: {
        x: worldX,
        y: worldY,
      },
      spawnWorld: {
        x: resolvedSpawn.x,
        y: resolvedSpawn.y,
      },
      zombieId: zombie.getId(),
    };

    return {
      accepted: true,
      zombieId: zombie.getId(),
      usedFallback,
      spawnWorld: {
        x: resolvedSpawn.x,
        y: resolvedSpawn.y,
      },
    };
  }

  function applySoftSeparation() {
    let changed = false;
    for (let i = 0; i < zombies.length; i += 1) {
      for (let j = i + 1; j < zombies.length; j += 1) {
        const zombieA = zombies[i];
        const zombieB = zombies[j];
        const a = zombieA.getWorldPosition();
        const b = zombieB.getWorldPosition();
        let deltaX = b.x - a.x;
        let deltaY = b.y - a.y;
        let distance = Math.hypot(deltaX, deltaY);

        if (distance >= SOFT_SEPARATION_MIN_DISTANCE_TILES) {
          continue;
        }

        if (distance <= SOFT_SEPARATION_EPSILON) {
          const angle = ((zombieA.getId() * 1103515245 + zombieB.getId() * 12345) % 360) * (Math.PI / 180);
          deltaX = Math.cos(angle);
          deltaY = Math.sin(angle);
          distance = 1;
        }

        const overlap = SOFT_SEPARATION_MIN_DISTANCE_TILES - distance;
        const pushDistance = overlap * 0.5 * SOFT_SEPARATION_STRENGTH;
        const normalX = deltaX / distance;
        const normalY = deltaY / distance;
        const pushX = normalX * pushDistance;
        const pushY = normalY * pushDistance;

        if (zombieA.nudge(-pushX, -pushY)) {
          changed = true;
        }
        if (zombieB.nudge(pushX, pushY)) {
          changed = true;
        }
      }
    }
    return changed;
  }

  function update(dtSeconds) {
    function registerWaypointFailure(zombie, state, debugPayload) {
      state.noCandidateStreak += 1;
      registerFailedSector(state, zombie.getHeadingRadians());
      if (state.noCandidateStreak >= noCandidateStreakThreshold) {
        state.noCandidateStreak = 0;
        activateRecovery(state);
      }
      activateRepickCooldown(state);
      waypointSelectionDebugById.set(zombie.getId(), {
        ...debugPayload,
        cooldownRemainingSeconds: state.repickCooldownRemainingSeconds,
        recoveryActive: state.recoveryRemainingSeconds > 0,
      });
    }

    function recordRepickCooldownDebug(zombie, state) {
      waypointSelectionDebugById.set(zombie.getId(), {
        reason: "repick_cooldown",
        attempts: 0,
        candidates: [],
        cooldownRemainingSeconds: state.repickCooldownRemainingSeconds,
        recoveryActive: state.recoveryRemainingSeconds > 0,
      });
    }

    function buildControllerRejectedDebug(selection) {
      return {
        reason: "rejected_by_controller",
        attempts: selection?.debug?.attempts || 0,
        continuationAttempts: selection?.debug?.continuationAttempts || 0,
        rayCount: selection?.debug?.rayCount || 0,
        minWaypointDistance: selection?.debug?.minWaypointDistance || 0,
        raySamples: Array.isArray(selection?.debug?.raySamples)
          ? selection.debug.raySamples
          : [],
        candidates: Array.isArray(selection?.debug?.candidates)
          ? selection.debug.candidates
          : [],
      };
    }

    let changed = false;
    if (runFirstContactPopulationStep(dtSeconds)) {
      changed = true;
    }
    for (const zombie of zombies) {
      const state = getWanderState(zombie.getId());
      decayWanderState(state, dtSeconds);
      if (applyRecoveryHeading(zombie, state, dtSeconds)) {
        changed = true;
      }
    }
    if (runPursuitStep()) {
      changed = true;
    }
    for (const zombie of zombies) {
      if (!zombie.hasWaypoint() && shouldUseWanderForZombie(zombie.getId())) {
        const state = getWanderState(zombie.getId());
        if (state.repickCooldownRemainingSeconds > 0) {
          recordRepickCooldownDebug(zombie, state);
          continue;
        }
        const selection = wanderPlanner.pickWaypointForZombie(zombie, {
          includeDebug: true,
          blockedSectorsRadians: state.failedSectors,
        });
        const debugSelection = selection?.debug || null;
        const waypoint = selection?.waypoint || null;
        if (waypoint) {
          const accepted = zombie.setWaypointWorld(waypoint);
          if (accepted) {
            state.noCandidateStreak = 0;
            state.recoveryRemainingSeconds = 0;
            state.repickCooldownRemainingSeconds = 0;
            changed = true;
            waypointSelectionDebugById.set(zombie.getId(), {
              ...debugSelection,
              cooldownRemainingSeconds: 0,
              recoveryActive: false,
            });
          } else {
            registerWaypointFailure(
              zombie,
              state,
              buildControllerRejectedDebug(selection)
            );
          }
        } else {
          registerWaypointFailure(zombie, state, {
            ...debugSelection,
          });
        }
      }
    }
    for (const zombie of zombies) {
      if (zombie.update(dtSeconds)) {
        changed = true;
      }
    }
    if (applySoftSeparation()) {
      changed = true;
    }
    if (runAttackStep(dtSeconds)) {
      changed = true;
    }
    for (const zombie of zombies) {
      if (!zombie.hasWaypoint() && shouldUseWanderForZombie(zombie.getId())) {
        const state = getWanderState(zombie.getId());
        if (state.repickCooldownRemainingSeconds > 0) {
          recordRepickCooldownDebug(zombie, state);
          continue;
        }
        const selection = wanderPlanner.pickWaypointForZombie(zombie, {
          includeDebug: true,
          blockedSectorsRadians: state.failedSectors,
        });
        const debugSelection = selection?.debug || null;
        const waypoint = selection?.waypoint || null;
        if (waypoint) {
          const accepted = zombie.setWaypointWorld(waypoint);
          if (accepted) {
            state.noCandidateStreak = 0;
            state.recoveryRemainingSeconds = 0;
            state.repickCooldownRemainingSeconds = 0;
            changed = true;
            waypointSelectionDebugById.set(zombie.getId(), {
              ...debugSelection,
              cooldownRemainingSeconds: 0,
              recoveryActive: false,
            });
          } else {
            registerWaypointFailure(
              zombie,
              state,
              buildControllerRejectedDebug(selection)
            );
          }
        } else {
          registerWaypointFailure(zombie, state, {
            ...debugSelection,
          });
        }
      }
    }
    return changed;
  }

  function syncToView({
    cameraTile,
    tilePixels,
    viewWidthPx,
    viewHeightPx,
  }) {
    for (const zombie of zombies) {
      zombie.syncToView({
        cameraTile,
        tilePixels,
        viewWidthPx,
        viewHeightPx,
      });
    }
  }

  function getZombieCount() {
    return zombies.length;
  }

  function findZombieById(zombieId) {
    if (!Number.isFinite(zombieId)) {
      return null;
    }
    for (const zombie of zombies) {
      if (zombie.getId() === zombieId) {
        return zombie;
      }
    }
    return null;
  }

  function setZombieWaypoint(zombieId, waypointWorld) {
    const zombie = findZombieById(zombieId);
    if (!zombie) {
      return false;
    }
    const accepted = zombie.setWaypointWorld(waypointWorld);
    const state = getWanderState(zombieId);
    state.noCandidateStreak = 0;
    state.recoveryRemainingSeconds = 0;
    state.repickCooldownRemainingSeconds = 0;
    waypointSelectionDebugById.set(zombieId, {
      reason: accepted ? "manual_override" : "manual_override_rejected",
      attempts: 0,
      candidates: [],
    });
    return accepted;
  }

  function clearZombieWaypoint(zombieId) {
    const zombie = findZombieById(zombieId);
    if (!zombie) {
      return false;
    }
    zombie.clearWaypoint();
    const state = getWanderState(zombieId);
    state.noCandidateStreak = 0;
    state.repickCooldownRemainingSeconds = 0;
    waypointSelectionDebugById.set(zombieId, {
      reason: "manual_clear",
      attempts: 0,
      candidates: [],
    });
    return true;
  }

  function getDebugState() {
    const zombieStates = zombies.map((zombie) => {
      const debugState = zombie.getDebugState();
      const waypointSelection = waypointSelectionDebugById.get(zombie.getId()) || null;
      const wanderState = getWanderState(zombie.getId());
      const pursuitState = getPursuitState(zombie.getId());
      const attackState = getAttackState(zombie.getId());
      return {
        ...debugState,
        waypointSelection,
        pursuit: {
          mode: pursuitState.mode,
          targetId: pursuitState.targetId,
          hasLineOfSight: pursuitState.hasLineOfSight,
          distanceToTarget: pursuitState.distanceToTarget,
          lastKnownWorld: pursuitState.lastKnownWorld
            ? { ...pursuitState.lastKnownWorld }
            : null,
        },
        attack: {
          cooldownRemainingSeconds: attackState.cooldownRemainingSeconds,
          cooldownDurationSeconds: zombieAttackResolver.attackCooldownSeconds,
          ready: !zombieAttackResolver.isOnCooldown(attackState),
          lastAttackTargetId: attackState.lastAttackTargetId,
          lastAttackDamage: attackState.lastAttackDamage,
          lastAttackApplied: attackState.lastAttackApplied === true,
        },
        wanderRecovery: {
          noCandidateStreak: wanderState.noCandidateStreak,
          recoveryRemainingSeconds: wanderState.recoveryRemainingSeconds,
          recoveryActive: wanderState.recoveryRemainingSeconds > 0,
          recoveryDirection: wanderState.recoveryDirection,
          repickCooldownRemainingSeconds: wanderState.repickCooldownRemainingSeconds,
          failedSectors: wanderState.failedSectors.map((sector) => ({
            centerRadians: sector.centerRadians,
            halfAngleRadians: sector.halfAngleRadians,
            ttlSeconds: sector.ttlSeconds,
          })),
        },
      };
    });

    let aliveZombieCount = 0;
    let deadZombieCount = 0;
    let totalCurrentHp = 0;
    let minCurrentHp = Number.POSITIVE_INFINITY;
    let maxCurrentHp = 0;
    let readyToAttackCount = 0;
    let attackOnCooldownCount = 0;
    let lastAttackAppliedCount = 0;
    let zombiesWithTargetLock = 0;
    let zombiesWithLineOfSight = 0;
    const modeCounts = {
      wander: 0,
      pursuit: 0,
      investigate: 0,
      attack: 0,
      unknown: 0,
    };

    for (const zombie of zombieStates) {
      const health = zombie?.health || null;
      const currentHp = Number(health?.currentHp) || 0;
      const isDead = health?.isDead === true;
      if (isDead) {
        deadZombieCount += 1;
      } else {
        aliveZombieCount += 1;
      }

      totalCurrentHp += currentHp;
      if (currentHp < minCurrentHp) {
        minCurrentHp = currentHp;
      }
      if (currentHp > maxCurrentHp) {
        maxCurrentHp = currentHp;
      }

      const pursuit = zombie?.pursuit || null;
      if (pursuit?.targetId !== null && pursuit?.targetId !== undefined) {
        zombiesWithTargetLock += 1;
      }
      if (pursuit?.hasLineOfSight === true) {
        zombiesWithLineOfSight += 1;
      }
      const mode = pursuit?.mode;
      if (mode === "wander") {
        modeCounts.wander += 1;
      } else if (mode === "pursuit") {
        modeCounts.pursuit += 1;
      } else if (mode === "investigate") {
        modeCounts.investigate += 1;
      } else if (mode === "attack") {
        modeCounts.attack += 1;
      } else {
        modeCounts.unknown += 1;
      }

      const attack = zombie?.attack || null;
      if (attack?.ready === true) {
        readyToAttackCount += 1;
      } else {
        attackOnCooldownCount += 1;
      }
      if (attack?.lastAttackApplied === true) {
        lastAttackAppliedCount += 1;
      }
    }

    const zombieCount = zombieStates.length;
    const averageCurrentHp =
      zombieCount > 0 ? totalCurrentHp / zombieCount : 0;

    return {
      attackPolicy: {
        enabled: attackEnabled,
        damagePerHit: zombieAttackResolver.attackDamage,
        cooldownSeconds: zombieAttackResolver.attackCooldownSeconds,
      },
      movementPolicy: {
        configuredMoveSpeedTilesPerSecond: configuredZombieMoveSpeedTilesPerSecond,
      },
      pursuitPolicy: {
        enabled: pursuitEnabled,
        lineCheckStepTiles: pursuitLineCheckStepTiles,
      },
      firstContactPopulation: {
        enabled: firstContactEnabled,
        minSpawnRadiusTiles: firstContactSpawnMinRadiusTiles,
        maxSpawnRadiusTiles: firstContactSpawnMaxRadiusTiles,
        targetZombieCount: firstContactTargetZombieCount,
        activeZombieCount: zombies.length,
        ringSampleAttempts: firstContactRingSampleAttempts,
        maxSpawnsPerUpdate: firstContactMaxSpawnsPerUpdate,
        maxRecyclesPerUpdate: firstContactMaxRecyclesPerUpdate,
        perimeterCheckIntervalSeconds: firstContactPerimeterCheckIntervalSeconds,
        perimeterCheckCooldownRemaining: firstContactPerimeterCheckCooldown,
        lastCycle: lastFirstContactCycle ? { ...lastFirstContactCycle } : null,
      },
      healthSummary: {
        zombieCount,
        aliveZombieCount,
        deadZombieCount,
        averageCurrentHp,
        minCurrentHp: zombieCount > 0 ? minCurrentHp : 0,
        maxCurrentHp: zombieCount > 0 ? maxCurrentHp : 0,
      },
      pursuitDiagnostics: {
        modeCounts: { ...modeCounts },
        zombiesWithTargetLock,
        zombiesWithLineOfSight,
        lastCycle: lastPursuitCycle
          ? {
              ...lastPursuitCycle,
              modeCounts: lastPursuitCycle.modeCounts
                ? { ...lastPursuitCycle.modeCounts }
                : null,
            }
          : null,
      },
      attackDiagnostics: {
        readyToAttackCount,
        attackOnCooldownCount,
        lastAttackAppliedCount,
        lastCycle: lastAttackCycle ? { ...lastAttackCycle } : null,
      },
      lastSpawnAttempt: lastSpawnAttempt
        ? {
            ...lastSpawnAttempt,
            inputWorld: lastSpawnAttempt.inputWorld
              ? { ...lastSpawnAttempt.inputWorld }
              : null,
            spawnWorld: lastSpawnAttempt.spawnWorld
              ? { ...lastSpawnAttempt.spawnWorld }
              : null,
          }
        : null,
      zombies: zombieStates,
    };
  }

  function destroy() {
    for (const zombie of zombies) {
      zombie.destroy();
    }
    zombies.length = 0;
    waypointSelectionDebugById.clear();
    wanderStateById.clear();
    pursuitStateById.clear();
    attackStateById.clear();
  }

  return {
    spawnAtWorld,
    update,
    syncToView,
    getZombieCount,
    setZombieWaypoint,
    clearZombieWaypoint,
    getDebugState,
    destroy,
  };
}

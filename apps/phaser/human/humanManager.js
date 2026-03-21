import { createHumanController } from "./humanController.js";
import { createHumanPerception } from "./humanPerception.js";
import { createZombieWanderPlanner } from "../zombie/zombieWanderPlanner.js";

const PRIMARY_SURVIVOR_ID = "survivor_primary";
const ROLE_SURVIVOR = "survivor";
const ROLE_GUEST = "guest";
const HUMAN_COLLIDER_RADIUS_TILES = 0.29;
const DEFAULT_NATURAL_GUEST_TARGET_COUNT = 10;
const DEFAULT_NATURAL_GUEST_MIN_SPAWN_RADIUS_TILES = 10;
const DEFAULT_NATURAL_GUEST_MAX_SPAWN_RADIUS_TILES = 100;
const DEFAULT_NATURAL_GUEST_RING_SAMPLE_ATTEMPTS = 10;
const DEFAULT_NATURAL_GUEST_MAX_SPAWNS_PER_UPDATE = 4;
const DEFAULT_NATURAL_GUEST_MAX_RECYCLES_PER_UPDATE = 4;
const DEFAULT_NATURAL_GUEST_PERIMETER_CHECK_INTERVAL_SECONDS = 0.25;
const DEFAULT_GUEST_PERCEPTION_LINE_CHECK_STEP_TILES = 0.2;
const DEFAULT_GUEST_FLEE_REPLAN_SECONDS = 0.35;
const DEFAULT_GUEST_WANDER_NO_CANDIDATE_STREAK_THRESHOLD = 6;
const DEFAULT_GUEST_WANDER_RECOVERY_DURATION_SECONDS = 0.6;
const DEFAULT_GUEST_WANDER_RECOVERY_ROTATE_RADIANS_PER_SECOND = 4.8;
const DEFAULT_GUEST_WANDER_FAILED_SECTOR_MEMORY_TTL_SECONDS = 1.5;
const DEFAULT_GUEST_WANDER_FAILED_SECTOR_HALF_ANGLE_DEGREES = 18;
const DEFAULT_GUEST_WANDER_NO_CANDIDATE_REPICK_COOLDOWN_SECONDS = 0.12;
const DEFAULT_GUEST_WANDER_CONE_CLIP_RAY_COUNT = 20;
const SOFT_SEPARATION_MIN_DISTANCE_TILES = HUMAN_COLLIDER_RADIUS_TILES * 2;
const SOFT_SEPARATION_STRENGTH = 0.45;
const SOFT_SEPARATION_EPSILON = 0.000001;

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

function getDeterministicIdHash(id) {
  const numeric = Number(id);
  if (Number.isFinite(numeric)) {
    return Math.floor(Math.abs(numeric));
  }
  const source = String(id ?? "");
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getDeterministicDirectionFromId(id) {
  const hash = getDeterministicIdHash(id);
  return hash % 2 === 0 ? 1 : -1;
}

function isControllerAlive(controller) {
  if (!controller) {
    return false;
  }
  if (typeof controller.isDead !== "function") {
    return true;
  }
  return !controller.isDead();
}

export function createHumanManager({
  scene,
  runtime,
  moveSpeedTilesPerSecond,
  spawnSearchRadiusTiles,
  primarySurvivorSpawnTile = null,
  naturalGuestPolicy = null,
  guestPerceptionPolicy = null,
  guestBehaviorPolicy = null,
} = {}) {
  if (!scene || !runtime) {
    throw new Error("createHumanManager requires scene and runtime.");
  }

  const humansById = new Map();
  let nextGuestId = 1;
  let lastGuestSpawnAttempt = null;
  const naturalGuestEnabled = Boolean(naturalGuestPolicy?.enabled);
  const naturalGuestTargetCount = Math.max(
    0,
    Math.floor(
      Number(naturalGuestPolicy?.targetGuestCount) ||
        DEFAULT_NATURAL_GUEST_TARGET_COUNT
    )
  );
  const naturalGuestSpawnMinRadiusTiles = Math.max(
    0,
    Number(naturalGuestPolicy?.minSpawnRadiusTiles) ||
      DEFAULT_NATURAL_GUEST_MIN_SPAWN_RADIUS_TILES
  );
  const naturalGuestSpawnMaxRadiusTiles = Math.max(
    naturalGuestSpawnMinRadiusTiles,
    Number(naturalGuestPolicy?.maxSpawnRadiusTiles) ||
      DEFAULT_NATURAL_GUEST_MAX_SPAWN_RADIUS_TILES
  );
  const naturalGuestRingSampleAttempts = Math.max(
    1,
    Math.floor(
      Number(naturalGuestPolicy?.ringSampleAttempts) ||
        DEFAULT_NATURAL_GUEST_RING_SAMPLE_ATTEMPTS
    )
  );
  const naturalGuestMaxSpawnsPerUpdate = Math.max(
    1,
    Math.floor(
      Number(naturalGuestPolicy?.maxSpawnsPerUpdate) ||
        DEFAULT_NATURAL_GUEST_MAX_SPAWNS_PER_UPDATE
    )
  );
  const naturalGuestMaxRecyclesPerUpdate = Math.max(
    1,
    Math.floor(
      Number(naturalGuestPolicy?.maxRecyclesPerUpdate) ||
        DEFAULT_NATURAL_GUEST_MAX_RECYCLES_PER_UPDATE
    )
  );
  const naturalGuestPerimeterCheckIntervalSeconds = Math.max(
    0.02,
    Number(naturalGuestPolicy?.perimeterCheckIntervalSeconds) ||
      DEFAULT_NATURAL_GUEST_PERIMETER_CHECK_INTERVAL_SECONDS
  );
  let naturalGuestPerimeterCheckCooldown = 0;
  let lastNaturalGuestCycle = null;
  const guestPerceptionEnabled = Boolean(guestPerceptionPolicy?.enabled);
  const guestPerception = createHumanPerception({
    runtime,
    lineCheckStepTiles:
      Number(guestPerceptionPolicy?.lineCheckStepTiles) ||
      DEFAULT_GUEST_PERCEPTION_LINE_CHECK_STEP_TILES,
  });
  let lastGuestPerceptionCycle = null;
  const guestPerceptionById = new Map();
  const guestWanderPlanner = createZombieWanderPlanner({
    runtime,
    ...(guestBehaviorPolicy?.wanderPlanner || {}),
    coneClipRayCount: Math.max(
      1,
      Math.floor(
        Number(guestBehaviorPolicy?.wanderPlanner?.coneClipRayCount) ||
          DEFAULT_GUEST_WANDER_CONE_CLIP_RAY_COUNT
      )
    ),
  });
  const guestFleeReplanSeconds = Math.max(
    0.05,
    Number(guestBehaviorPolicy?.fleeReplanSeconds) ||
      DEFAULT_GUEST_FLEE_REPLAN_SECONDS
  );
  const guestWanderNoCandidateStreakThreshold = Math.max(
    1,
    Math.floor(
      Number(guestBehaviorPolicy?.wanderNoCandidateStreakThreshold) ||
        DEFAULT_GUEST_WANDER_NO_CANDIDATE_STREAK_THRESHOLD
    )
  );
  const guestWanderRecoveryDurationSeconds = Math.max(
    0,
    Number(guestBehaviorPolicy?.wanderRecoveryDurationSeconds) ||
      DEFAULT_GUEST_WANDER_RECOVERY_DURATION_SECONDS
  );
  const guestWanderRecoveryRotateRadiansPerSecond = Math.max(
    0,
    Number(guestBehaviorPolicy?.wanderRecoveryRotateRadiansPerSecond) ||
      DEFAULT_GUEST_WANDER_RECOVERY_ROTATE_RADIANS_PER_SECOND
  );
  const guestWanderFailedSectorMemoryTtlSeconds = Math.max(
    0,
    Number(guestBehaviorPolicy?.wanderFailedSectorMemoryTtlSeconds) ||
      DEFAULT_GUEST_WANDER_FAILED_SECTOR_MEMORY_TTL_SECONDS
  );
  const guestWanderFailedSectorHalfAngleRadians =
    (Math.max(
      0,
      Number(guestBehaviorPolicy?.wanderFailedSectorHalfAngleDegrees) ||
        DEFAULT_GUEST_WANDER_FAILED_SECTOR_HALF_ANGLE_DEGREES
    ) *
      Math.PI) /
    180;
  const guestWanderNoCandidateRepickCooldownSeconds = Math.max(
    0,
    Number(guestBehaviorPolicy?.wanderNoCandidateRepickCooldownSeconds) ||
      DEFAULT_GUEST_WANDER_NO_CANDIDATE_REPICK_COOLDOWN_SECONDS
  );
  const guestBehaviorById = new Map();
  const guestWaypointSelectionDebugById = new Map();
  const guestWanderStateById = new Map();
  let lastGuestBehaviorCycle = null;
  let totalGuestConversions = 0;
  let lastGuestConversionCycle = null;
  let debugEnabled = false;

  function createInitialGuestWanderState(humanId) {
    return {
      humanId,
      noCandidateStreak: 0,
      recoveryRemainingSeconds: 0,
      recoveryDirection: getDeterministicDirectionFromId(humanId),
      failedSectors: [],
      repickCooldownRemainingSeconds: 0,
    };
  }

  function getGuestWanderState(humanId) {
    let state = guestWanderStateById.get(humanId);
    if (!state) {
      state = createInitialGuestWanderState(humanId);
      guestWanderStateById.set(humanId, state);
    }
    return state;
  }

  function decayGuestWanderState(state, dtSeconds) {
    const dt = Math.max(0, Number(dtSeconds) || 0);
    if (dt <= 0) {
      return;
    }

    if (state.recoveryRemainingSeconds > 0) {
      state.recoveryRemainingSeconds = Math.max(
        0,
        state.recoveryRemainingSeconds - dt
      );
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

  function registerGuestFailedSector(state, headingRadians) {
    state.failedSectors.push({
      centerRadians: normalizeAngleRadians(headingRadians),
      halfAngleRadians: Math.max(0, guestWanderFailedSectorHalfAngleRadians),
      ttlSeconds: guestWanderFailedSectorMemoryTtlSeconds,
    });
  }

  function activateGuestRecovery(state) {
    state.recoveryRemainingSeconds = guestWanderRecoveryDurationSeconds;
    if (state.recoveryRemainingSeconds <= 0) {
      return;
    }
    if (state.recoveryDirection === 0) {
      state.recoveryDirection = getDeterministicDirectionFromId(state.humanId);
    }
  }

  function activateGuestRepickCooldown(state) {
    state.repickCooldownRemainingSeconds =
      guestWanderNoCandidateRepickCooldownSeconds;
  }

  function applyGuestRecoveryHeading(controller, state, dtSeconds) {
    if (state.recoveryRemainingSeconds <= 0) {
      return false;
    }
    const dt = Math.max(0, Number(dtSeconds) || 0);
    if (dt <= 0) {
      return false;
    }
    const rotateDelta =
      guestWanderRecoveryRotateRadiansPerSecond *
      dt *
      (state.recoveryDirection || 1);
    if (Math.abs(rotateDelta) <= 0.000001) {
      return false;
    }
    if (typeof controller?.rotateHeading !== "function") {
      return false;
    }
    return controller.rotateHeading(rotateDelta);
  }

  function getHumanRecord(id) {
    return humansById.get(id) || null;
  }

  function getHumanEntries({ livingOnly = false } = {}) {
    const entries = [];
    for (const record of humansById.values()) {
      if (livingOnly && !isControllerAlive(record.controller)) {
        continue;
      }
      entries.push({
        id: record.id,
        role:
          typeof record.controller.getRole === "function"
            ? record.controller.getRole()
            : record.role,
        controller: record.controller,
      });
    }
    return entries;
  }

  function getHumanControllers({ livingOnly = false } = {}) {
    return getHumanEntries({ livingOnly }).map((entry) => entry.controller);
  }

  function getPrimaryHumanController() {
    const primary = getHumanRecord(PRIMARY_SURVIVOR_ID);
    return primary?.controller || null;
  }

  function getPrimaryLivingHumanController() {
    const primary = getPrimaryHumanController();
    if (!isControllerAlive(primary)) {
      return null;
    }
    return primary;
  }

  function spawnPrimarySurvivor() {
    if (humansById.has(PRIMARY_SURVIVOR_ID)) {
      return getHumanRecord(PRIMARY_SURVIVOR_ID);
    }
    const controller = createHumanController({
      scene,
      runtime,
      role: ROLE_SURVIVOR,
      moveSpeedTilesPerSecond,
      spawnSearchRadiusTiles,
      spawnTile: primarySurvivorSpawnTile,
    });
    const record = {
      id: PRIMARY_SURVIVOR_ID,
      role: ROLE_SURVIVOR,
      controller,
    };
    humansById.set(PRIMARY_SURVIVOR_ID, record);
    return record;
  }

  function getGuestCount({ livingOnly = false } = {}) {
    let count = 0;
    for (const record of humansById.values()) {
      const role =
        typeof record.controller.getRole === "function"
          ? record.controller.getRole()
          : record.role;
      if (role !== ROLE_GUEST) {
        continue;
      }
      if (livingOnly && !isControllerAlive(record.controller)) {
        continue;
      }
      count += 1;
    }
    return count;
  }

  function getSurvivorCount({ livingOnly = false } = {}) {
    let count = 0;
    for (const record of humansById.values()) {
      const role =
        typeof record.controller.getRole === "function"
          ? record.controller.getRole()
          : record.role;
      if (role !== ROLE_SURVIVOR) {
        continue;
      }
      if (livingOnly && !isControllerAlive(record.controller)) {
        continue;
      }
      count += 1;
    }
    return count;
  }

  function rectsOverlap(a, b) {
    if (!a || !b) {
      return false;
    }
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function convertGuestToSurvivor(guestId) {
    const record = humansById.get(guestId);
    if (!record || !record.controller) {
      return false;
    }
    const role =
      typeof record.controller.getRole === "function"
        ? record.controller.getRole()
        : record.role;
    if (role !== ROLE_GUEST) {
      return false;
    }
    if (!isControllerAlive(record.controller)) {
      return false;
    }
    if (typeof record.controller.setRole !== "function") {
      return false;
    }

    const changed = record.controller.setRole(ROLE_SURVIVOR);
    if (!changed) {
      return false;
    }
    if (typeof record.controller.clearWaypoint === "function") {
      record.controller.clearWaypoint();
    } else if (typeof record.controller.clearPath === "function") {
      record.controller.clearPath();
    }
    if (typeof record.controller.deselect === "function") {
      // Converted survivors are intentionally not auto-selected.
      record.controller.deselect();
    }
    record.role = ROLE_SURVIVOR;

    guestPerceptionById.delete(guestId);
    guestBehaviorById.delete(guestId);
    guestWaypointSelectionDebugById.delete(guestId);
    guestWanderStateById.delete(guestId);
    totalGuestConversions += 1;
    return true;
  }

  function runSurvivorTouchConversionStep() {
    const survivors = [];
    const guests = [];
    for (const record of humansById.values()) {
      const role =
        typeof record.controller.getRole === "function"
          ? record.controller.getRole()
          : record.role;
      if (!isControllerAlive(record.controller)) {
        continue;
      }
      if (role === ROLE_SURVIVOR) {
        survivors.push(record);
      } else if (role === ROLE_GUEST) {
        guests.push(record);
      }
    }

    const convertedGuestIds = new Set();
    const events = [];
    let convertedCount = 0;
    for (const guest of guests) {
      if (convertedGuestIds.has(guest.id)) {
        continue;
      }
      const guestBounds =
        typeof guest.controller.getBoundsWorld === "function"
          ? guest.controller.getBoundsWorld()
          : null;
      if (!guestBounds) {
        continue;
      }
      for (const survivor of survivors) {
        if (survivor.id === guest.id) {
          continue;
        }
        const survivorBounds =
          typeof survivor.controller.getBoundsWorld === "function"
            ? survivor.controller.getBoundsWorld()
            : null;
        if (!survivorBounds) {
          continue;
        }
        if (!rectsOverlap(guestBounds, survivorBounds)) {
          continue;
        }
        if (convertGuestToSurvivor(guest.id)) {
          convertedGuestIds.add(guest.id);
          convertedCount += 1;
          events.push({
            survivorId: survivor.id,
            guestId: guest.id,
          });
        }
        break;
      }
    }

    lastGuestConversionCycle = {
      enabled: true,
      survivorCount: survivors.length,
      guestCount: guests.length,
      convertedCount,
      totalConvertedCount: totalGuestConversions,
      events,
    };

    return convertedCount > 0;
  }

  function isWalkableWorldPoint(worldX, worldY) {
    if (typeof runtime.isWalkableWorldPoint === "function") {
      return runtime.isWalkableWorldPoint(
        worldX,
        worldY,
        HUMAN_COLLIDER_RADIUS_TILES
      );
    }
    const tile = runtime.worldToTile(worldX, worldY);
    return runtime.isWalkableTile(tile.x, tile.y);
  }

  function getNaturalGuestPerimeterAnchors() {
    if (!naturalGuestEnabled) {
      return [];
    }
    if (typeof naturalGuestPolicy?.getPerimeterAnchors !== "function") {
      return [];
    }
    const rawAnchors = naturalGuestPolicy.getPerimeterAnchors();
    if (!Array.isArray(rawAnchors) || rawAnchors.length === 0) {
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

  function spawnGuestAtWorld(worldX, worldY, options = {}) {
    if (!isFiniteNumber(worldX) || !isFiniteNumber(worldY)) {
      lastGuestSpawnAttempt = {
        accepted: false,
        reason: "invalid_input",
        source: options?.source || "natural_guest",
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
    if (!isWalkableWorldPoint(worldX, worldY)) {
      lastGuestSpawnAttempt = {
        accepted: false,
        reason: "blocked_spawn",
        source: options?.source || "natural_guest",
        inputWorld: {
          x: Number(worldX),
          y: Number(worldY),
        },
      };
      return {
        accepted: false,
        reason: "blocked_spawn",
      };
    }

    const spawnTile = runtime.worldToTile(worldX, worldY);
    const guestId = `guest_${nextGuestId}`;
    const controller = createHumanController({
      scene,
      runtime,
      role: ROLE_GUEST,
      moveSpeedTilesPerSecond,
      spawnSearchRadiusTiles,
      spawnTile: {
        x: Math.floor(spawnTile.x),
        y: Math.floor(spawnTile.y),
      },
    });
    nextGuestId += 1;

    humansById.set(guestId, {
      id: guestId,
      role: ROLE_GUEST,
      controller,
    });

    const resolvedSpawn = controller.getCurrentWorldPosition();
    lastGuestSpawnAttempt = {
      accepted: true,
      reason: "spawned",
      source: options?.source || "natural_guest",
      inputWorld: {
        x: worldX,
        y: worldY,
      },
      spawnWorld: {
        x: resolvedSpawn.x,
        y: resolvedSpawn.y,
      },
      humanId: guestId,
    };

    return {
      accepted: true,
      humanId: guestId,
      spawnWorld: {
        x: resolvedSpawn.x,
        y: resolvedSpawn.y,
      },
    };
  }

  function spawnGuestInRing(anchorWorld) {
    const anchor = normalizeWorldPoint(anchorWorld);
    for (let attempt = 0; attempt < naturalGuestRingSampleAttempts; attempt += 1) {
      const sampleWorld = sampleWorldPointInRing(
        anchor,
        naturalGuestSpawnMinRadiusTiles,
        naturalGuestSpawnMaxRadiusTiles
      );
      const spawnResult = spawnGuestAtWorld(sampleWorld.x, sampleWorld.y, {
        source: "natural_guest_ring",
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

  function removeHumanById(humanId) {
    const record = humansById.get(humanId);
    if (!record) {
      return false;
    }
    record.controller.destroy();
    humansById.delete(humanId);
    guestPerceptionById.delete(humanId);
    guestBehaviorById.delete(humanId);
    guestWaypointSelectionDebugById.delete(humanId);
    guestWanderStateById.delete(humanId);
    return true;
  }

  function runNaturalGuestPopulationStep(dtSeconds) {
    if (!naturalGuestEnabled) {
      return false;
    }

    const anchors = getNaturalGuestPerimeterAnchors();
    if (anchors.length === 0) {
      lastNaturalGuestCycle = {
        enabled: true,
        anchorCount: 0,
        activeGuestCount: getGuestCount({ livingOnly: true }),
        targetGuestCount: naturalGuestTargetCount,
        recycledCount: 0,
        spawnAttempts: 0,
        spawnedCount: 0,
        skippedSpawnCount: 0,
        reason: "no_perimeter_anchor",
      };
      return false;
    }

    const dt = Math.max(0, Number(dtSeconds) || 0);
    naturalGuestPerimeterCheckCooldown = Math.max(
      0,
      naturalGuestPerimeterCheckCooldown - dt
    );

    let recycledCount = 0;
    const shouldRecycle = naturalGuestPerimeterCheckCooldown <= 0;
    if (shouldRecycle) {
      naturalGuestPerimeterCheckCooldown = naturalGuestPerimeterCheckIntervalSeconds;
      for (const [humanId, record] of humansById.entries()) {
        if (recycledCount >= naturalGuestMaxRecyclesPerUpdate) {
          break;
        }
        const role =
          typeof record.controller.getRole === "function"
            ? record.controller.getRole()
            : record.role;
        if (role !== ROLE_GUEST) {
          continue;
        }
        if (!isControllerAlive(record.controller)) {
          if (removeHumanById(humanId)) {
            recycledCount += 1;
          }
          continue;
        }
        const world = record.controller.getCurrentWorldPosition();
        const distanceToAnchor = nearestAnchorDistanceTiles(world.x, world.y, anchors);
        if (distanceToAnchor <= naturalGuestSpawnMaxRadiusTiles) {
          continue;
        }
        if (removeHumanById(humanId)) {
          recycledCount += 1;
        }
      }
    }

    let spawnedCount = 0;
    let skippedSpawnCount = 0;
    let spawnAttempts = 0;
    const deficit = Math.max(
      0,
      naturalGuestTargetCount - getGuestCount({ livingOnly: true })
    );
    const cappedAttempts = Math.min(deficit, naturalGuestMaxSpawnsPerUpdate);
    for (let attempt = 0; attempt < cappedAttempts; attempt += 1) {
      spawnAttempts += 1;
      const anchor = anchors[Math.floor(Math.random() * anchors.length)];
      const spawnResult = spawnGuestInRing(anchor);
      if (spawnResult?.accepted) {
        spawnedCount += 1;
      } else {
        skippedSpawnCount += 1;
      }
    }

    lastNaturalGuestCycle = {
      enabled: true,
      anchorCount: anchors.length,
      activeGuestCount: getGuestCount({ livingOnly: true }),
      targetGuestCount: naturalGuestTargetCount,
      recycledCount,
      spawnAttempts,
      spawnedCount,
      skippedSpawnCount,
      minSpawnRadiusTiles: naturalGuestSpawnMinRadiusTiles,
      maxSpawnRadiusTiles: naturalGuestSpawnMaxRadiusTiles,
      reason: "ok",
    };

    return recycledCount > 0 || spawnedCount > 0;
  }

  function getGuestPerceptionTargets() {
    if (!guestPerceptionEnabled) {
      return [];
    }
    if (typeof guestPerceptionPolicy?.getTargets !== "function") {
      return [];
    }
    const rawTargets = guestPerceptionPolicy.getTargets();
    if (!Array.isArray(rawTargets) || rawTargets.length === 0) {
      return [];
    }

    const targets = [];
    for (const rawTarget of rawTargets) {
      const id = rawTarget?.id;
      const world = normalizeWorldPoint(rawTarget?.world);
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
      targets.push({
        id,
        world,
        isDead: rawTarget?.isDead || null,
      });
    }
    return targets;
  }

  function setGuestPerceptionState(humanId, nextState) {
    const previous = guestPerceptionById.get(humanId) || null;
    const targetChanged =
      (previous?.targetId ?? null) !== (nextState?.targetId ?? null);
    const detectedChanged =
      Boolean(previous?.detected) !== Boolean(nextState?.detected);
    guestPerceptionById.set(humanId, nextState);
    return targetChanged || detectedChanged;
  }

  function runGuestPerceptionStep() {
    if (!guestPerceptionEnabled) {
      lastGuestPerceptionCycle = {
        enabled: false,
      };
      return false;
    }

    const targets = getGuestPerceptionTargets();
    const guests = getHumanEntries({ livingOnly: true }).filter(
      (entry) => entry.role === ROLE_GUEST
    );
    const activeGuestIds = new Set(guests.map((entry) => entry.id));
    let changed = false;
    let detectedGuestCount = 0;
    let inConeCount = 0;
    let lineOfSightClearCount = 0;

    for (const [humanId] of guestPerceptionById.entries()) {
      if (!activeGuestIds.has(humanId)) {
        guestPerceptionById.delete(humanId);
      }
    }

    for (const guest of guests) {
      const controller = guest.controller;
      if (
        typeof controller?.getCurrentWorldPosition !== "function" ||
        typeof controller?.getHeadingRadians !== "function" ||
        typeof controller?.getVisionCone !== "function"
      ) {
        continue;
      }

      const evaluation = guestPerception.evaluateVision({
        observerWorld: controller.getCurrentWorldPosition(),
        observerHeadingRadians: controller.getHeadingRadians(),
        visionCone: controller.getVisionCone(),
        targets,
      });
      inConeCount += Number(evaluation?.stats?.inConeCount) || 0;
      lineOfSightClearCount += Number(evaluation?.stats?.lineOfSightClearCount) || 0;
      if (evaluation.detected) {
        detectedGuestCount += 1;
      }

      const nearest = evaluation?.nearestVisibleTarget || null;
      const nextState = {
        detected: evaluation.detected === true,
        targetId: nearest?.id ?? null,
        targetWorld: nearest?.world
          ? {
              x: nearest.world.x,
              y: nearest.world.y,
            }
          : null,
        distanceToTarget: Number.isFinite(nearest?.distance)
          ? nearest.distance
          : null,
      };
      if (setGuestPerceptionState(guest.id, nextState)) {
        changed = true;
      }
    }

    const config = guestPerception.getConfig();
    lastGuestPerceptionCycle = {
      enabled: true,
      guestCount: guests.length,
      targetCount: targets.length,
      detectedGuestCount,
      inConeCount,
      lineOfSightClearCount,
      lineCheckStepTiles: config.lineCheckStepTiles,
    };

    return changed;
  }

  function getGuestBehaviorState(humanId) {
    let state = guestBehaviorById.get(humanId);
    if (!state) {
      state = {
        mode: "wander",
        replanCooldownSeconds: 0,
        lastPlanReason: null,
        targetId: null,
      };
      guestBehaviorById.set(humanId, state);
    }
    return state;
  }

  function normalizeWaypointSelection(selection) {
    if (!selection) {
      return {
        waypoint: null,
        debug: null,
      };
    }
    if (
      Number.isFinite(selection?.x) &&
      Number.isFinite(selection?.y) &&
      selection?.waypoint === undefined
    ) {
      return {
        waypoint: selection,
        debug: null,
      };
    }
    return {
      waypoint: selection?.waypoint || null,
      debug: selection?.debug || null,
    };
  }

  function runGuestBehaviorStep(dtSeconds, { recordCycle = true } = {}) {
    function registerGuestWaypointFailure(
      guestId,
      controller,
      state,
      debugPayload
    ) {
      state.noCandidateStreak += 1;
      registerGuestFailedSector(state, controller.getHeadingRadians());
      if (state.noCandidateStreak >= guestWanderNoCandidateStreakThreshold) {
        state.noCandidateStreak = 0;
        activateGuestRecovery(state);
      }
      activateGuestRepickCooldown(state);
      if (!debugEnabled) {
        return;
      }
      guestWaypointSelectionDebugById.set(guestId, {
        ...debugPayload,
        cooldownRemainingSeconds: state.repickCooldownRemainingSeconds,
        recoveryActive: state.recoveryRemainingSeconds > 0,
      });
    }

    function recordGuestRepickCooldownDebug(guestId, state) {
      if (!debugEnabled) {
        return;
      }
      guestWaypointSelectionDebugById.set(guestId, {
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

    const guests = getHumanEntries({ livingOnly: true }).filter(
      (entry) => entry.role === ROLE_GUEST
    );
    const activeGuestIds = new Set(guests.map((entry) => entry.id));
    let changed = false;
    let fleeGuestCount = 0;
    let wanderGuestCount = 0;
    let replansAttempted = 0;
    let replansSucceeded = 0;
    let failedPlanCount = 0;

    for (const [humanId] of guestBehaviorById.entries()) {
      if (!activeGuestIds.has(humanId)) {
        guestBehaviorById.delete(humanId);
      }
    }
    for (const [humanId] of guestWaypointSelectionDebugById.entries()) {
      if (!activeGuestIds.has(humanId)) {
        guestWaypointSelectionDebugById.delete(humanId);
      }
    }
    for (const [humanId] of guestWanderStateById.entries()) {
      if (!activeGuestIds.has(humanId)) {
        guestWanderStateById.delete(humanId);
      }
    }

    const dt = Math.max(0, Number(dtSeconds) || 0);
    for (const guest of guests) {
      const controller = guest.controller;
      if (
        typeof controller?.getCurrentWorldPosition !== "function" ||
        typeof controller?.getHeadingRadians !== "function" ||
        typeof controller?.getVisionCone !== "function" ||
        typeof controller?.setWaypointWorld !== "function" ||
        typeof controller?.hasWaypoint !== "function"
      ) {
        continue;
      }
      const wanderState = getGuestWanderState(guest.id);
      decayGuestWanderState(wanderState, dt);
      if (applyGuestRecoveryHeading(controller, wanderState, dt)) {
        changed = true;
      }

      const perception = guestPerceptionById.get(guest.id) || null;
      const hasThreat =
        perception?.detected === true &&
        Number.isFinite(perception?.targetWorld?.x) &&
        Number.isFinite(perception?.targetWorld?.y);
      const desiredMode = hasThreat ? "flee" : "wander";
      const behavior = getGuestBehaviorState(guest.id);
      behavior.replanCooldownSeconds = Math.max(0, behavior.replanCooldownSeconds - dt);
      const blockedEvent =
        typeof controller.consumePathBlockedEvent === "function"
          ? controller.consumePathBlockedEvent()
          : null;
      const modeChanged = behavior.mode !== desiredMode;
      if (modeChanged) {
        behavior.mode = desiredMode;
        behavior.replanCooldownSeconds = 0;
        if (debugEnabled && desiredMode === "flee") {
          guestWaypointSelectionDebugById.set(guest.id, {
            reason: "flee_mode",
            attempts: 0,
            candidates: [],
          });
        }
      }
      behavior.targetId = perception?.targetId ?? null;

      const hasActivePath = controller.hasWaypoint();
      const shouldReplanForFlee =
        modeChanged ||
        blockedEvent !== null ||
        !hasActivePath ||
        behavior.replanCooldownSeconds <= 0;
      const shouldReplanForWander =
        modeChanged ||
        blockedEvent !== null ||
        !hasActivePath;

      if (desiredMode === "flee") {
        fleeGuestCount += 1;
      } else {
        wanderGuestCount += 1;
      }

      if (
        (desiredMode === "flee" && !shouldReplanForFlee) ||
        (desiredMode === "wander" && !shouldReplanForWander)
      ) {
        continue;
      }

      replansAttempted += 1;
      if (desiredMode === "flee" && hasThreat) {
        const guestWorld = controller.getCurrentWorldPosition();
        const threatWorld = perception.targetWorld;
        const guestHeadingRadians = controller.getHeadingRadians();
        const fleeHeadingRadians = normalizeAngleRadians(
          Math.atan2(
            guestWorld.y - threatWorld.y,
            guestWorld.x - threatWorld.x
          )
        );
        const fleeSelection = guestWanderPlanner.pickWaypointForZombie(
          {
            getWorldPosition: () => ({ ...guestWorld }),
            getHeadingRadians: () => fleeHeadingRadians,
            getVisionCone: () => controller.getVisionCone(),
          },
          {
            includeDebug: debugEnabled,
            blockedSectorsRadians: wanderState.failedSectors,
          }
        );
        const normalizedFleeSelection = normalizeWaypointSelection(fleeSelection);
        const debugSelection = normalizedFleeSelection.debug;
        const fleeWaypoint = normalizedFleeSelection.waypoint;
        if (fleeWaypoint) {
          const accepted = controller.setWaypointWorld(fleeWaypoint);
          if (accepted) {
            wanderState.noCandidateStreak = 0;
            wanderState.recoveryRemainingSeconds = 0;
            wanderState.repickCooldownRemainingSeconds = 0;
            if (debugEnabled) {
              guestWaypointSelectionDebugById.set(guest.id, {
                ...debugSelection,
                cooldownRemainingSeconds: 0,
                recoveryActive: false,
              });
            }
            behavior.replanCooldownSeconds = guestFleeReplanSeconds;
            behavior.lastPlanReason = debugSelection?.reason || "planned";
            replansSucceeded += 1;
            changed = true;
          } else {
            registerGuestWaypointFailure(
              guest.id,
              controller,
              wanderState,
              buildControllerRejectedDebug(fleeSelection)
            );
            behavior.replanCooldownSeconds = Math.min(guestFleeReplanSeconds, 0.18);
            behavior.lastPlanReason = "rejected_by_controller";
            failedPlanCount += 1;
          }
        } else {
          registerGuestWaypointFailure(guest.id, controller, wanderState, {
            ...debugSelection,
          });
          behavior.replanCooldownSeconds = Math.min(guestFleeReplanSeconds, 0.18);
          behavior.lastPlanReason = debugSelection?.reason || "no_candidate_found";
          failedPlanCount += 1;
        }
        continue;
      }

      if (wanderState.repickCooldownRemainingSeconds > 0) {
        recordGuestRepickCooldownDebug(guest.id, wanderState);
        behavior.lastPlanReason = "repick_cooldown";
        continue;
      }

      const selection = guestWanderPlanner.pickWaypointForZombie(controller, {
        includeDebug: debugEnabled,
        blockedSectorsRadians: wanderState.failedSectors,
      });
      const normalizedSelection = normalizeWaypointSelection(selection);
      const debugSelection = normalizedSelection.debug;
      const waypoint = normalizedSelection.waypoint;
      if (waypoint) {
        const accepted = controller.setWaypointWorld(waypoint);
        if (accepted) {
          wanderState.noCandidateStreak = 0;
          wanderState.recoveryRemainingSeconds = 0;
          wanderState.repickCooldownRemainingSeconds = 0;
          if (debugEnabled) {
            guestWaypointSelectionDebugById.set(guest.id, {
              ...debugSelection,
              cooldownRemainingSeconds: 0,
              recoveryActive: false,
            });
          }
          behavior.lastPlanReason = debugSelection?.reason || "planned";
          replansSucceeded += 1;
          changed = true;
        } else {
          registerGuestWaypointFailure(
            guest.id,
            controller,
            wanderState,
            buildControllerRejectedDebug(selection)
          );
          behavior.lastPlanReason = "rejected_by_controller";
          failedPlanCount += 1;
        }
      } else {
        registerGuestWaypointFailure(guest.id, controller, wanderState, {
          ...debugSelection,
        });
        behavior.lastPlanReason = debugSelection?.reason || "no_candidate_found";
        failedPlanCount += 1;
      }
    }

    if (recordCycle) {
      lastGuestBehaviorCycle = {
        enabled: true,
        guestCount: guests.length,
        fleeGuestCount,
        wanderGuestCount,
        replansAttempted,
        replansSucceeded,
        failedPlanCount,
        fleeReplanSeconds: guestFleeReplanSeconds,
        noCandidateStreakThreshold: guestWanderNoCandidateStreakThreshold,
        recoveryDurationSeconds: guestWanderRecoveryDurationSeconds,
        repickCooldownSeconds: guestWanderNoCandidateRepickCooldownSeconds,
      };
    }

    return changed;
  }

  function applySurvivorSoftSeparation() {
    const survivors = [];
    for (const record of humansById.values()) {
      const role =
        typeof record.controller.getRole === "function"
          ? record.controller.getRole()
          : record.role;
      if (role !== ROLE_SURVIVOR) {
        continue;
      }
      if (!isControllerAlive(record.controller)) {
        continue;
      }
      if (
        typeof record.controller.getWorldPosition !== "function" ||
        typeof record.controller.nudge !== "function"
      ) {
        continue;
      }
      survivors.push(record);
    }

    let changed = false;
    for (let i = 0; i < survivors.length; i += 1) {
      for (let j = i + 1; j < survivors.length; j += 1) {
        const survivorA = survivors[i];
        const survivorB = survivors[j];
        const controllerA = survivorA.controller;
        const controllerB = survivorB.controller;
        const a = controllerA.getWorldPosition();
        const b = controllerB.getWorldPosition();

        let deltaX = b.x - a.x;
        let deltaY = b.y - a.y;
        let distance = Math.hypot(deltaX, deltaY);
        if (distance >= SOFT_SEPARATION_MIN_DISTANCE_TILES) {
          continue;
        }

        if (distance <= SOFT_SEPARATION_EPSILON) {
          const combinedHash =
            (getDeterministicIdHash(survivorA.id) * 1103515245 +
              getDeterministicIdHash(survivorB.id) * 12345) >>>
            0;
          const angle = (combinedHash % 360) * (Math.PI / 180);
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

        if (controllerA.nudge(-pushX, -pushY)) {
          changed = true;
        }
        if (controllerB.nudge(pushX, pushY)) {
          changed = true;
        }
      }
    }

    return changed;
  }

  function update(dtSeconds) {
    let changed = false;
    if (runNaturalGuestPopulationStep(dtSeconds)) {
      changed = true;
    }
    if (runGuestPerceptionStep()) {
      changed = true;
    }
    if (runGuestBehaviorStep(dtSeconds, { recordCycle: true })) {
      changed = true;
    }
    for (const record of humansById.values()) {
      if (record.controller.update(dtSeconds)) {
        changed = true;
      }
    }
    if (runSurvivorTouchConversionStep()) {
      changed = true;
    }
    if (applySurvivorSoftSeparation()) {
      changed = true;
    }
    return changed;
  }

  function syncToView(viewState) {
    for (const record of humansById.values()) {
      record.controller.syncToView(viewState);
    }
  }

  function getLivingHumanCount() {
    let count = 0;
    for (const record of humansById.values()) {
      if (isControllerAlive(record.controller)) {
        count += 1;
      }
    }
    return count;
  }

  function getDebugState() {
    const humans = [];
    for (const record of humansById.values()) {
      const role =
        typeof record.controller.getRole === "function"
          ? record.controller.getRole()
          : record.role;
      const alive = isControllerAlive(record.controller);
      const controllerDebug =
        typeof record.controller.getDebugState === "function"
          ? record.controller.getDebugState()
          : null;
      const guestWanderState =
        role === ROLE_GUEST
          ? guestWanderStateById.get(record.id) ||
            createInitialGuestWanderState(record.id)
          : null;
      const mergedDebug =
        role === ROLE_GUEST
          ? {
              ...(controllerDebug || {}),
              waypointSelection:
                guestWaypointSelectionDebugById.get(record.id) || null,
              wanderRecovery: {
                noCandidateStreak: guestWanderState.noCandidateStreak,
                recoveryRemainingSeconds:
                  guestWanderState.recoveryRemainingSeconds,
                recoveryActive: guestWanderState.recoveryRemainingSeconds > 0,
                recoveryDirection: guestWanderState.recoveryDirection,
                repickCooldownRemainingSeconds:
                  guestWanderState.repickCooldownRemainingSeconds,
                failedSectors: guestWanderState.failedSectors.map((sector) => ({
                  centerRadians: sector.centerRadians,
                  halfAngleRadians: sector.halfAngleRadians,
                  ttlSeconds: sector.ttlSeconds,
                })),
              },
            }
          : controllerDebug;
      humans.push({
        id: record.id,
        role,
        alive,
        debug: mergedDebug,
      });
    }
    return {
      humanCount: humansById.size,
      livingHumanCount: getLivingHumanCount(),
      survivorCount: getSurvivorCount({ livingOnly: true }),
      totalSurvivorCount: getSurvivorCount(),
      guestCount: getGuestCount({ livingOnly: true }),
      totalGuestCount: getGuestCount(),
      naturalGuestPopulation: {
        enabled: naturalGuestEnabled,
        targetGuestCount: naturalGuestTargetCount,
        minSpawnRadiusTiles: naturalGuestSpawnMinRadiusTiles,
        maxSpawnRadiusTiles: naturalGuestSpawnMaxRadiusTiles,
        lastCycle: lastNaturalGuestCycle ? { ...lastNaturalGuestCycle } : null,
      },
      guestPerception: {
        enabled: guestPerceptionEnabled,
        lastCycle: lastGuestPerceptionCycle ? { ...lastGuestPerceptionCycle } : null,
        byGuest: Array.from(guestPerceptionById.entries()).map(([id, state]) => ({
          id,
          detected: state.detected === true,
          targetId: state.targetId ?? null,
          targetWorld: state.targetWorld
            ? {
                x: state.targetWorld.x,
                y: state.targetWorld.y,
              }
            : null,
          distanceToTarget: Number.isFinite(state.distanceToTarget)
            ? state.distanceToTarget
            : null,
        })),
      },
      guestBehavior: {
        enabled: true,
        lastCycle: lastGuestBehaviorCycle ? { ...lastGuestBehaviorCycle } : null,
        byGuest: Array.from(guestBehaviorById.entries()).map(([id, state]) => ({
          id,
          mode: state.mode || "wander",
          replanCooldownSeconds: Number.isFinite(state.replanCooldownSeconds)
            ? state.replanCooldownSeconds
            : 0,
          lastPlanReason: state.lastPlanReason || null,
          targetId: state.targetId ?? null,
        })),
      },
      guestConversion: {
        enabled: true,
        totalConvertedCount: totalGuestConversions,
        lastCycle: lastGuestConversionCycle
          ? {
              ...lastGuestConversionCycle,
              events: Array.isArray(lastGuestConversionCycle.events)
                ? lastGuestConversionCycle.events.map((event) => ({ ...event }))
                : [],
            }
          : null,
      },
      lastGuestSpawnAttempt: lastGuestSpawnAttempt
        ? {
            ...lastGuestSpawnAttempt,
            inputWorld: lastGuestSpawnAttempt.inputWorld
              ? { ...lastGuestSpawnAttempt.inputWorld }
              : null,
            spawnWorld: lastGuestSpawnAttempt.spawnWorld
              ? { ...lastGuestSpawnAttempt.spawnWorld }
              : null,
          }
        : null,
      humans,
    };
  }

  function setDebugEnabled(enabled) {
    debugEnabled = Boolean(enabled);
    if (!debugEnabled) {
      guestWaypointSelectionDebugById.clear();
    }
  }

  function isDebugEnabled() {
    return debugEnabled;
  }

  function destroy() {
    for (const record of humansById.values()) {
      record.controller.destroy();
    }
    humansById.clear();
    guestPerceptionById.clear();
    guestBehaviorById.clear();
    guestWaypointSelectionDebugById.clear();
    guestWanderStateById.clear();
  }

  spawnPrimarySurvivor();

  return {
    getHumanEntries,
    getHumanControllers,
    getPrimaryHumanController,
    getPrimaryLivingHumanController,
    getLivingHumanCount,
    setDebugEnabled,
    isDebugEnabled,
    getDebugState,
    update,
    syncToView,
    destroy,
  };
}

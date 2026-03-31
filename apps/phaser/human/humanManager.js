import { createHumanController } from "./humanController.js";
import {
  createGuestMentalRuntimeState,
  evaluateGuestMentalModel,
  validateGuestMentalModelConfig,
} from "./guestMentalModel.js";
import { createGuestMentalModelInputAdapter } from "./guestMentalModelInputs.js";
import {
  computeGuestDangerSignal,
  createGuestDangerMemoryState,
  getGuestDangerMemoryDebugSnapshot,
  updateGuestDangerMemoryFromPerception,
} from "./guestDangerMemory.js";
import { createHumanPerception } from "./humanPerception.js";
import { createZombieWanderPlanner } from "../zombie/zombieWanderPlanner.js";
import {
  buildOccupiedSubTileKeysFromWorldPoints,
  rasterizeSubTileLine,
  subTileCellToWorldCenter,
  subTileCoordKey,
} from "../../../engine/world/lineTileRasterizer.js";

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
const DEFAULT_GUEST_MENTAL_EVALUATION_CADENCE_HZ = 4;
const DEFAULT_GUEST_DANGER_MEMORY_EXPIRY_SECONDS = 20.0;
const DEFAULT_GUEST_DANGER_REMEMBERED_SIGNAL_MULTIPLIER = 0.6;
const DEFAULT_GUEST_DANGER_LIVE_DISTANCE_MIN_TILES = 1.5;
const DEFAULT_GUEST_DANGER_LIVE_DISTANCE_MAX_TILES = 8.0;
const DEFAULT_GUEST_DANGER_CANDIDATE_SAMPLE_COUNT = 6;
const DEFAULT_GUEST_DANGER_CANDIDATE_WEIGHT_SEPARATION = 0.55;
const DEFAULT_GUEST_DANGER_CANDIDATE_WEIGHT_HEADING_AWAY = 0.25;
const DEFAULT_GUEST_DANGER_CANDIDATE_WEIGHT_LOS_BREAK = 0.2;
const DEFAULT_GUEST_DANGER_LINE_CHECK_STEP_TILES = 0.2;
const DEFAULT_GUEST_TILE_KNOWLEDGE_SAMPLE_RADIUS_TILES = 6;
const MAX_GUEST_TILE_KNOWLEDGE_DEBUG_SAMPLE_TILES = 1024;
const LOCOMOTION_SUB_TILE_SIZE_TILES = 0.25;
const SOFT_SEPARATION_MIN_DISTANCE_TILES = HUMAN_COLLIDER_RADIUS_TILES * 2;
const SOFT_SEPARATION_STRENGTH = 0.45;
const SOFT_SEPARATION_EPSILON = 0.000001;
const DOORWAY_TARGET_MIN_DISTANCE_TILES = 0.2;

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, Number(value)));
}

function normalizeWorldPoint(point) {
  return {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
  };
}

function normalizeVector2(vector) {
  const x = Number(vector?.x) || 0;
  const y = Number(vector?.y) || 0;
  const length = Math.hypot(x, y);
  if (length <= 0.000001) {
    return {
      x: 0,
      y: 0,
    };
  }
  return {
    x: x / length,
    y: y / length,
  };
}

function dotVector2(a, b) {
  return (Number(a?.x) || 0) * (Number(b?.x) || 0) + (Number(a?.y) || 0) * (Number(b?.y) || 0);
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

function worldTileKey(tileX, tileY) {
  return `${Math.floor(tileX)},${Math.floor(tileY)}`;
}

function parseWorldTileKey(key) {
  const source = String(key || "");
  const commaIndex = source.indexOf(",");
  if (commaIndex <= 0 || commaIndex >= source.length - 1) {
    return null;
  }
  const tileX = Number(source.slice(0, commaIndex));
  const tileY = Number(source.slice(commaIndex + 1));
  if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
    return null;
  }
  return {
    x: Math.floor(tileX),
    y: Math.floor(tileY),
  };
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

function isWalkableGuestSubTileCenter(runtime, subTileX, subTileY) {
  const center = subTileCellToWorldCenter(
    subTileX,
    subTileY,
    LOCOMOTION_SUB_TILE_SIZE_TILES
  );
  if (typeof runtime.isWalkableWorldRect === "function") {
    return runtime.isWalkableWorldRect(
      center.x,
      center.y,
      HUMAN_COLLIDER_RADIUS_TILES,
      HUMAN_COLLIDER_RADIUS_TILES
    );
  }
  if (typeof runtime.isWalkableWorldPoint === "function") {
    return runtime.isWalkableWorldPoint(
      center.x,
      center.y,
      HUMAN_COLLIDER_RADIUS_TILES
    );
  }
  const tile = runtime.worldToTile(center.x, center.y);
  return runtime.isWalkableTile(tile.x, tile.y);
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
  guestDangerPolicy = null,
  guestMentalModelConfig = null,
} = {}) {
  if (!scene || !runtime) {
    throw new Error("createHumanManager requires scene and runtime.");
  }
  const resolvedGuestMentalModelConfig =
    guestMentalModelConfig == null
      ? null
      : validateGuestMentalModelConfig(guestMentalModelConfig, {
          label: "createHumanManager guestMentalModelConfig",
        });
  const guestMentalModelEnabled = resolvedGuestMentalModelConfig != null;
  const guestMentalEvaluationCadenceHz = guestMentalModelEnabled
    ? Math.max(
        0.01,
        Number(resolvedGuestMentalModelConfig.evaluationCadenceHz) ||
          DEFAULT_GUEST_MENTAL_EVALUATION_CADENCE_HZ
      )
    : 0;
  const guestMentalEvaluationIntervalSeconds =
    guestMentalEvaluationCadenceHz > 0 ? 1 / guestMentalEvaluationCadenceHz : Infinity;
  const guestTileKnowledgeById = new Map();
  const guestDangerMemoryById = new Map();

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
  const resolvedGuestDangerPolicy = {
    dangerMemoryExpirySeconds: Math.max(
      0.01,
      Number(guestDangerPolicy?.dangerMemoryExpirySeconds) ||
        DEFAULT_GUEST_DANGER_MEMORY_EXPIRY_SECONDS
    ),
    dangerRememberedSignalMultiplier: Math.max(
      0,
      Math.min(
        1,
        Number(guestDangerPolicy?.dangerRememberedSignalMultiplier) ||
          DEFAULT_GUEST_DANGER_REMEMBERED_SIGNAL_MULTIPLIER
      )
    ),
    dangerLiveDistanceMinTiles: Math.max(
      0,
      Number(guestDangerPolicy?.dangerLiveDistanceMinTiles) ||
        DEFAULT_GUEST_DANGER_LIVE_DISTANCE_MIN_TILES
    ),
    dangerLiveDistanceMaxTiles: 0,
    dangerCandidateSampleCount: Math.max(
      1,
      Math.floor(
        Number(guestDangerPolicy?.dangerCandidateSampleCount) ||
          DEFAULT_GUEST_DANGER_CANDIDATE_SAMPLE_COUNT
      )
    ),
    dangerCandidateWeights: {
      separation: Math.max(
        0,
        Number(guestDangerPolicy?.dangerCandidateWeights?.separation) ||
          DEFAULT_GUEST_DANGER_CANDIDATE_WEIGHT_SEPARATION
      ),
      headingAway: Math.max(
        0,
        Number(guestDangerPolicy?.dangerCandidateWeights?.headingAway) ||
          DEFAULT_GUEST_DANGER_CANDIDATE_WEIGHT_HEADING_AWAY
      ),
      losBreak: Math.max(
        0,
        Number(guestDangerPolicy?.dangerCandidateWeights?.losBreak) ||
          DEFAULT_GUEST_DANGER_CANDIDATE_WEIGHT_LOS_BREAK
      ),
    },
    dangerLineCheckStepTiles: Math.max(
      0.05,
      Number(guestDangerPolicy?.dangerLineCheckStepTiles) ||
        DEFAULT_GUEST_DANGER_LINE_CHECK_STEP_TILES
    ),
  };
  resolvedGuestDangerPolicy.dangerLiveDistanceMaxTiles = Math.max(
    resolvedGuestDangerPolicy.dangerLiveDistanceMinTiles + 0.01,
    Number(guestDangerPolicy?.dangerLiveDistanceMaxTiles) ||
      DEFAULT_GUEST_DANGER_LIVE_DISTANCE_MAX_TILES
  );
  const dangerCandidateWeightSum =
    resolvedGuestDangerPolicy.dangerCandidateWeights.separation +
    resolvedGuestDangerPolicy.dangerCandidateWeights.headingAway +
    resolvedGuestDangerPolicy.dangerCandidateWeights.losBreak;
  if (dangerCandidateWeightSum > 0.000001) {
    resolvedGuestDangerPolicy.dangerCandidateWeights.separation /=
      dangerCandidateWeightSum;
    resolvedGuestDangerPolicy.dangerCandidateWeights.headingAway /=
      dangerCandidateWeightSum;
    resolvedGuestDangerPolicy.dangerCandidateWeights.losBreak /= dangerCandidateWeightSum;
  } else {
    resolvedGuestDangerPolicy.dangerCandidateWeights = {
      separation: DEFAULT_GUEST_DANGER_CANDIDATE_WEIGHT_SEPARATION,
      headingAway: DEFAULT_GUEST_DANGER_CANDIDATE_WEIGHT_HEADING_AWAY,
      losBreak: DEFAULT_GUEST_DANGER_CANDIDATE_WEIGHT_LOS_BREAK,
    };
  }
  const guestMentalInputAdapter = guestMentalModelEnabled
    ? createGuestMentalModelInputAdapter({
        runtime,
        dangerDistanceSignalProvider: ({
          guestController = null,
          guestId = null,
        } = {}) => {
          if (!guestPerceptionEnabled || guestId == null) {
            return 0;
          }
          const dangerMemoryState = guestDangerMemoryById.get(guestId);
          if (!dangerMemoryState) {
            return 0;
          }
          const guestWorld =
            typeof guestController?.getCurrentWorldPosition === "function"
              ? guestController.getCurrentWorldPosition()
              : null;
          const nowMs = scene.time?.now ?? performance.now();
          const signal = computeGuestDangerSignal({
            state: dangerMemoryState,
            guestWorld,
            nowMs,
            config: resolvedGuestDangerPolicy,
          });
          return signal.signalFinal;
        },
        areaContextResolver: ({
          guestController = null,
          guestId = null,
        } = {}) =>
          resolveGuestPerceivedAreaContext({
            guestController,
            guestId,
          }),
      })
    : null;
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
  const guestMentalPathFeedbackById = new Map();
  const guestWaypointSelectionDebugById = new Map();
  const guestDangerResponseDebugById = new Map();
  const guestWanderStateById = new Map();
  const guestMentalStateById = new Map();
  let lastGuestBehaviorCycle = null;
  let lastGuestDangerMemoryCycle = null;
  let lastGuestMentalCycle = null;
  let totalGuestConversions = 0;
  let lastGuestConversionCycle = null;
  let debugEnabled = false;

  function buildGuestOccupancyKeySet(guests, zombieTargets) {
    const guestWorldPoints = Array.isArray(guests)
      ? guests
          .map((entry) => entry?.controller?.getCurrentWorldPosition?.())
          .filter((world) => isFiniteNumber(world?.x) && isFiniteNumber(world?.y))
      : [];
    const zombieWorldPoints = Array.isArray(zombieTargets)
      ? zombieTargets
          .map((target) => normalizeWorldPoint(target?.world))
          .filter((world) => isFiniteNumber(world?.x) && isFiniteNumber(world?.y))
      : [];
    return buildOccupiedSubTileKeysFromWorldPoints(
      [...guestWorldPoints, ...zombieWorldPoints],
      { cellSizeTiles: LOCOMOTION_SUB_TILE_SIZE_TILES }
    );
  }

  function assignGuestRasterPath(controller, targetWorld, options = {}) {
    if (!controller || !targetWorld) {
      return {
        accepted: false,
        reason: "invalid_target",
        pathResult: null,
      };
    }
    const startWorld = controller.getCurrentWorldPosition?.();
    if (!isFiniteNumber(startWorld?.x) || !isFiniteNumber(startWorld?.y)) {
      return {
        accepted: false,
        reason: "invalid_start",
        pathResult: null,
      };
    }
    const goalWorld = normalizeWorldPoint(targetWorld);
    const occupiedSubTileKeys =
      options.occupiedSubTileKeys instanceof Set ? options.occupiedSubTileKeys : null;
    const allowOccupiedGoal = options.allowOccupiedGoal === true;
    const pathResult = rasterizeSubTileLine({
      startWorld,
      goalWorld,
      cellSizeTiles: LOCOMOTION_SUB_TILE_SIZE_TILES,
      includeStart: false,
      includeGoal: true,
      isBlockedCell: (cell, context) => {
        if (!isWalkableGuestSubTileCenter(runtime, cell.x, cell.y)) {
          return true;
        }
        if (!occupiedSubTileKeys) {
          return false;
        }
        const key = subTileCoordKey(cell.x, cell.y);
        if (!occupiedSubTileKeys.has(key)) {
          return false;
        }
        if (context.isStart) {
          return false;
        }
        if (allowOccupiedGoal && context.isGoal) {
          return false;
        }
        return true;
      },
    });
    if (!Array.isArray(pathResult.pathWorld) || pathResult.pathWorld.length === 0) {
      return {
        accepted: false,
        reason: pathResult.status === "blocked" ? "path_blocked" : "empty_path",
        pathResult,
      };
    }
    const accepted = controller.setWorldPath(pathResult.pathWorld);
    return {
      accepted,
      reason: accepted ? "planned" : "rejected_by_controller",
      pathResult,
    };
  }

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
    guestDangerMemoryById.delete(guestId);
    guestBehaviorById.delete(guestId);
    guestTileKnowledgeById.delete(guestId);
    guestMentalPathFeedbackById.delete(guestId);
    guestWaypointSelectionDebugById.delete(guestId);
    guestDangerResponseDebugById.delete(guestId);
    guestWanderStateById.delete(guestId);
    guestMentalStateById.delete(guestId);
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
    guestDangerMemoryById.delete(humanId);
    guestBehaviorById.delete(humanId);
    guestTileKnowledgeById.delete(humanId);
    guestMentalPathFeedbackById.delete(humanId);
    guestWaypointSelectionDebugById.delete(humanId);
    guestDangerResponseDebugById.delete(humanId);
    guestWanderStateById.delete(humanId);
    guestMentalStateById.delete(humanId);
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
    const visibleTileCountChanged =
      Math.floor(Number(previous?.visibleTileCount) || 0) !==
      Math.floor(Number(nextState?.visibleTileCount) || 0);
    const dangerSourceChanged =
      String(previous?.dangerSource || "none") !==
      String(nextState?.dangerSource || "none");
    const dangerSignalChanged =
      Math.abs(
        (Number(previous?.dangerSignal) || 0) -
          (Number(nextState?.dangerSignal) || 0)
      ) > 0.001;
    guestPerceptionById.set(humanId, nextState);
    return (
      targetChanged ||
      detectedChanged ||
      visibleTileCountChanged ||
      dangerSourceChanged ||
      dangerSignalChanged
    );
  }

  function getGuestDangerMemoryState(humanId) {
    let state = guestDangerMemoryById.get(humanId);
    if (!state) {
      state = createGuestDangerMemoryState();
      guestDangerMemoryById.set(humanId, state);
    }
    return state;
  }

  function buildGuestDangerMemoryDebugSnapshot(humanId, guestController = null) {
    const state = guestDangerMemoryById.get(humanId);
    if (!state) {
      return null;
    }
    const world =
      typeof guestController?.getCurrentWorldPosition === "function"
        ? guestController.getCurrentWorldPosition()
        : null;
    const nowMs = scene.time?.now ?? performance.now();
    return getGuestDangerMemoryDebugSnapshot(
      state,
      nowMs,
      resolvedGuestDangerPolicy,
      world
    );
  }

  function reportGuestDamageDangerEvent({
    guestId = null,
    sourceId = null,
    sourceWorld = null,
    impactWorld = null,
    damageAmount = null,
    reason = "damage_taken",
    nowMs = null,
  } = {}) {
    if (guestId == null) {
      return false;
    }
    const record = humansById.get(guestId);
    if (!record || !record.controller) {
      return false;
    }
    const role =
      typeof record.controller.getRole === "function"
        ? record.controller.getRole()
        : record.role;
    if (role !== ROLE_GUEST || !isControllerAlive(record.controller)) {
      return false;
    }
    if (Number(damageAmount) <= 0) {
      return false;
    }
    const guestWorld =
      typeof record.controller.getCurrentWorldPosition === "function"
        ? record.controller.getCurrentWorldPosition()
        : null;
    if (!Number.isFinite(guestWorld?.x) || !Number.isFinite(guestWorld?.y)) {
      return false;
    }

    let threatWorld = null;
    // Damage reaction should anchor danger at impact location first ("where the guest got hit").
    if (Number.isFinite(impactWorld?.x) && Number.isFinite(impactWorld?.y)) {
      threatWorld = {
        x: Number(impactWorld.x),
        y: Number(impactWorld.y),
      };
    } else if (Number.isFinite(sourceWorld?.x) && Number.isFinite(sourceWorld?.y)) {
      threatWorld = {
        x: Number(sourceWorld.x),
        y: Number(sourceWorld.y),
      };
    }
    if (!threatWorld) {
      return false;
    }

    const timestampMs = Number.isFinite(nowMs)
      ? Number(nowMs)
      : scene.time?.now ?? performance.now();
    const distanceToThreat = Math.hypot(
      threatWorld.x - guestWorld.x,
      threatWorld.y - guestWorld.y
    );
    const dangerMemoryState = getGuestDangerMemoryState(guestId);

    // Prime memory with impact source and immediately transition to remembered state.
    // This ensures guests react even when attack came from outside current LOS.
    updateGuestDangerMemoryFromPerception({
      state: dangerMemoryState,
      perceptionState: {
        detected: true,
        targetId:
          typeof sourceId === "string" || Number.isFinite(sourceId)
            ? sourceId
            : `${reason || "damage_taken"}_${guestId}`,
        targetWorld: {
          x: threatWorld.x,
          y: threatWorld.y,
        },
        distanceToTarget: Number.isFinite(distanceToThreat) ? distanceToThreat : null,
      },
      nowMs: timestampMs,
      config: resolvedGuestDangerPolicy,
    });
    updateGuestDangerMemoryFromPerception({
      state: dangerMemoryState,
      perceptionState: {
        detected: false,
        targetId: null,
        targetWorld: null,
        distanceToTarget: null,
      },
      nowMs: timestampMs,
      config: resolvedGuestDangerPolicy,
    });

    const dangerSignal = computeGuestDangerSignal({
      state: dangerMemoryState,
      guestWorld,
      nowMs: timestampMs,
      config: resolvedGuestDangerPolicy,
    });
    const previousPerception = guestPerceptionById.get(guestId) || {
      detected: false,
      targetId: null,
      targetWorld: null,
      distanceToTarget: null,
      visibleTileCount: 0,
    };
    guestPerceptionById.set(guestId, {
      ...previousPerception,
      dangerSignal: dangerSignal.signalFinal,
      dangerSource: dangerSignal.source,
    });
    return true;
  }

  function runGuestPerceptionStep() {
    if (!guestPerceptionEnabled) {
      lastGuestPerceptionCycle = {
        enabled: false,
      };
      lastGuestDangerMemoryCycle = {
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
    let visibleTileCount = 0;
    let roomRevealTileCount = 0;
    let liveDangerSourceGuestCount = 0;
    let rememberedDangerSourceGuestCount = 0;
    let noDangerSourceGuestCount = 0;
    let expiredDangerMemoryCount = 0;
    const nowMs = scene.time?.now ?? performance.now();

    for (const [humanId] of guestPerceptionById.entries()) {
      if (!activeGuestIds.has(humanId)) {
        guestPerceptionById.delete(humanId);
      }
    }
    for (const [humanId] of guestTileKnowledgeById.entries()) {
      if (!activeGuestIds.has(humanId)) {
        guestTileKnowledgeById.delete(humanId);
      }
    }
    for (const [humanId] of guestDangerMemoryById.entries()) {
      if (!activeGuestIds.has(humanId)) {
        guestDangerMemoryById.delete(humanId);
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
      visibleTileCount += Number(evaluation?.stats?.visibleTileCount) || 0;
      if (evaluation.detected) {
        detectedGuestCount += 1;
      }
      const tileKnowledgeUpdate = updateGuestTileKnowledgeFromVisibleTiles(
        guest.id,
        Array.isArray(evaluation?.visibleTiles) ? evaluation.visibleTiles : []
      );
      roomRevealTileCount += Number(tileKnowledgeUpdate?.roomRevealTileCount) || 0;

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
        visibleTileCount: Math.max(
          0,
          Math.floor(Number(evaluation?.stats?.visibleTileCount) || 0)
        ),
      };
      const dangerMemoryState = getGuestDangerMemoryState(guest.id);
      updateGuestDangerMemoryFromPerception({
        state: dangerMemoryState,
        perceptionState: nextState,
        nowMs,
        config: resolvedGuestDangerPolicy,
      });
      const dangerSignal = computeGuestDangerSignal({
        state: dangerMemoryState,
        guestWorld: controller.getCurrentWorldPosition(),
        nowMs,
        config: resolvedGuestDangerPolicy,
      });
      nextState.dangerSignal = dangerSignal.signalFinal;
      nextState.dangerSource = dangerSignal.source;
      if (dangerSignal.source === "live") {
        liveDangerSourceGuestCount += 1;
      } else if (dangerSignal.source === "remembered") {
        rememberedDangerSourceGuestCount += 1;
      } else {
        noDangerSourceGuestCount += 1;
      }
      if (dangerSignal.expired === true) {
        expiredDangerMemoryCount += 1;
      }
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
      visibleTileCount,
      roomRevealTileCount,
      lineCheckStepTiles: config.lineCheckStepTiles,
    };
    lastGuestDangerMemoryCycle = {
      enabled: true,
      guestCount: guests.length,
      liveDangerSourceGuestCount,
      rememberedDangerSourceGuestCount,
      noDangerSourceGuestCount,
      expiredDangerMemoryCount,
      dangerMemoryExpirySeconds: resolvedGuestDangerPolicy.dangerMemoryExpirySeconds,
      dangerRememberedSignalMultiplier:
        resolvedGuestDangerPolicy.dangerRememberedSignalMultiplier,
      dangerLiveDistanceMinTiles: resolvedGuestDangerPolicy.dangerLiveDistanceMinTiles,
      dangerLiveDistanceMaxTiles: resolvedGuestDangerPolicy.dangerLiveDistanceMaxTiles,
    };

    return changed;
  }

  function getGuestBehaviorState(humanId) {
    let state = guestBehaviorById.get(humanId);
    if (!state) {
      state = {
        mode: "wander",
        objectiveState: "wander",
        objectiveDispatchMode: "wander",
        objectiveReasonCode: null,
        objectivePathStatus: "idle",
        objectiveFailureReason: null,
        objectiveTargetWorld: null,
        replanCooldownSeconds: 0,
        lastPlanReason: null,
        targetId: null,
      };
      guestBehaviorById.set(humanId, state);
    }
    return state;
  }

  function createInitialGuestTileKnowledgeState(humanId) {
    return {
      id: humanId,
      identifiedTiles: new Set(),
      tileSources: new Map(),
      knownRoomKeys: new Set(),
      lastLosTileKeys: new Set(),
      lastRoomRevealTileKeys: new Set(),
      lastUpdatedAtMs: -Infinity,
    };
  }

  function getGuestTileKnowledgeState(humanId) {
    let state = guestTileKnowledgeById.get(humanId);
    if (!state) {
      state = createInitialGuestTileKnowledgeState(humanId);
      guestTileKnowledgeById.set(humanId, state);
    }
    return state;
  }

  function markTileKnowledgeSource(tileKnowledgeState, tileX, tileY, source) {
    if (!tileKnowledgeState) {
      return;
    }
    const normalizedTileX = Math.floor(tileX);
    const normalizedTileY = Math.floor(tileY);
    if (!Number.isFinite(normalizedTileX) || !Number.isFinite(normalizedTileY)) {
      return;
    }
    const key = worldTileKey(normalizedTileX, normalizedTileY);
    tileKnowledgeState.identifiedTiles.add(key);
    const existing =
      tileKnowledgeState.tileSources.get(key) || { los: false, roomReveal: false };
    if (source === "room_reveal") {
      existing.roomReveal = true;
    } else {
      existing.los = true;
    }
    tileKnowledgeState.tileSources.set(key, existing);
  }

  function classifyTileAtTile(tileX, tileY) {
    if (typeof runtime?.classifyAreaAtWorld !== "function") {
      return null;
    }
    const centerX = Math.floor(tileX) + 0.5;
    const centerY = Math.floor(tileY) + 0.5;
    return runtime.classifyAreaAtWorld(centerX, centerY);
  }

  function updateGuestTileKnowledgeFromVisibleTiles(humanId, visibleTiles = []) {
    const tileKnowledgeState = getGuestTileKnowledgeState(humanId);
    const losTileKeys = new Set();
    const roomsToReveal = new Map();
    const roomRevealTileKeys = new Set();

    for (const tile of visibleTiles) {
      const tileX = Math.floor(Number(tile?.x));
      const tileY = Math.floor(Number(tile?.y));
      if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
        continue;
      }
      const tileKeyValue = worldTileKey(tileX, tileY);
      losTileKeys.add(tileKeyValue);
      markTileKnowledgeSource(tileKnowledgeState, tileX, tileY, "los");

      const classified = classifyTileAtTile(tileX, tileY);
      if (!classified || (classified.inRoom !== true && classified.doorwayTreatedAsRoom !== true)) {
        continue;
      }
      let roomData = null;
      if (
        typeof runtime?.getRoomTilesByReference === "function" &&
        Number.isFinite(classified.chunkX) &&
        Number.isFinite(classified.chunkY) &&
        Number.isFinite(classified.roomIndex)
      ) {
        roomData = runtime.getRoomTilesByReference(
          classified.chunkX,
          classified.chunkY,
          classified.roomIndex
        );
      }
      if (
        !roomData &&
        typeof runtime?.getRoomTilesAtWorld === "function"
      ) {
        roomData = runtime.getRoomTilesAtWorld(tileX + 0.5, tileY + 0.5);
      }
      if (!roomData?.roomKey || !Array.isArray(roomData.tiles)) {
        continue;
      }
      if (tileKnowledgeState.knownRoomKeys.has(roomData.roomKey)) {
        continue;
      }
      roomsToReveal.set(roomData.roomKey, roomData);
    }

    for (const [roomKey, roomData] of roomsToReveal.entries()) {
      tileKnowledgeState.knownRoomKeys.add(roomKey);
      for (const tile of roomData.tiles) {
        const tileX = Math.floor(Number(tile?.x));
        const tileY = Math.floor(Number(tile?.y));
        if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
          continue;
        }
        const tileKeyValue = worldTileKey(tileX, tileY);
        roomRevealTileKeys.add(tileKeyValue);
        markTileKnowledgeSource(tileKnowledgeState, tileX, tileY, "room_reveal");
      }
    }

    tileKnowledgeState.lastLosTileKeys = losTileKeys;
    tileKnowledgeState.lastRoomRevealTileKeys = roomRevealTileKeys;
    tileKnowledgeState.lastUpdatedAtMs = scene.time?.now ?? performance.now();

    return {
      losTileCount: losTileKeys.size,
      roomRevealTileCount: roomRevealTileKeys.size,
      identifiedTileCount: tileKnowledgeState.identifiedTiles.size,
      knownRoomCount: tileKnowledgeState.knownRoomKeys.size,
    };
  }

  function resolveGuestPerceivedAreaContext({
    guestController = null,
    guestId = null,
  } = {}) {
    if (
      !guestController ||
      typeof guestController.getCurrentWorldPosition !== "function" ||
      typeof runtime?.classifyAreaAtWorld !== "function" ||
      typeof runtime?.worldToTile !== "function"
    ) {
      return {
        inRoom: false,
        inCorridor: false,
        classification: "unknown",
        doorwayTreatedAsRoom: false,
        isDoorwayTile: false,
        tileX: null,
        tileY: null,
        tile: null,
        roomIndex: null,
        chunkX: null,
        chunkY: null,
        identifiedByMemory: false,
        identifiedSourceLos: false,
        identifiedSourceRoomReveal: false,
      };
    }

    const world = guestController.getCurrentWorldPosition();
    if (!isFiniteNumber(world?.x) || !isFiniteNumber(world?.y)) {
      return {
        inRoom: false,
        inCorridor: false,
        classification: "unknown",
        doorwayTreatedAsRoom: false,
        isDoorwayTile: false,
        tileX: null,
        tileY: null,
        tile: null,
        roomIndex: null,
        chunkX: null,
        chunkY: null,
        identifiedByMemory: false,
        identifiedSourceLos: false,
        identifiedSourceRoomReveal: false,
      };
    }

    const tile = runtime.worldToTile(world.x, world.y);
    const tileX = Math.floor(tile.x);
    const tileY = Math.floor(tile.y);
    const tileKeyValue = worldTileKey(tileX, tileY);
    const classified = runtime.classifyAreaAtWorld(world.x, world.y);
    const tileKnowledgeState =
      guestId != null ? guestTileKnowledgeById.get(guestId) : null;
    const identified = tileKnowledgeState?.identifiedTiles?.has(tileKeyValue) === true;
    const sourceFlags = tileKnowledgeState?.tileSources?.get(tileKeyValue) || null;

    if (!identified) {
      return {
        inRoom: false,
        inCorridor: false,
        classification: "unknown",
        doorwayTreatedAsRoom: false,
        isDoorwayTile: false,
        tileX: Number.isFinite(classified?.tileX) ? classified.tileX : tileX,
        tileY: Number.isFinite(classified?.tileY) ? classified.tileY : tileY,
        tile: Number.isFinite(classified?.tile) ? classified.tile : null,
        roomIndex: null,
        chunkX: Number.isFinite(classified?.chunkX) ? classified.chunkX : null,
        chunkY: Number.isFinite(classified?.chunkY) ? classified.chunkY : null,
        identifiedByMemory: false,
        identifiedSourceLos: false,
        identifiedSourceRoomReveal: false,
      };
    }

    return {
      inRoom: classified?.inRoom === true,
      inCorridor: classified?.inCorridor === true,
      classification: classified?.classification || "other",
      doorwayTreatedAsRoom: classified?.doorwayTreatedAsRoom === true,
      isDoorwayTile: classified?.isDoorwayTile === true,
      tileX: Number.isFinite(classified?.tileX) ? classified.tileX : tileX,
      tileY: Number.isFinite(classified?.tileY) ? classified.tileY : tileY,
      tile: Number.isFinite(classified?.tile) ? classified.tile : null,
      roomIndex: Number.isFinite(classified?.roomIndex) ? classified.roomIndex : null,
      chunkX: Number.isFinite(classified?.chunkX) ? classified.chunkX : null,
      chunkY: Number.isFinite(classified?.chunkY) ? classified.chunkY : null,
      identifiedByMemory: true,
      identifiedSourceLos: sourceFlags?.los === true,
      identifiedSourceRoomReveal: sourceFlags?.roomReveal === true,
    };
  }

  function buildGuestTileKnowledgeDebug(guestId, options = {}) {
    const tileKnowledgeState = guestTileKnowledgeById.get(guestId);
    if (!tileKnowledgeState) {
      return null;
    }
    const humanEntry = humansById.get(guestId);
    if (!humanEntry?.controller || !isControllerAlive(humanEntry.controller)) {
      return null;
    }
    if (
      typeof humanEntry.controller.getCurrentWorldPosition !== "function" ||
      typeof runtime?.worldToTile !== "function" ||
      typeof runtime?.classifyAreaAtWorld !== "function"
    ) {
      return null;
    }

    const world = humanEntry.controller.getCurrentWorldPosition();
    if (!isFiniteNumber(world?.x) || !isFiniteNumber(world?.y)) {
      return null;
    }
    const centerTile = runtime.worldToTile(world.x, world.y);
    const centerTileX = Math.floor(centerTile.x);
    const centerTileY = Math.floor(centerTile.y);
    const sampleRadiusTiles = Math.max(
      1,
      Math.floor(
        Number(options?.sampleRadiusTiles) ||
          DEFAULT_GUEST_TILE_KNOWLEDGE_SAMPLE_RADIUS_TILES
      )
    );
    const maxSampleTiles = Math.max(
      32,
      Math.floor(Number(options?.maxSampleTiles) || MAX_GUEST_TILE_KNOWLEDGE_DEBUG_SAMPLE_TILES)
    );
    const orderedTileKeys = [];
    const enqueuedTileKeys = new Set();
    const sampleTiles = [];
    const enqueueTileKey = (tileX, tileY) => {
      if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
        return;
      }
      const normalizedTileX = Math.floor(tileX);
      const normalizedTileY = Math.floor(tileY);
      const key = worldTileKey(normalizedTileX, normalizedTileY);
      if (enqueuedTileKeys.has(key)) {
        return;
      }
      enqueuedTileKeys.add(key);
      orderedTileKeys.push(key);
    };

    // Ensure focal tile is always included.
    enqueueTileKey(centerTileX, centerTileY);

    // Priority 1: full current LOS footprint.
    for (const key of tileKnowledgeState.lastLosTileKeys) {
      const parsed = parseWorldTileKey(key);
      if (parsed) {
        enqueueTileKey(parsed.x, parsed.y);
      }
    }

    // Priority 2: room tiles revealed from recent LOS room/doorway identification.
    for (const key of tileKnowledgeState.lastRoomRevealTileKeys) {
      const parsed = parseWorldTileKey(key);
      if (parsed) {
        enqueueTileKey(parsed.x, parsed.y);
      }
    }

    // Priority 3: local context window around the inspected guest.
    for (
      let tileY = centerTileY - sampleRadiusTiles;
      tileY <= centerTileY + sampleRadiusTiles;
      tileY += 1
    ) {
      for (
        let tileX = centerTileX - sampleRadiusTiles;
        tileX <= centerTileX + sampleRadiusTiles;
        tileX += 1
      ) {
        enqueueTileKey(tileX, tileY);
      }
    }

    for (const key of orderedTileKeys) {
      if (sampleTiles.length >= maxSampleTiles) {
        break;
      }
      const parsed = parseWorldTileKey(key);
      if (!parsed) {
        continue;
      }
      const sourceFlags = tileKnowledgeState.tileSources.get(key) || null;
      const identified = tileKnowledgeState.identifiedTiles.has(key);
      const classified = runtime.classifyAreaAtWorld(parsed.x + 0.5, parsed.y + 0.5);
      sampleTiles.push({
        x: parsed.x,
        y: parsed.y,
        key,
        identified,
        sourceLos: sourceFlags?.los === true,
        sourceRoomReveal: sourceFlags?.roomReveal === true,
        inRoom: classified?.inRoom === true,
        inCorridor: classified?.inCorridor === true,
        doorwayTreatedAsRoom: classified?.doorwayTreatedAsRoom === true,
        classification: classified?.classification || "other",
      });
    }

    const lastLosTiles = [];
    for (const key of tileKnowledgeState.lastLosTileKeys) {
      const parsed = parseWorldTileKey(key);
      if (parsed) {
        lastLosTiles.push(parsed);
      }
    }
    const lastRoomRevealTiles = [];
    for (const key of tileKnowledgeState.lastRoomRevealTileKeys) {
      const parsed = parseWorldTileKey(key);
      if (parsed) {
        lastRoomRevealTiles.push(parsed);
      }
    }

    return {
      guestId,
      centerTile: {
        x: centerTileX,
        y: centerTileY,
      },
      sampleRadiusTiles,
      identifiedTileCount: tileKnowledgeState.identifiedTiles.size,
      knownRoomCount: tileKnowledgeState.knownRoomKeys.size,
      knownRoomKeys: [...tileKnowledgeState.knownRoomKeys],
      lastUpdatedAtMs: tileKnowledgeState.lastUpdatedAtMs,
      lastLosTiles,
      lastRoomRevealTiles,
      sampleTiles,
    };
  }

  function createInitialGuestMentalState(humanId) {
    const phaseRatio = (getDeterministicIdHash(humanId) % 997) / 997;
    return {
      runtime: createGuestMentalRuntimeState(resolvedGuestMentalModelConfig),
      lastInputDebug: null,
      evaluationCooldownSeconds:
        guestMentalEvaluationIntervalSeconds === Infinity
          ? Infinity
          : guestMentalEvaluationIntervalSeconds * phaseRatio,
    };
  }

  function getGuestMentalState(humanId) {
    let state = guestMentalStateById.get(humanId);
    if (!state) {
      state = createInitialGuestMentalState(humanId);
      guestMentalStateById.set(humanId, state);
    }
    return state;
  }

  function buildGuestMentalInputValues(guest, controller, perceptionState) {
    if (!guestMentalInputAdapter) {
      return {
        inputValues: {},
        debug: null,
      };
    }
    return guestMentalInputAdapter.buildInputs({
      config: resolvedGuestMentalModelConfig,
      guestController: controller,
      guestId: guest?.id ?? null,
      guestPerceptionState: perceptionState || null,
    });
  }

  function runGuestMentalModelStep(dtSeconds, { recordCycle = true } = {}) {
    if (!guestMentalModelEnabled) {
      if (recordCycle) {
        lastGuestMentalCycle = {
          enabled: false,
        };
      }
      return false;
    }

    const guests = getHumanEntries({ livingOnly: true }).filter(
      (entry) => entry.role === ROLE_GUEST
    );
    const activeGuestIds = new Set(guests.map((entry) => entry.id));
    let changed = false;
    let evaluatedGuestCount = 0;
    let dominantChangedCount = 0;
    const dominantStateCounts = {};
    let inRoomGuestCount = 0;
    let inCorridorGuestCount = 0;
    let doorwayAsRoomGuestCount = 0;
    let unknownAreaGuestCount = 0;
    let holdLockedCount = 0;
    let preemptedCount = 0;
    let fallbackAppliedCount = 0;
    let fallbackRetryingCount = 0;
    const objectiveStateCounts = {
      wander: 0,
      shelter: 0,
      danger: 0,
      thirst: 0,
      hunger: 0,
      none: 0,
    };
    for (const stateId of resolvedGuestMentalModelConfig.states) {
      dominantStateCounts[stateId] = 0;
    }

    for (const [humanId] of guestMentalStateById.entries()) {
      if (!activeGuestIds.has(humanId)) {
        guestMentalStateById.delete(humanId);
      }
    }
    for (const [humanId] of guestTileKnowledgeById.entries()) {
      if (!activeGuestIds.has(humanId)) {
        guestTileKnowledgeById.delete(humanId);
      }
    }
    for (const [humanId] of guestMentalPathFeedbackById.entries()) {
      if (!activeGuestIds.has(humanId)) {
        guestMentalPathFeedbackById.delete(humanId);
      }
    }
    for (const [humanId] of guestDangerResponseDebugById.entries()) {
      if (!activeGuestIds.has(humanId)) {
        guestDangerResponseDebugById.delete(humanId);
      }
    }

    const dt = Math.max(0, Number(dtSeconds) || 0);
    for (const guest of guests) {
      const mentalState = getGuestMentalState(guest.id);
      mentalState.evaluationCooldownSeconds = Math.max(
        0,
        Number(mentalState.evaluationCooldownSeconds) - dt
      );

      const shouldEvaluate =
        mentalState.runtime.evaluationCount <= 0 ||
        mentalState.evaluationCooldownSeconds <= 0;
      if (shouldEvaluate) {
        const previousDominantState = mentalState.runtime.lastDominantState ?? null;
        const perceptionState = guestPerceptionById.get(guest.id) || null;
        const inputSnapshot = buildGuestMentalInputValues(
          guest,
          guest.controller,
          perceptionState
        );
        const pathFeedback =
          guestMentalPathFeedbackById.get(guest.id) || {
            status: "none",
            reason: null,
          };
        guestMentalPathFeedbackById.delete(guest.id);
        mentalState.lastInputDebug = inputSnapshot.debug || null;
        const evaluation = evaluateGuestMentalModel({
          config: resolvedGuestMentalModelConfig,
          runtimeState: mentalState.runtime,
          inputValues: inputSnapshot.inputValues,
          dtSeconds: dt,
          pathFeedback,
        });
        evaluatedGuestCount += 1;
        if (previousDominantState !== evaluation.dominantState) {
          dominantChangedCount += 1;
          changed = true;
        }
        if (evaluation.holdLocked === true) {
          holdLockedCount += 1;
        }
        if (evaluation.arbitrationReasonCode === "preempted") {
          preemptedCount += 1;
        }
        if (evaluation.fallback?.applied === true) {
          fallbackAppliedCount += 1;
        }
        if (evaluation.fallback?.active === true) {
          fallbackRetryingCount += 1;
        }
        mentalState.evaluationCooldownSeconds =
          guestMentalEvaluationIntervalSeconds === Infinity
            ? Infinity
            : guestMentalEvaluationIntervalSeconds;
      }

      const areaDebug = mentalState.lastInputDebug;
      if (areaDebug?.inRoom === true) {
        inRoomGuestCount += 1;
      } else if (areaDebug?.inCorridor === true) {
        inCorridorGuestCount += 1;
      } else {
        unknownAreaGuestCount += 1;
      }
      if (areaDebug?.doorwayTreatedAsRoom === true) {
        doorwayAsRoomGuestCount += 1;
      }

      const dominantState = mentalState.runtime.lastDominantState;
      if (
        typeof dominantState === "string" &&
        Object.prototype.hasOwnProperty.call(dominantStateCounts, dominantState)
      ) {
        dominantStateCounts[dominantState] += 1;
      }
      const objectiveState =
        mentalState.runtime.lastEvaluationResult?.objectiveState ?? null;
      if (
        typeof objectiveState === "string" &&
        Object.prototype.hasOwnProperty.call(objectiveStateCounts, objectiveState)
      ) {
        objectiveStateCounts[objectiveState] += 1;
      } else {
        objectiveStateCounts.none += 1;
      }
    }

    if (recordCycle) {
      lastGuestMentalCycle = {
        enabled: true,
        guestCount: guests.length,
        evaluatedGuestCount,
        dominantChangedCount,
        dominantStateCounts,
        inRoomGuestCount,
        inCorridorGuestCount,
        doorwayAsRoomGuestCount,
        unknownAreaGuestCount,
        holdLockedCount,
        preemptedCount,
        fallbackAppliedCount,
        fallbackRetryingCount,
        objectiveStateCounts,
        evaluationCadenceHz: guestMentalEvaluationCadenceHz,
        evaluationIntervalSeconds:
          guestMentalEvaluationIntervalSeconds === Infinity
            ? null
            : guestMentalEvaluationIntervalSeconds,
      };
    }

    return changed;
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

  function hasClearLineOfSightBetweenWorld(startWorld, endWorld) {
    if (
      !Number.isFinite(startWorld?.x) ||
      !Number.isFinite(startWorld?.y) ||
      !Number.isFinite(endWorld?.x) ||
      !Number.isFinite(endWorld?.y)
    ) {
      return false;
    }
    const dx = endWorld.x - startWorld.x;
    const dy = endWorld.y - startWorld.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.000001) {
      return true;
    }
    const stepTiles = Math.max(
      0.05,
      Number(resolvedGuestDangerPolicy.dangerLineCheckStepTiles) ||
        DEFAULT_GUEST_DANGER_LINE_CHECK_STEP_TILES
    );
    const sampleCount = Math.max(1, Math.ceil(distance / stepTiles));
    for (let i = 1; i <= sampleCount; i += 1) {
      const t = i / sampleCount;
      const sampleX = startWorld.x + dx * t;
      const sampleY = startWorld.y + dy * t;
      if (typeof runtime.isWalkableWorldRect === "function") {
        if (
          !runtime.isWalkableWorldRect(
            sampleX,
            sampleY,
            HUMAN_COLLIDER_RADIUS_TILES,
            HUMAN_COLLIDER_RADIUS_TILES
          )
        ) {
          return false;
        }
      } else if (typeof runtime.isWalkableWorldPoint === "function") {
        if (
          !runtime.isWalkableWorldPoint(
            sampleX,
            sampleY,
            HUMAN_COLLIDER_RADIUS_TILES
          )
        ) {
          return false;
        }
      }
    }
    return true;
  }

  function collectGuestDangerCandidates({
    guestWorld,
    fleeHeadingRadians,
    wanderState,
    visionCone,
  }) {
    const sampleCount = Math.max(
      1,
      Math.floor(
        Number(resolvedGuestDangerPolicy.dangerCandidateSampleCount) ||
          DEFAULT_GUEST_DANGER_CANDIDATE_SAMPLE_COUNT
      )
    );
    const candidates = [];
    const seenWaypointKeys = new Set();
    for (let i = 0; i < sampleCount; i += 1) {
      const selection = guestWanderPlanner.pickWaypointForZombie(
        {
          getWorldPosition: () => ({ ...guestWorld }),
          getHeadingRadians: () => fleeHeadingRadians,
          getVisionCone: () => visionCone || { angleDegrees: 90, rangeTiles: 8 },
        },
        {
          includeDebug: true,
          blockedSectorsRadians: wanderState.failedSectors,
        }
      );
      const normalized = normalizeWaypointSelection(selection);
      const waypoint = normalized.waypoint;
      if (!waypoint) {
        continue;
      }
      const key = `${waypoint.x.toFixed(3)},${waypoint.y.toFixed(3)}`;
      if (seenWaypointKeys.has(key)) {
        continue;
      }
      seenWaypointKeys.add(key);
      candidates.push({
        waypoint: {
          x: waypoint.x,
          y: waypoint.y,
        },
        plannerDebug: normalized.debug || null,
        candidateIndex: candidates.length,
      });
    }
    return candidates;
  }

  function selectBestGuestDangerCandidate({
    guestWorld,
    threatWorld,
    candidates,
  }) {
    const currentDistance = Math.hypot(
      guestWorld.x - threatWorld.x,
      guestWorld.y - threatWorld.y
    );
    const awayVector = normalizeVector2({
      x: guestWorld.x - threatWorld.x,
      y: guestWorld.y - threatWorld.y,
    });
    const maxDistanceTiles = Math.max(
      0.01,
      Number(resolvedGuestDangerPolicy.dangerLiveDistanceMaxTiles) || 8
    );
    const weights = resolvedGuestDangerPolicy.dangerCandidateWeights;
    let selected = null;
    let tieBreakUsed = false;
    for (const candidate of candidates) {
      const moveVector = normalizeVector2({
        x: candidate.waypoint.x - guestWorld.x,
        y: candidate.waypoint.y - guestWorld.y,
      });
      const candidateDistance = Math.hypot(
        candidate.waypoint.x - threatWorld.x,
        candidate.waypoint.y - threatWorld.y
      );
      const separationGain = candidateDistance - currentDistance;
      const separationGainScore = clamp01(separationGain / maxDistanceTiles);
      const headingAwayScore = clamp01((dotVector2(moveVector, awayVector) + 1) * 0.5);
      const losBreakScore = hasClearLineOfSightBetweenWorld(
        threatWorld,
        candidate.waypoint
      )
        ? 0
        : 1;
      const weightedScore =
        separationGainScore * weights.separation +
        headingAwayScore * weights.headingAway +
        losBreakScore * weights.losBreak;
      const scored = {
        ...candidate,
        separationGainScore,
        headingAwayScore,
        losBreakScore,
        weightedScore,
      };
      if (!selected) {
        selected = scored;
        continue;
      }
      const scoreDelta = scored.weightedScore - selected.weightedScore;
      if (scoreDelta > 0.000001) {
        selected = scored;
        continue;
      }
      if (Math.abs(scoreDelta) > 0.000001) {
        continue;
      }
      tieBreakUsed = true;
      if (scored.losBreakScore > selected.losBreakScore + 0.000001) {
        selected = scored;
        continue;
      }
      if (Math.abs(scored.losBreakScore - selected.losBreakScore) > 0.000001) {
        continue;
      }
      if (scored.separationGainScore > selected.separationGainScore + 0.000001) {
        selected = scored;
        continue;
      }
      if (
        Math.abs(scored.separationGainScore - selected.separationGainScore) > 0.000001
      ) {
        continue;
      }
      if (scored.headingAwayScore > selected.headingAwayScore + 0.000001) {
        selected = scored;
        continue;
      }
      if (Math.abs(scored.headingAwayScore - selected.headingAwayScore) > 0.000001) {
        continue;
      }
      if (scored.candidateIndex < selected.candidateIndex) {
        selected = scored;
      }
    }
    return {
      selected,
      tieBreakUsed,
    };
  }

  function getDoorwayWorldCenter(tileX, tileY) {
    const normalizedTileX = Math.floor(Number(tileX));
    const normalizedTileY = Math.floor(Number(tileY));
    if (!Number.isFinite(normalizedTileX) || !Number.isFinite(normalizedTileY)) {
      return null;
    }
    if (typeof runtime?.tileToWorldCenter === "function") {
      return runtime.tileToWorldCenter(normalizedTileX, normalizedTileY);
    }
    return {
      x: normalizedTileX + 0.5,
      y: normalizedTileY + 0.5,
    };
  }

  function resolveRoomDoorwayTargetsForGuest(guestWorld) {
    if (
      !Number.isFinite(guestWorld?.x) ||
      !Number.isFinite(guestWorld?.y) ||
      typeof runtime?.getRoomTilesAtWorld !== "function" ||
      typeof runtime?.classifyAreaAtWorld !== "function"
    ) {
      return [];
    }
    const roomData = runtime.getRoomTilesAtWorld(guestWorld.x, guestWorld.y);
    if (!roomData || !Array.isArray(roomData.tiles) || roomData.tiles.length === 0) {
      return [];
    }

    const doorwayByTileKey = new Map();
    const addDoorwayCandidate = (tileX, tileY) => {
      const normalizedTileX = Math.floor(Number(tileX));
      const normalizedTileY = Math.floor(Number(tileY));
      if (!Number.isFinite(normalizedTileX) || !Number.isFinite(normalizedTileY)) {
        return;
      }
      const tileKeyValue = worldTileKey(normalizedTileX, normalizedTileY);
      if (doorwayByTileKey.has(tileKeyValue)) {
        return;
      }
      const doorwayWorld = getDoorwayWorldCenter(normalizedTileX, normalizedTileY);
      if (!doorwayWorld) {
        return;
      }
      const classified = runtime.classifyAreaAtWorld(doorwayWorld.x, doorwayWorld.y);
      if (classified?.isDoorwayTile !== true) {
        return;
      }
      if (
        typeof runtime?.isWalkableTile === "function" &&
        runtime.isWalkableTile(normalizedTileX, normalizedTileY) !== true
      ) {
        return;
      }
      doorwayByTileKey.set(tileKeyValue, {
        tileX: normalizedTileX,
        tileY: normalizedTileY,
        world: {
          x: doorwayWorld.x,
          y: doorwayWorld.y,
        },
        distanceTiles: Math.hypot(
          doorwayWorld.x - guestWorld.x,
          doorwayWorld.y - guestWorld.y
        ),
      });
    };

    for (const tile of roomData.tiles) {
      addDoorwayCandidate(tile?.x, tile?.y);
    }

    if (doorwayByTileKey.size === 0) {
      let minTileX = Infinity;
      let maxTileX = -Infinity;
      let minTileY = Infinity;
      let maxTileY = -Infinity;
      for (const tile of roomData.tiles) {
        const tileX = Math.floor(Number(tile?.x));
        const tileY = Math.floor(Number(tile?.y));
        if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
          continue;
        }
        minTileX = Math.min(minTileX, tileX);
        maxTileX = Math.max(maxTileX, tileX);
        minTileY = Math.min(minTileY, tileY);
        maxTileY = Math.max(maxTileY, tileY);
      }
      if (
        Number.isFinite(minTileX) &&
        Number.isFinite(maxTileX) &&
        Number.isFinite(minTileY) &&
        Number.isFinite(maxTileY)
      ) {
        for (let tileY = minTileY - 1; tileY <= maxTileY + 1; tileY += 1) {
          for (let tileX = minTileX - 1; tileX <= maxTileX + 1; tileX += 1) {
            const onPerimeter =
              tileX === minTileX - 1 ||
              tileX === maxTileX + 1 ||
              tileY === minTileY - 1 ||
              tileY === maxTileY + 1;
            if (!onPerimeter) {
              continue;
            }
            addDoorwayCandidate(tileX, tileY);
          }
        }
      }
    }

    return Array.from(doorwayByTileKey.values())
      .filter(
        (candidate) =>
          Number(candidate?.distanceTiles) > DOORWAY_TARGET_MIN_DISTANCE_TILES
      )
      .sort((a, b) => {
      const distanceDelta = (a.distanceTiles || 0) - (b.distanceTiles || 0);
      if (Math.abs(distanceDelta) > 0.000001) {
        return distanceDelta;
      }
      if (a.tileX !== b.tileX) {
        return a.tileX - b.tileX;
      }
      return a.tileY - b.tileY;
      });
  }

  function resolveDangerRoomEgressContext({ guestWorld, threatWorld }) {
    if (
      !Number.isFinite(guestWorld?.x) ||
      !Number.isFinite(guestWorld?.y) ||
      !Number.isFinite(threatWorld?.x) ||
      !Number.isFinite(threatWorld?.y) ||
      typeof runtime?.classifyAreaAtWorld !== "function"
    ) {
      return {
        applicable: false,
        guestArea: null,
        threatArea: null,
      };
    }
    const guestArea = runtime.classifyAreaAtWorld(guestWorld.x, guestWorld.y);
    const threatArea = runtime.classifyAreaAtWorld(threatWorld.x, threatWorld.y);
    const guestInRoom =
      guestArea?.inRoom === true || guestArea?.doorwayTreatedAsRoom === true;
    const guestAlreadyOnDoorway = guestArea?.isDoorwayTile === true;
    const threatInRoom =
      threatArea?.inRoom === true || threatArea?.doorwayTreatedAsRoom === true;
    return {
      applicable: guestInRoom && !guestAlreadyOnDoorway && threatInRoom,
      guestArea,
      threatArea,
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
    const zombieTargets = getGuestPerceptionTargets();
    const occupiedSubTileKeys = buildGuestOccupancyKeySet(guests, zombieTargets);
    const activeGuestIds = new Set(guests.map((entry) => entry.id));
    let changed = false;
    let fleeGuestCount = 0;
    let wanderGuestCount = 0;
    let shelterIntentGuestCount = 0;
    let dangerIntentGuestCount = 0;
    let wanderIntentGuestCount = 0;
    let replansAttempted = 0;
    let replansSucceeded = 0;
    let failedPlanCount = 0;

    for (const [humanId] of guestBehaviorById.entries()) {
      if (!activeGuestIds.has(humanId)) {
        guestBehaviorById.delete(humanId);
      }
    }
    for (const [humanId] of guestTileKnowledgeById.entries()) {
      if (!activeGuestIds.has(humanId)) {
        guestTileKnowledgeById.delete(humanId);
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
    for (const [humanId] of guestMentalPathFeedbackById.entries()) {
      if (!activeGuestIds.has(humanId)) {
        guestMentalPathFeedbackById.delete(humanId);
      }
    }

    const dt = Math.max(0, Number(dtSeconds) || 0);
    for (const guest of guests) {
      const controller = guest.controller;
      let mentalPathFeedback = {
        status: "none",
        reason: null,
      };
      if (
        typeof controller?.getCurrentWorldPosition !== "function" ||
        typeof controller?.getHeadingRadians !== "function" ||
        typeof controller?.getVisionCone !== "function" ||
        typeof controller?.setWorldPath !== "function" ||
        typeof controller?.hasWaypoint !== "function"
      ) {
        guestMentalPathFeedbackById.set(guest.id, mentalPathFeedback);
        continue;
      }
      const wanderState = getGuestWanderState(guest.id);
      decayGuestWanderState(wanderState, dt);
      if (applyGuestRecoveryHeading(controller, wanderState, dt)) {
        changed = true;
      }

      const perception = guestPerceptionById.get(guest.id) || null;
      const currentGuestWorld = controller.getCurrentWorldPosition();
      const hasLiveThreat =
        perception?.detected === true &&
        Number.isFinite(perception?.targetWorld?.x) &&
        Number.isFinite(perception?.targetWorld?.y);
      const rememberedThreatWorld = normalizeWorldPoint(
        guestDangerMemoryById.get(guest.id)?.lastKnownThreatWorld
      );
      const threatWorldForDanger = hasLiveThreat
        ? perception.targetWorld
        : Number.isFinite(rememberedThreatWorld?.x) &&
            Number.isFinite(rememberedThreatWorld?.y)
          ? rememberedThreatWorld
          : null;
      const hasDangerTarget =
        Number.isFinite(threatWorldForDanger?.x) &&
        Number.isFinite(threatWorldForDanger?.y);
      const roomDangerContextForMode = hasDangerTarget
        ? resolveDangerRoomEgressContext({
            guestWorld: currentGuestWorld,
            threatWorld: threatWorldForDanger,
          })
        : {
            applicable: false,
            guestArea: null,
            threatArea: null,
          };
      const mentalEvaluation =
        guestMentalStateById.get(guest.id)?.runtime?.lastEvaluationResult || null;
      const objectiveStateRawFromBrain =
        mentalEvaluation?.objectiveState ||
        mentalEvaluation?.dominantState ||
        "wander";
      const objectiveStateFromBrain =
        objectiveStateRawFromBrain === "danger" ||
        objectiveStateRawFromBrain === "shelter" ||
        objectiveStateRawFromBrain === "wander"
          ? objectiveStateRawFromBrain
          : "wander";
      const hasActiveDangerSource =
        String(perception?.dangerSource || "none") !== "none" || hasDangerTarget;
      const roomDangerOverrideActive =
        objectiveStateFromBrain !== "danger" &&
        roomDangerContextForMode.applicable === true &&
        hasActiveDangerSource;
      const objectiveState = roomDangerOverrideActive
        ? "danger"
        : objectiveStateFromBrain;
      if (objectiveState === "danger") {
        dangerIntentGuestCount += 1;
      } else if (objectiveState === "shelter") {
        shelterIntentGuestCount += 1;
      } else {
        wanderIntentGuestCount += 1;
      }
      const desiredMode = objectiveState === "danger" ? "flee" : "wander";
      const behavior = getGuestBehaviorState(guest.id);
      if (!guestDangerResponseDebugById.has(guest.id)) {
        guestDangerResponseDebugById.set(guest.id, {
          candidateCount: 0,
          selectedCandidateIndex: null,
          selectedScore: null,
          tieBreakUsed: false,
          failureReason: null,
        });
      }
      behavior.objectiveState = objectiveState;
      behavior.objectiveDispatchMode =
        objectiveState === "danger"
          ? behavior.lastPlanReason === "danger_room_egress_nearest_door"
            ? "danger_room_egress"
            : "danger_flee"
          : objectiveState === "shelter"
            ? "shelter_proxy_wander"
            : "wander";
      behavior.objectiveReasonCode = roomDangerOverrideActive
        ? "room_danger_override"
        : mentalEvaluation?.arbitrationReasonCode || null;
      behavior.objectiveFailureReason = null;
      behavior.objectiveTargetWorld = null;
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

      let forceDangerRoomEgressReplan = false;
      if (desiredMode === "flee" && hasDangerTarget) {
        forceDangerRoomEgressReplan =
          roomDangerContextForMode.applicable === true &&
          behavior.objectiveDispatchMode !== "danger_room_egress";
      }

      const hasActivePath = controller.hasWaypoint();
      const shouldReplanForFlee =
        modeChanged ||
        blockedEvent !== null ||
        !hasActivePath ||
        behavior.replanCooldownSeconds <= 0 ||
        forceDangerRoomEgressReplan;
      const shouldReplanForWander =
        modeChanged ||
        blockedEvent !== null ||
        !hasActivePath;

      if (desiredMode === "flee") {
        fleeGuestCount += 1;
      } else {
        wanderGuestCount += 1;
        guestDangerResponseDebugById.set(guest.id, {
          candidateCount: 0,
          selectedCandidateIndex: null,
          selectedScore: null,
          tieBreakUsed: false,
          failureReason: null,
        });
      }

      if (
        (desiredMode === "flee" && !shouldReplanForFlee) ||
        (desiredMode === "wander" && !shouldReplanForWander)
      ) {
        behavior.objectivePathStatus = hasActivePath ? "following_path" : "idle";
        guestMentalPathFeedbackById.set(guest.id, mentalPathFeedback);
        continue;
      }

      replansAttempted += 1;
      if (desiredMode === "flee" && !hasDangerTarget) {
        behavior.lastPlanReason = "danger_no_target";
        behavior.objectivePathStatus = "retrying";
        behavior.objectiveFailureReason = behavior.lastPlanReason;
        guestDangerResponseDebugById.set(guest.id, {
          candidateCount: 0,
          selectedCandidateIndex: null,
          selectedScore: null,
          tieBreakUsed: false,
          failureReason: behavior.lastPlanReason,
        });
        mentalPathFeedback = {
          status: "failure",
          reason: behavior.lastPlanReason,
        };
        failedPlanCount += 1;
        guestMentalPathFeedbackById.set(guest.id, mentalPathFeedback);
        continue;
      }
      if (desiredMode === "flee" && hasDangerTarget) {
        const guestWorld = currentGuestWorld;
        const threatWorld = threatWorldForDanger;
        const dangerRoomEgressContext = roomDangerContextForMode;
        behavior.objectiveTargetWorld = {
          x: threatWorld.x,
          y: threatWorld.y,
        };
        if (dangerRoomEgressContext.applicable === true) {
          const doorwayTargets = resolveRoomDoorwayTargetsForGuest(guestWorld);
          let selectedDoorwayTarget = null;
          let selectedDoorwayTargetIndex = null;
          let lastDoorwayFailureReason = null;
          for (let doorwayIndex = 0; doorwayIndex < doorwayTargets.length; doorwayIndex += 1) {
            const doorwayTarget = doorwayTargets[doorwayIndex];
            const assignment = assignGuestRasterPath(controller, doorwayTarget.world, {
              occupiedSubTileKeys,
            });
            if (!assignment.accepted) {
              lastDoorwayFailureReason = assignment.reason || "doorway_path_failed";
              continue;
            }
            selectedDoorwayTarget = doorwayTarget;
            selectedDoorwayTargetIndex = doorwayIndex;
            break;
          }
          if (selectedDoorwayTarget) {
            wanderState.noCandidateStreak = 0;
            wanderState.recoveryRemainingSeconds = 0;
            wanderState.repickCooldownRemainingSeconds = 0;
            behavior.objectiveDispatchMode = "danger_room_egress";
            behavior.objectiveTargetWorld = {
              x: selectedDoorwayTarget.world.x,
              y: selectedDoorwayTarget.world.y,
            };
            behavior.replanCooldownSeconds = guestFleeReplanSeconds;
            behavior.lastPlanReason = "danger_room_egress_nearest_door";
            behavior.objectivePathStatus = "valid";
            guestDangerResponseDebugById.set(guest.id, {
              candidateCount: doorwayTargets.length,
              selectedCandidateIndex: selectedDoorwayTargetIndex,
              selectedScore: null,
              tieBreakUsed: false,
              failureReason: null,
            });
            if (debugEnabled) {
              guestWaypointSelectionDebugById.set(guest.id, {
                reason: "danger_room_egress_nearest_door",
                attempts: doorwayTargets.length,
                candidates: doorwayTargets.map((doorwayTarget, doorwayIndex) => ({
                  x: doorwayTarget.world.x,
                  y: doorwayTarget.world.y,
                  status:
                    doorwayIndex === selectedDoorwayTargetIndex
                      ? "expanded_selected"
                      : "fallback_selected",
                })),
                candidateCount: doorwayTargets.length,
                candidateIndex: selectedDoorwayTargetIndex,
                tieBreakUsed: false,
                cooldownRemainingSeconds: 0,
                recoveryActive: false,
              });
            }
            mentalPathFeedback = {
              status: "success",
              reason: behavior.lastPlanReason,
            };
            replansSucceeded += 1;
            changed = true;
            guestMentalPathFeedbackById.set(guest.id, mentalPathFeedback);
            continue;
          }
          const roomEgressFailureReason =
            doorwayTargets.length <= 0
              ? "danger_room_egress_no_doorway"
              : lastDoorwayFailureReason || "danger_room_egress_path_failed";
          guestDangerResponseDebugById.set(guest.id, {
            candidateCount: doorwayTargets.length,
            selectedCandidateIndex: null,
            selectedScore: null,
            tieBreakUsed: false,
            failureReason: roomEgressFailureReason,
          });
        }
        const guestHeadingRadians = controller.getHeadingRadians();
        const fleeHeadingRadians = normalizeAngleRadians(
          Math.atan2(
            guestWorld.y - threatWorld.y,
            guestWorld.x - threatWorld.x
          )
        );
        const dangerCandidates = collectGuestDangerCandidates({
          guestWorld,
          fleeHeadingRadians,
          wanderState,
          visionCone: controller.getVisionCone(),
        });
        const dangerSelection = selectBestGuestDangerCandidate({
          guestWorld,
          threatWorld,
          candidates: dangerCandidates,
        });
        const selectedDangerCandidate = dangerSelection.selected;
        const debugSelection = selectedDangerCandidate?.plannerDebug || null;
        const fleeWaypoint = selectedDangerCandidate?.waypoint || null;
        const dangerResponseDebug = {
          candidateCount: dangerCandidates.length,
          selectedCandidateIndex: Number.isFinite(
            selectedDangerCandidate?.candidateIndex
          )
            ? selectedDangerCandidate.candidateIndex
            : null,
          selectedScore: Number.isFinite(selectedDangerCandidate?.weightedScore)
            ? selectedDangerCandidate.weightedScore
            : null,
          tieBreakUsed: dangerSelection.tieBreakUsed === true,
          failureReason: null,
        };
        if (fleeWaypoint) {
          const assignment = assignGuestRasterPath(controller, fleeWaypoint, {
            occupiedSubTileKeys,
          });
          if (assignment.accepted) {
            wanderState.noCandidateStreak = 0;
            wanderState.recoveryRemainingSeconds = 0;
            wanderState.repickCooldownRemainingSeconds = 0;
            if (debugEnabled) {
              guestWaypointSelectionDebugById.set(guest.id, {
                ...debugSelection,
                reason: debugSelection?.reason || "danger_scored_selected",
                wasTrimmed: assignment.pathResult?.wasTrimmed === true,
                blockedCell: assignment.pathResult?.blockedCell
                  ? { ...assignment.pathResult.blockedCell }
                  : null,
                pathNodeCount: assignment.pathResult?.pathWorld?.length || 0,
                candidateCount: dangerCandidates.length,
                candidateIndex: selectedDangerCandidate.candidateIndex,
                weightedScore: selectedDangerCandidate.weightedScore,
                separationGainScore: selectedDangerCandidate.separationGainScore,
                headingAwayScore: selectedDangerCandidate.headingAwayScore,
                losBreakScore: selectedDangerCandidate.losBreakScore,
                tieBreakUsed: dangerSelection.tieBreakUsed === true,
                cooldownRemainingSeconds: 0,
                recoveryActive: false,
              });
            }
            guestDangerResponseDebugById.set(guest.id, dangerResponseDebug);
            behavior.replanCooldownSeconds = guestFleeReplanSeconds;
            behavior.lastPlanReason = debugSelection?.reason || "danger_scored_selected";
            behavior.objectivePathStatus = "valid";
            mentalPathFeedback = {
              status: "success",
              reason: behavior.lastPlanReason,
            };
            replansSucceeded += 1;
            changed = true;
          } else {
            dangerResponseDebug.failureReason =
              assignment.reason || "rejected_by_controller";
            guestDangerResponseDebugById.set(guest.id, dangerResponseDebug);
            registerGuestWaypointFailure(
              guest.id,
              controller,
              wanderState,
              {
                ...buildControllerRejectedDebug({
                  debug: selectedDangerCandidate?.plannerDebug || null,
                }),
                reason: assignment.reason || "rejected_by_controller",
                wasTrimmed: assignment.pathResult?.wasTrimmed === true,
                blockedCell: assignment.pathResult?.blockedCell
                  ? { ...assignment.pathResult.blockedCell }
                  : null,
                candidateCount: dangerCandidates.length,
                candidateIndex: selectedDangerCandidate.candidateIndex,
                weightedScore: selectedDangerCandidate.weightedScore,
                separationGainScore: selectedDangerCandidate.separationGainScore,
                headingAwayScore: selectedDangerCandidate.headingAwayScore,
                losBreakScore: selectedDangerCandidate.losBreakScore,
                tieBreakUsed: dangerSelection.tieBreakUsed === true,
              }
            );
            behavior.replanCooldownSeconds = Math.min(guestFleeReplanSeconds, 0.18);
            behavior.lastPlanReason = assignment.reason || "rejected_by_controller";
            behavior.objectivePathStatus = "retrying";
            behavior.objectiveFailureReason = behavior.lastPlanReason;
            mentalPathFeedback = {
              status: "failure",
              reason: behavior.lastPlanReason,
            };
            failedPlanCount += 1;
          }
        } else {
          dangerResponseDebug.failureReason = "no_candidate_found";
          guestDangerResponseDebugById.set(guest.id, dangerResponseDebug);
          registerGuestWaypointFailure(guest.id, controller, wanderState, {
            ...(debugSelection || {}),
            reason: "no_candidate_found",
            candidateCount: dangerCandidates.length,
            tieBreakUsed: dangerSelection.tieBreakUsed === true,
          });
          behavior.replanCooldownSeconds = Math.min(guestFleeReplanSeconds, 0.18);
          behavior.lastPlanReason = "no_candidate_found";
          behavior.objectivePathStatus = "retrying";
          behavior.objectiveFailureReason = behavior.lastPlanReason;
          mentalPathFeedback = {
            status: "failure",
            reason: behavior.lastPlanReason,
          };
          failedPlanCount += 1;
        }
        guestMentalPathFeedbackById.set(guest.id, mentalPathFeedback);
        continue;
      }

      if (wanderState.repickCooldownRemainingSeconds > 0) {
        recordGuestRepickCooldownDebug(guest.id, wanderState);
        behavior.lastPlanReason = "repick_cooldown";
        behavior.objectivePathStatus = "retrying";
        behavior.objectiveFailureReason = behavior.lastPlanReason;
        guestMentalPathFeedbackById.set(guest.id, mentalPathFeedback);
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
        behavior.objectiveTargetWorld = {
          x: waypoint.x,
          y: waypoint.y,
        };
        const assignment = assignGuestRasterPath(controller, waypoint, {
          occupiedSubTileKeys,
        });
        if (assignment.accepted) {
          wanderState.noCandidateStreak = 0;
          wanderState.recoveryRemainingSeconds = 0;
          wanderState.repickCooldownRemainingSeconds = 0;
          if (debugEnabled) {
            guestWaypointSelectionDebugById.set(guest.id, {
              ...debugSelection,
              wasTrimmed: assignment.pathResult?.wasTrimmed === true,
              blockedCell: assignment.pathResult?.blockedCell
                ? { ...assignment.pathResult.blockedCell }
                : null,
              pathNodeCount: assignment.pathResult?.pathWorld?.length || 0,
              cooldownRemainingSeconds: 0,
              recoveryActive: false,
            });
          }
          behavior.lastPlanReason = debugSelection?.reason || "planned";
          behavior.objectivePathStatus = "valid";
          mentalPathFeedback = {
            status: "success",
            reason: behavior.lastPlanReason,
          };
          replansSucceeded += 1;
          changed = true;
        } else {
          registerGuestWaypointFailure(
            guest.id,
            controller,
            wanderState,
            {
              ...buildControllerRejectedDebug(selection),
              reason: assignment.reason || "rejected_by_controller",
              wasTrimmed: assignment.pathResult?.wasTrimmed === true,
              blockedCell: assignment.pathResult?.blockedCell
                ? { ...assignment.pathResult.blockedCell }
                : null,
            }
          );
          behavior.lastPlanReason = assignment.reason || "rejected_by_controller";
          behavior.objectivePathStatus = "retrying";
          behavior.objectiveFailureReason = behavior.lastPlanReason;
          mentalPathFeedback = {
            status: "failure",
            reason: behavior.lastPlanReason,
          };
          failedPlanCount += 1;
        }
      } else {
        registerGuestWaypointFailure(guest.id, controller, wanderState, {
          ...debugSelection,
        });
        behavior.lastPlanReason = debugSelection?.reason || "no_candidate_found";
        behavior.objectivePathStatus = "retrying";
        behavior.objectiveFailureReason = behavior.lastPlanReason;
        mentalPathFeedback = {
          status: "failure",
          reason: behavior.lastPlanReason,
        };
        failedPlanCount += 1;
      }
      guestMentalPathFeedbackById.set(guest.id, mentalPathFeedback);
    }

    if (recordCycle) {
      lastGuestBehaviorCycle = {
        enabled: true,
        guestCount: guests.length,
        fleeGuestCount,
        wanderGuestCount,
        shelterIntentGuestCount,
        dangerIntentGuestCount,
        wanderIntentGuestCount,
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
    if (runGuestMentalModelStep(dtSeconds, { recordCycle: true })) {
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

  function cloneGuestMentalEvaluation(evaluation) {
    if (!evaluation) {
      return null;
    }
    return {
      inputValues: { ...(evaluation.inputValues || {}) },
      rawScoresByState: { ...(evaluation.rawScoresByState || {}) },
      scoresByState: { ...(evaluation.scoresByState || {}) },
      enabledStateIds: Array.isArray(evaluation.enabledStateIds)
        ? [...evaluation.enabledStateIds]
        : [],
      disabledStateIds: Array.isArray(evaluation.disabledStateIds)
        ? [...evaluation.disabledStateIds]
        : [],
      dominantState: evaluation.dominantState ?? null,
      dominantScore: Number.isFinite(evaluation.dominantScore)
        ? evaluation.dominantScore
        : null,
      previousDominantState: evaluation.previousDominantState ?? null,
      dominantStateChanged: evaluation.dominantStateChanged === true,
      dominantStateHoldSeconds: Number.isFinite(evaluation.dominantStateHoldSeconds)
        ? evaluation.dominantStateHoldSeconds
        : 0,
      objectiveState: evaluation.objectiveState ?? null,
      previousObjectiveState: evaluation.previousObjectiveState ?? null,
      objectiveChanged: evaluation.objectiveChanged === true,
      objectiveTransitionReasonCode: evaluation.objectiveTransitionReasonCode || "none",
      objectiveHoldSeconds: Number.isFinite(evaluation.objectiveHoldSeconds)
        ? evaluation.objectiveHoldSeconds
        : 0,
      arbitrationReasonCode: evaluation.arbitrationReasonCode || null,
      holdLocked: evaluation.holdLocked === true,
      minimumHoldSeconds: Number.isFinite(evaluation.minimumHoldSeconds)
        ? evaluation.minimumHoldSeconds
        : 0,
      preemptionGate: evaluation.preemptionGate
        ? {
            candidateIsDanger: evaluation.preemptionGate.candidateIsDanger === true,
            threshold: Number.isFinite(evaluation.preemptionGate.threshold)
              ? evaluation.preemptionGate.threshold
              : 0,
            margin: Number.isFinite(evaluation.preemptionGate.margin)
              ? evaluation.preemptionGate.margin
              : 0,
            dangerScore: Number.isFinite(evaluation.preemptionGate.dangerScore)
              ? evaluation.preemptionGate.dangerScore
              : 0,
            currentScore: Number.isFinite(evaluation.preemptionGate.currentScore)
              ? evaluation.preemptionGate.currentScore
              : 0,
            marginValue: Number.isFinite(evaluation.preemptionGate.marginValue)
              ? evaluation.preemptionGate.marginValue
              : 0,
            thresholdMet: evaluation.preemptionGate.thresholdMet === true,
            marginMet: evaluation.preemptionGate.marginMet === true,
            allowed: evaluation.preemptionGate.allowed === true,
          }
        : null,
      fallback: evaluation.fallback
        ? {
            active: evaluation.fallback.active === true,
            applied: evaluation.fallback.applied === true,
            fallbackObjectiveState: evaluation.fallback.fallbackObjectiveState ?? null,
            pendingRetryObjectiveState:
              evaluation.fallback.pendingRetryObjectiveState ?? null,
            retryRemainingSeconds: Number.isFinite(
              evaluation.fallback.retryRemainingSeconds
            )
              ? evaluation.fallback.retryRemainingSeconds
              : 0,
            retryCount: Number.isFinite(evaluation.fallback.retryCount)
              ? evaluation.fallback.retryCount
              : 0,
            retryDelaySeconds: Number.isFinite(evaluation.fallback.retryDelaySeconds)
              ? evaluation.fallback.retryDelaySeconds
              : null,
            lastFailureReason: evaluation.fallback.lastFailureReason || null,
          }
        : null,
      pathFeedback: evaluation.pathFeedback
        ? {
            status: evaluation.pathFeedback.status || "none",
            reason: evaluation.pathFeedback.reason || null,
          }
        : {
            status: "none",
            reason: null,
          },
      dominantContributionTerms: Array.isArray(evaluation.dominantContributionTerms)
        ? evaluation.dominantContributionTerms.map((term) => ({
            termType: term?.termType === "bias" ? "bias" : "input",
            inputId: term?.inputId ?? null,
            weight: Number.isFinite(term?.weight) ? term.weight : null,
            inputValue: Number.isFinite(term?.inputValue) ? term.inputValue : null,
            contribution: Number.isFinite(term?.contribution) ? term.contribution : 0,
            absContribution: Number.isFinite(term?.absContribution)
              ? term.absContribution
              : Math.abs(Number(term?.contribution) || 0),
          }))
        : [],
      dominantTopContributions: Array.isArray(evaluation.dominantTopContributions)
        ? evaluation.dominantTopContributions.map((term) => ({
            termType: term?.termType === "bias" ? "bias" : "input",
            inputId: term?.inputId ?? null,
            weight: Number.isFinite(term?.weight) ? term.weight : null,
            inputValue: Number.isFinite(term?.inputValue) ? term.inputValue : null,
            contribution: Number.isFinite(term?.contribution) ? term.contribution : 0,
            absContribution: Number.isFinite(term?.absContribution)
              ? term.absContribution
              : Math.abs(Number(term?.contribution) || 0),
          }))
        : [],
      evaluationCount: Number.isFinite(evaluation.evaluationCount)
        ? evaluation.evaluationCount
        : 0,
    };
  }

  function cloneGuestMentalInputDebug(inputDebug) {
    if (!inputDebug) {
      return null;
    }
    return {
      hpNormalized: Number.isFinite(inputDebug.hpNormalized)
        ? inputDebug.hpNormalized
        : 0,
      inRoom: inputDebug.inRoom === true,
      inCorridor: inputDebug.inCorridor === true,
      doorwayTreatedAsRoom: inputDebug.doorwayTreatedAsRoom === true,
      isDoorwayTile: inputDebug.isDoorwayTile === true,
      areaClassification: inputDebug.areaClassification || "other",
      areaTile: Number.isFinite(inputDebug.areaTile) ? inputDebug.areaTile : null,
      areaTileX: Number.isFinite(inputDebug.areaTileX) ? inputDebug.areaTileX : null,
      areaTileY: Number.isFinite(inputDebug.areaTileY) ? inputDebug.areaTileY : null,
      areaRoomIndex: Number.isFinite(inputDebug.areaRoomIndex)
        ? inputDebug.areaRoomIndex
        : null,
      areaChunkX: Number.isFinite(inputDebug.areaChunkX) ? inputDebug.areaChunkX : null,
      areaChunkY: Number.isFinite(inputDebug.areaChunkY) ? inputDebug.areaChunkY : null,
      identifiedByMemory: inputDebug.identifiedByMemory === true,
      identifiedSourceLos: inputDebug.identifiedSourceLos === true,
      identifiedSourceRoomReveal: inputDebug.identifiedSourceRoomReveal === true,
      inactiveInputs: {
        danger_distance_signal:
          inputDebug?.inactiveInputs?.danger_distance_signal === true,
        thirst_signal: inputDebug?.inactiveInputs?.thirst_signal === true,
        hunger_signal: inputDebug?.inactiveInputs?.hunger_signal === true,
      },
    };
  }

  function cloneGuestMentalStateWeights(stateWeights) {
    if (!stateWeights || typeof stateWeights !== "object") {
      return {};
    }
    const clone = {};
    for (const [stateId, inputWeights] of Object.entries(stateWeights)) {
      if (!inputWeights || typeof inputWeights !== "object") {
        clone[stateId] = {};
        continue;
      }
      const row = {};
      for (const [inputId, weight] of Object.entries(inputWeights)) {
        row[inputId] = Number.isFinite(weight) ? Number(weight) : 0;
      }
      clone[stateId] = row;
    }
    return clone;
  }

  function cloneGuestMentalStateBias(stateBias) {
    if (!stateBias || typeof stateBias !== "object") {
      return {};
    }
    const clone = {};
    for (const [stateId, bias] of Object.entries(stateBias)) {
      clone[stateId] = Number.isFinite(bias) ? Number(bias) : 0;
    }
    return clone;
  }

  function buildGuestMentalDebugSnapshot(humanId) {
    if (!guestMentalModelEnabled) {
      return null;
    }
    const state = guestMentalStateById.get(humanId);
    if (!state || !state.runtime) {
      return null;
    }
    return {
      dominantState: state.runtime.lastDominantState ?? null,
      dominantStateHoldSeconds: Number.isFinite(state.runtime.dominantStateHoldSeconds)
        ? state.runtime.dominantStateHoldSeconds
        : 0,
      objectiveState: state.runtime.lastObjectiveState ?? null,
      objectiveHoldSeconds: Number.isFinite(state.runtime.objectiveHoldSeconds)
        ? state.runtime.objectiveHoldSeconds
        : 0,
      arbitrationReasonCode: state.runtime.lastArbitrationReasonCode || null,
      preemptionGate: state.runtime.lastPreemptionGate
        ? { ...state.runtime.lastPreemptionGate }
        : null,
      retryRemainingSeconds: Number.isFinite(state.runtime.retryRemainingSeconds)
        ? state.runtime.retryRemainingSeconds
        : 0,
      retryDelaySeconds: Number.isFinite(state.runtime.retryDelaySeconds)
        ? state.runtime.retryDelaySeconds
        : 0,
      pendingRetryObjectiveState: state.runtime.pendingRetryObjectiveState ?? null,
      retryCount: Number.isFinite(state.runtime.retryCount)
        ? state.runtime.retryCount
        : 0,
      lastObjectiveFailureReason: state.runtime.lastObjectiveFailureReason ?? null,
      evaluationCount: Number.isFinite(state.runtime.evaluationCount)
        ? state.runtime.evaluationCount
        : 0,
      evaluationCooldownSeconds: Number.isFinite(state.evaluationCooldownSeconds)
        ? state.evaluationCooldownSeconds
        : 0,
      inputDebug: cloneGuestMentalInputDebug(state.lastInputDebug),
      lastEvaluation: cloneGuestMentalEvaluation(state.runtime.lastEvaluationResult),
    };
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
      const guestBehaviorState =
        role === ROLE_GUEST ? guestBehaviorById.get(record.id) || null : null;
      const mergedDebug =
        role === ROLE_GUEST
          ? {
              ...(controllerDebug || {}),
              waypointSelection:
                guestWaypointSelectionDebugById.get(record.id) || null,
              objectiveIntent: guestBehaviorState
                ? {
                    objectiveState: guestBehaviorState.objectiveState || "wander",
                    objectiveDispatchMode:
                      guestBehaviorState.objectiveDispatchMode || "wander",
                    objectiveReasonCode: guestBehaviorState.objectiveReasonCode || null,
                    objectivePathStatus:
                      guestBehaviorState.objectivePathStatus || "idle",
                    objectiveFailureReason:
                      guestBehaviorState.objectiveFailureReason || null,
                    objectiveTargetWorld:
                      Number.isFinite(guestBehaviorState?.objectiveTargetWorld?.x) &&
                      Number.isFinite(guestBehaviorState?.objectiveTargetWorld?.y)
                        ? {
                            x: guestBehaviorState.objectiveTargetWorld.x,
                            y: guestBehaviorState.objectiveTargetWorld.y,
                          }
                        : null,
                  }
                : null,
              dangerResponse:
                guestDangerResponseDebugById.get(record.id) || {
                  candidateCount: 0,
                  selectedCandidateIndex: null,
                  selectedScore: null,
                  tieBreakUsed: false,
                  failureReason: null,
                },
              mentalModel: buildGuestMentalDebugSnapshot(record.id),
              dangerMemory: buildGuestDangerMemoryDebugSnapshot(
                record.id,
                record.controller
              ),
              tileKnowledge: (() => {
                const state = guestTileKnowledgeById.get(record.id);
                if (!state) {
                  return null;
                }
                return {
                  identifiedTileCount: state.identifiedTiles.size,
                  knownRoomCount: state.knownRoomKeys.size,
                  lastLosTileCount: state.lastLosTileKeys.size,
                  lastRoomRevealTileCount: state.lastRoomRevealTileKeys.size,
                  lastUpdatedAtMs: state.lastUpdatedAtMs,
                };
              })(),
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
      guestMentalModel: resolvedGuestMentalModelConfig
        ? {
            enabled: true,
            brainConfigVersion: resolvedGuestMentalModelConfig.brainConfigVersion,
            states: [...resolvedGuestMentalModelConfig.states],
            inputs: [...resolvedGuestMentalModelConfig.inputs],
            stateWeights: cloneGuestMentalStateWeights(
              resolvedGuestMentalModelConfig.stateWeights
            ),
            stateBias: cloneGuestMentalStateBias(
              resolvedGuestMentalModelConfig.stateBias
            ),
            disabledStates: [...resolvedGuestMentalModelConfig.disabledStates],
            tieBreakOrder: [...resolvedGuestMentalModelConfig.tieBreakOrder],
            minimumHoldSeconds: resolvedGuestMentalModelConfig.minimumHoldSeconds,
            dangerPreemption: { ...resolvedGuestMentalModelConfig.dangerPreemption },
            objectiveFailureFallback: {
              ...resolvedGuestMentalModelConfig.objectiveFailureFallback,
            },
            evaluationCadenceHz: resolvedGuestMentalModelConfig.evaluationCadenceHz,
            debugPanelRefreshHz: resolvedGuestMentalModelConfig.debugPanelRefreshHz,
            lastCycle: lastGuestMentalCycle ? { ...lastGuestMentalCycle } : null,
            byGuest: Array.from(guestMentalStateById.entries()).map(([id, state]) => ({
              id,
              dominantState: state?.runtime?.lastDominantState ?? null,
              dominantStateHoldSeconds: Number.isFinite(
                state?.runtime?.dominantStateHoldSeconds
              )
                ? state.runtime.dominantStateHoldSeconds
                : 0,
              evaluationCount: Number.isFinite(state?.runtime?.evaluationCount)
                ? state.runtime.evaluationCount
                : 0,
              evaluationCooldownSeconds: Number.isFinite(
                state?.evaluationCooldownSeconds
              )
                ? state.evaluationCooldownSeconds
                : 0,
              inputDebug: cloneGuestMentalInputDebug(state?.lastInputDebug),
              lastEvaluation: cloneGuestMentalEvaluation(
                state?.runtime?.lastEvaluationResult
              ),
            })),
          }
        : {
            enabled: false,
          },
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
          visibleTileCount: Number.isFinite(state.visibleTileCount)
            ? Math.max(0, Math.floor(state.visibleTileCount))
            : 0,
          dangerSignal: Number.isFinite(state.dangerSignal)
            ? state.dangerSignal
            : 0,
          dangerSource: state.dangerSource || "none",
        })),
      },
      guestDangerMemory: {
        enabled: true,
        config: { ...resolvedGuestDangerPolicy },
        lastCycle: lastGuestDangerMemoryCycle ? { ...lastGuestDangerMemoryCycle } : null,
        byGuest: Array.from(guestDangerMemoryById.entries()).map(([id, state]) => ({
          id,
          ...(getGuestDangerMemoryDebugSnapshot(
            state,
            scene.time?.now ?? performance.now(),
            resolvedGuestDangerPolicy,
            humansById.get(id)?.controller?.getCurrentWorldPosition?.()
          ) || {
            source: "none",
            hasLiveThreat: false,
            liveThreatId: null,
            liveThreatWorld: null,
            lastKnownThreatWorld: null,
            signalLive: 0,
            signalRemembered: 0,
            signalFinal: 0,
            memoryAgeSeconds: 0,
            expiresInSeconds: 0,
            expired: false,
          }),
        })),
      },
      guestBehavior: {
        enabled: true,
        lastCycle: lastGuestBehaviorCycle ? { ...lastGuestBehaviorCycle } : null,
        byGuest: Array.from(guestBehaviorById.entries()).map(([id, state]) => ({
          id,
          mode: state.mode || "wander",
          objectiveState: state.objectiveState || "wander",
          objectiveDispatchMode: state.objectiveDispatchMode || "wander",
          objectiveReasonCode: state.objectiveReasonCode || null,
          objectivePathStatus: state.objectivePathStatus || "idle",
          objectiveFailureReason: state.objectiveFailureReason || null,
          objectiveTargetWorld:
            Number.isFinite(state?.objectiveTargetWorld?.x) &&
            Number.isFinite(state?.objectiveTargetWorld?.y)
              ? {
                  x: state.objectiveTargetWorld.x,
                  y: state.objectiveTargetWorld.y,
                }
              : null,
          replanCooldownSeconds: Number.isFinite(state.replanCooldownSeconds)
            ? state.replanCooldownSeconds
            : 0,
          lastPlanReason: state.lastPlanReason || null,
          targetId: state.targetId ?? null,
          dangerResponse:
            guestDangerResponseDebugById.get(id) || {
              candidateCount: 0,
              selectedCandidateIndex: null,
              selectedScore: null,
              tieBreakUsed: false,
              failureReason: null,
            },
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

  function getGuestTileKnowledgeDebug(guestId, options = {}) {
    if (guestId == null) {
      return null;
    }
    return buildGuestTileKnowledgeDebug(guestId, options);
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
    guestDangerMemoryById.clear();
    guestBehaviorById.clear();
    guestTileKnowledgeById.clear();
    guestMentalPathFeedbackById.clear();
    guestWaypointSelectionDebugById.clear();
    guestDangerResponseDebugById.clear();
    guestWanderStateById.clear();
    guestMentalStateById.clear();
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
    getGuestTileKnowledgeDebug,
    reportGuestDamageDangerEvent,
    update,
    syncToView,
    destroy,
  };
}

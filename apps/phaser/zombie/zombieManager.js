import {
  createZombieController,
  ZOMBIE_COLLIDER_RADIUS_TILES,
  ZOMBIE_TEXTURE_KEY,
} from "./zombieController.js";
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

function isFiniteNumber(value) {
  return Number.isFinite(value);
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
  let nextZombieId = 1;
  let lastSpawnAttempt = null;
  const failedSectorHalfAngleRadians = (failedSectorHalfAngleDegrees * Math.PI) / 180;

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

  function getWanderState(zombieId) {
    let state = wanderStateById.get(zombieId);
    if (!state) {
      state = createInitialWanderState(zombieId);
      wanderStateById.set(zombieId, state);
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

  function spawnAtWorld(worldX, worldY) {
    if (!isFiniteNumber(worldX) || !isFiniteNumber(worldY)) {
      lastSpawnAttempt = {
        accepted: false,
        reason: "invalid_input",
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

    if (!isWalkableWorldPoint(runtime, spawnWorldX, spawnWorldY)) {
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
    });
    nextZombieId += 1;
    zombies.push(zombie);
    wanderStateById.set(zombie.getId(), createInitialWanderState(zombie.getId()));
    waypointSelectionDebugById.set(zombie.getId(), {
      reason: "spawned",
      attempts: 0,
      candidates: [],
    });
    const resolvedSpawn = zombie.getWorldPosition();
    lastSpawnAttempt = {
      accepted: true,
      reason: usedFallback ? "fallback_spawn" : "direct_spawn",
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
    for (const zombie of zombies) {
      const state = getWanderState(zombie.getId());
      decayWanderState(state, dtSeconds);
      if (applyRecoveryHeading(zombie, state, dtSeconds)) {
        changed = true;
      }
    }
    for (const zombie of zombies) {
      if (!zombie.hasWaypoint()) {
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
    for (const zombie of zombies) {
      if (!zombie.hasWaypoint()) {
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
    return {
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
      zombies: zombies.map((zombie) => {
        const debugState = zombie.getDebugState();
        const waypointSelection = waypointSelectionDebugById.get(zombie.getId()) || null;
        const wanderState = getWanderState(zombie.getId());
        return {
          ...debugState,
          waypointSelection,
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
      }),
    };
  }

  function destroy() {
    for (const zombie of zombies) {
      zombie.destroy();
    }
    zombies.length = 0;
    waypointSelectionDebugById.clear();
    wanderStateById.clear();
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

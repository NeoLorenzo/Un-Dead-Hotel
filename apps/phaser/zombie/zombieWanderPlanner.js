import { ZOMBIE_COLLIDER_RADIUS_TILES } from "./zombieController.js";

const DEFAULT_CANDIDATE_ATTEMPTS = 10;
const DEFAULT_CONTINUATION_ATTEMPTS = 6;
const DEFAULT_LINE_CHECK_STEP_TILES = 0.2;
const DEFAULT_CONE_CLIP_RAY_COUNT = 20;
const MIN_RAY_REACH_TILES = 0.04;
const DEFAULT_MIN_WAYPOINT_DISTANCE_TILES = Math.max(
  0.35,
  ZOMBIE_COLLIDER_RADIUS_TILES * 1.5
);

function clampFinite(value, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return value;
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

function isWalkableWorld(runtime, worldX, worldY) {
  if (typeof runtime.isWalkableWorldPoint === "function") {
    return runtime.isWalkableWorldPoint(worldX, worldY, ZOMBIE_COLLIDER_RADIUS_TILES);
  }
  if (typeof runtime.isWalkableWorldRect === "function") {
    return runtime.isWalkableWorldRect(
      worldX,
      worldY,
      ZOMBIE_COLLIDER_RADIUS_TILES,
      ZOMBIE_COLLIDER_RADIUS_TILES
    );
  }
  const tile = runtime.worldToTile(worldX, worldY);
  return runtime.isWalkableTile(tile.x, tile.y);
}

function hasClearLineOfSight(runtime, startWorld, endWorld, stepTiles) {
  const dx = endWorld.x - startWorld.x;
  const dy = endWorld.y - startWorld.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.000001) {
    return isWalkableWorld(runtime, endWorld.x, endWorld.y);
  }

  const safeStep = Math.max(0.01, clampFinite(stepTiles, DEFAULT_LINE_CHECK_STEP_TILES));
  const sampleCount = Math.max(1, Math.ceil(distance / safeStep));
  for (let i = 1; i <= sampleCount; i += 1) {
    const t = i / sampleCount;
    const sampleX = startWorld.x + dx * t;
    const sampleY = startWorld.y + dy * t;
    if (!isWalkableWorld(runtime, sampleX, sampleY)) {
      return false;
    }
  }
  return true;
}

function randomWaypointInCone(startWorld, headingRadians, coneAngleDegrees, coneRangeTiles) {
  const safeConeDegrees = Math.max(0, Number(coneAngleDegrees) || 0);
  const safeRange = Math.max(0, Number(coneRangeTiles) || 0);
  const halfAngleRadians = ((safeConeDegrees * Math.PI) / 180) * 0.5;
  const randomAngleOffset = (Math.random() * 2 - 1) * halfAngleRadians;
  const angle = headingRadians + randomAngleOffset;
  const distance = Math.random() * safeRange;
  return {
    x: startWorld.x + Math.cos(angle) * distance,
    y: startWorld.y + Math.sin(angle) * distance,
  };
}

function isAngleBlockedBySectors(angleRadians, blockedSectorsRadians) {
  if (!Array.isArray(blockedSectorsRadians) || blockedSectorsRadians.length === 0) {
    return false;
  }
  const normalizedAngle = normalizeAngleRadians(angleRadians);
  for (const sector of blockedSectorsRadians) {
    const centerRadians = normalizeAngleRadians(sector?.centerRadians || 0);
    const halfAngleRadians = Math.max(0, Number(sector?.halfAngleRadians) || 0);
    if (halfAngleRadians <= 0) {
      continue;
    }
    const delta = Math.abs(shortestAngleDeltaRadians(centerRadians, normalizedAngle));
    if (delta <= halfAngleRadians) {
      return true;
    }
  }
  return false;
}

function computeRayMaxReach(runtime, startWorld, angleRadians, maxRangeTiles, stepTiles) {
  const safeRange = Math.max(0, Number(maxRangeTiles) || 0);
  if (safeRange <= 0) {
    return 0;
  }
  const safeStep = Math.max(0.01, clampFinite(stepTiles, DEFAULT_LINE_CHECK_STEP_TILES));
  let lastWalkableDistance = 0;
  for (let distance = safeStep; distance <= safeRange + 0.000001; distance += safeStep) {
    const clampedDistance = Math.min(distance, safeRange);
    const sampleX = startWorld.x + Math.cos(angleRadians) * clampedDistance;
    const sampleY = startWorld.y + Math.sin(angleRadians) * clampedDistance;
    if (!isWalkableWorld(runtime, sampleX, sampleY)) {
      return lastWalkableDistance;
    }
    lastWalkableDistance = clampedDistance;
  }
  return lastWalkableDistance;
}

function buildClippedConeRaySamples(
  runtime,
  startWorld,
  headingRadians,
  coneAngleDegrees,
  coneRangeTiles,
  rayCount,
  blockedSectorsRadians,
  lineCheckStepTiles
) {
  const samples = [];
  const safeRayCount = Math.max(1, Math.floor(rayCount));
  const safeConeDegrees = Math.max(0, Number(coneAngleDegrees) || 0);
  const halfAngleRadians = ((safeConeDegrees * Math.PI) / 180) * 0.5;
  const startAngle = headingRadians - halfAngleRadians;
  const totalWidth = halfAngleRadians * 2;

  for (let i = 0; i < safeRayCount; i += 1) {
    const t = safeRayCount === 1 ? 0.5 : i / (safeRayCount - 1);
    const angleRadians = normalizeAngleRadians(startAngle + totalWidth * t);
    const blockedBySector = isAngleBlockedBySectors(angleRadians, blockedSectorsRadians);
    const maxReach = blockedBySector
      ? 0
      : computeRayMaxReach(
          runtime,
          startWorld,
          angleRadians,
          coneRangeTiles,
          lineCheckStepTiles
        );
    samples.push({
      angleRadians,
      blockedBySector,
      maxReach,
      endX: startWorld.x + Math.cos(angleRadians) * maxReach,
      endY: startWorld.y + Math.sin(angleRadians) * maxReach,
    });
  }

  return samples;
}

function pickRandomCandidateFromRaySamples(startWorld, raySamples) {
  const viable = Array.isArray(raySamples)
    ? raySamples.filter((ray) => !ray.blockedBySector && ray.maxReach > MIN_RAY_REACH_TILES)
    : [];
  if (viable.length === 0) {
    return null;
  }
  const ray = viable[Math.floor(Math.random() * viable.length)];
  const distance = Math.max(
    MIN_RAY_REACH_TILES,
    Math.random() * Math.max(MIN_RAY_REACH_TILES, ray.maxReach)
  );
  return {
    x: startWorld.x + Math.cos(ray.angleRadians) * distance,
    y: startWorld.y + Math.sin(ray.angleRadians) * distance,
    angleRadians: ray.angleRadians,
  };
}

export function createZombieWanderPlanner({
  runtime,
  candidateAttempts = DEFAULT_CANDIDATE_ATTEMPTS,
  continuationAttempts = DEFAULT_CONTINUATION_ATTEMPTS,
  lineCheckStepTiles = DEFAULT_LINE_CHECK_STEP_TILES,
  coneClipRayCount = DEFAULT_CONE_CLIP_RAY_COUNT,
  minWaypointDistanceTiles = DEFAULT_MIN_WAYPOINT_DISTANCE_TILES,
} = {}) {
  if (!runtime) {
    throw new Error("createZombieWanderPlanner requires runtime.");
  }

  const attempts = Math.max(1, Math.floor(candidateAttempts));
  const continuationAttemptLimit = Math.max(1, Math.floor(continuationAttempts));
  const rayCount = Math.max(1, Math.floor(coneClipRayCount));
  const minWaypointDistance = Math.max(
    MIN_RAY_REACH_TILES,
    clampFinite(minWaypointDistanceTiles, DEFAULT_MIN_WAYPOINT_DISTANCE_TILES)
  );

  function pickWaypointForZombie(zombieController, options = {}) {
    if (!zombieController) {
      return options.includeDebug
        ? {
            waypoint: null,
            debug: {
              reason: "invalid_zombie",
              attempts,
              candidates: [],
            },
          }
        : null;
    }

    const position = zombieController.getWorldPosition?.();
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      return options.includeDebug
        ? {
            waypoint: null,
            debug: {
              reason: "invalid_position",
              attempts,
              candidates: [],
            },
          }
        : null;
    }

    const headingRadians = clampFinite(zombieController.getHeadingRadians?.(), 0);
    const cone = zombieController.getVisionCone?.() || {
      angleDegrees: 90,
      rangeTiles: 8,
    };
    const includeDebug = Boolean(options.includeDebug);
    const blockedSectorsRadians = Array.isArray(options.blockedSectorsRadians)
      ? options.blockedSectorsRadians
      : [];
    const selectionRaySamples = buildClippedConeRaySamples(
      runtime,
      position,
      headingRadians,
      cone.angleDegrees,
      cone.rangeTiles,
      rayCount,
      blockedSectorsRadians,
      lineCheckStepTiles
    );
    const debugCandidates = [];
    const debugRaySamples = includeDebug
      ? selectionRaySamples.map((ray) => ({
          x: ray.endX,
          y: ray.endY,
          angleRadians: ray.angleRadians,
          maxReach: ray.maxReach,
          blockedBySector: ray.blockedBySector,
        }))
      : [];
    let fallbackCandidate = null;
    let fallbackScore = -Infinity;
    let fallbackIndex = -1;

    for (let i = 0; i < attempts; i += 1) {
      const candidate = pickRandomCandidateFromRaySamples(position, selectionRaySamples);
      if (!candidate) {
        break;
      }
      if (isAngleBlockedBySectors(candidate.angleRadians, blockedSectorsRadians)) {
        if (includeDebug) {
          debugCandidates.push({
            x: candidate.x,
            y: candidate.y,
            status: "failed_sector",
          });
        }
        continue;
      }
      const candidateDistance = Math.hypot(
        candidate.x - position.x,
        candidate.y - position.y
      );
      if (candidateDistance < minWaypointDistance) {
        if (includeDebug) {
          debugCandidates.push({
            x: candidate.x,
            y: candidate.y,
            status: "too_close",
          });
        }
        continue;
      }
      if (!isWalkableWorld(runtime, candidate.x, candidate.y)) {
        if (includeDebug) {
          debugCandidates.push({
            x: candidate.x,
            y: candidate.y,
            status: "blocked",
          });
        }
        continue;
      }
      if (!hasClearLineOfSight(runtime, position, candidate, lineCheckStepTiles)) {
        if (includeDebug) {
          debugCandidates.push({
            x: candidate.x,
            y: candidate.y,
            status: "los_blocked",
          });
        }
        continue;
      }

      const headingFromCandidate = Math.atan2(
        candidate.y - position.y,
        candidate.x - position.x
      );
      let hasContinuation = false;
      for (let j = 0; j < continuationAttemptLimit; j += 1) {
        const continuationRaySamples = buildClippedConeRaySamples(
          runtime,
          candidate,
          headingFromCandidate,
          cone.angleDegrees,
          cone.rangeTiles,
          rayCount,
          [],
          lineCheckStepTiles
        );
        const continuation = pickRandomCandidateFromRaySamples(
          candidate,
          continuationRaySamples
        );
        if (!continuation) {
          continue;
        }
        const continuationDistance = Math.hypot(
          continuation.x - candidate.x,
          continuation.y - candidate.y
        );
        if (continuationDistance < minWaypointDistance) {
          continue;
        }
        if (!isWalkableWorld(runtime, continuation.x, continuation.y)) {
          continue;
        }
        if (!hasClearLineOfSight(runtime, candidate, continuation, lineCheckStepTiles)) {
          continue;
        }
        hasContinuation = true;
        break;
      }

      if (!hasContinuation) {
        const score = Math.hypot(candidate.x - position.x, candidate.y - position.y);
        if (score > fallbackScore) {
          fallbackScore = score;
          fallbackCandidate = candidate;
          fallbackIndex = includeDebug ? debugCandidates.length : -1;
        }
        if (includeDebug) {
          debugCandidates.push({
            x: candidate.x,
            y: candidate.y,
            status: "no_continuation",
          });
        }
        continue;
      }

      if (includeDebug) {
        debugCandidates.push({
          x: candidate.x,
          y: candidate.y,
          status: "expanded_selected",
        });
        return {
          waypoint: candidate,
          debug: {
            reason: "expanded_selected",
            attempts,
            continuationAttempts: continuationAttemptLimit,
            rayCount,
            minWaypointDistance,
            raySamples: debugRaySamples,
            candidates: debugCandidates,
          },
        };
      }
      return candidate;
    }

    if (fallbackCandidate) {
      if (includeDebug) {
        if (
          Number.isInteger(fallbackIndex) &&
          fallbackIndex >= 0 &&
          fallbackIndex < debugCandidates.length
        ) {
          debugCandidates[fallbackIndex].status = "fallback_selected";
        }
        return {
          waypoint: fallbackCandidate,
          debug: {
            reason: "fallback_selected",
            attempts,
            continuationAttempts: continuationAttemptLimit,
            rayCount,
            minWaypointDistance,
            raySamples: debugRaySamples,
            candidates: debugCandidates,
          },
        };
      }
      return fallbackCandidate;
    }

    if (includeDebug) {
      return {
        waypoint: null,
        debug: {
          reason: "no_candidate_found",
          attempts,
          continuationAttempts: continuationAttemptLimit,
          rayCount,
          minWaypointDistance,
          raySamples: debugRaySamples,
          candidates: debugCandidates,
        },
      };
    }
    return null;
  }

  return {
    pickWaypointForZombie,
  };
}

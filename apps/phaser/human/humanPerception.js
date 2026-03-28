const DEFAULT_LINE_CHECK_STEP_TILES = 0.2;
const DEFAULT_LINE_CHECK_RADIUS_TILES = 0.29;
const DEFAULT_VISIBLE_TILE_BASE_RAY_COUNT = 36;

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

function isWalkableWorldPoint(runtime, worldX, worldY, lineCheckRadiusTiles) {
  if (typeof runtime.isWalkableWorldPoint === "function") {
    return runtime.isWalkableWorldPoint(worldX, worldY, lineCheckRadiusTiles);
  }
  const tile = runtime.worldToTile(worldX, worldY);
  return runtime.isWalkableTile(tile.x, tile.y);
}

function tileKey(tileX, tileY) {
  return `${tileX},${tileY}`;
}

function hasClearLineOfSight(
  runtime,
  startWorld,
  endWorld,
  lineCheckStepTiles,
  lineCheckRadiusTiles
) {
  const dx = endWorld.x - startWorld.x;
  const dy = endWorld.y - startWorld.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.000001) {
    return isWalkableWorldPoint(
      runtime,
      endWorld.x,
      endWorld.y,
      lineCheckRadiusTiles
    );
  }

  const sampleCount = Math.max(1, Math.ceil(distance / lineCheckStepTiles));
  for (let i = 1; i <= sampleCount; i += 1) {
    const t = i / sampleCount;
    const sampleX = startWorld.x + dx * t;
    const sampleY = startWorld.y + dy * t;
    if (!isWalkableWorldPoint(runtime, sampleX, sampleY, lineCheckRadiusTiles)) {
      return false;
    }
  }
  return true;
}

function isTargetInsideVisionCone({
  observerWorld,
  observerHeadingRadians,
  visionCone,
  targetWorld,
}) {
  const coneRangeTiles = Math.max(0, Number(visionCone?.rangeTiles) || 0);
  const coneHalfAngleRadians =
    ((Math.max(0, Number(visionCone?.angleDegrees) || 0) * Math.PI) / 180) * 0.5;

  const dx = targetWorld.x - observerWorld.x;
  const dy = targetWorld.y - observerWorld.y;
  const distance = Math.hypot(dx, dy);
  if (distance > coneRangeTiles) {
    return false;
  }
  if (distance <= 0.000001) {
    return true;
  }

  const angleToTarget = Math.atan2(dy, dx);
  const delta = Math.abs(
    shortestAngleDeltaRadians(observerHeadingRadians, angleToTarget)
  );
  return delta <= coneHalfAngleRadians;
}

function collectVisibleTiles({
  runtime,
  observerWorld,
  observerHeadingRadians,
  visionCone,
  lineCheckStepTiles,
  lineCheckRadiusTiles,
}) {
  const origin = normalizeWorldPoint(observerWorld);
  const heading = normalizeAngleRadians(observerHeadingRadians);
  const coneRangeTiles = Math.max(0, Number(visionCone?.rangeTiles) || 0);
  const coneAngleDegrees = Math.max(0, Number(visionCone?.angleDegrees) || 0);
  const coneHalfAngleRadians = ((coneAngleDegrees * Math.PI) / 180) * 0.5;
  const safeStep = Math.max(0.05, Number(lineCheckStepTiles) || DEFAULT_LINE_CHECK_STEP_TILES);
  const tileByKey = new Map();

  const originTile = runtime.worldToTile(origin.x, origin.y);
  if (Number.isFinite(originTile?.x) && Number.isFinite(originTile?.y)) {
    const normalizedTileX = Math.floor(originTile.x);
    const normalizedTileY = Math.floor(originTile.y);
    tileByKey.set(tileKey(normalizedTileX, normalizedTileY), {
      x: normalizedTileX,
      y: normalizedTileY,
    });
  }
  if (coneRangeTiles <= 0) {
    return [...tileByKey.values()];
  }

  const dynamicRayCount = Math.max(
    DEFAULT_VISIBLE_TILE_BASE_RAY_COUNT,
    Math.ceil(coneAngleDegrees * 0.8),
    Math.ceil((coneRangeTiles / safeStep) * 0.2)
  );
  const rayCount = Math.max(1, dynamicRayCount);
  const startAngle = heading - coneHalfAngleRadians;
  const totalAngle = coneHalfAngleRadians * 2;

  for (let rayIndex = 0; rayIndex < rayCount; rayIndex += 1) {
    const t = rayCount === 1 ? 0.5 : rayIndex / (rayCount - 1);
    const rayAngle = normalizeAngleRadians(startAngle + totalAngle * t);
    const dx = Math.cos(rayAngle);
    const dy = Math.sin(rayAngle);
    for (
      let distance = safeStep;
      distance <= coneRangeTiles + 0.000001;
      distance += safeStep
    ) {
      const clampedDistance = Math.min(distance, coneRangeTiles);
      const sampleX = origin.x + dx * clampedDistance;
      const sampleY = origin.y + dy * clampedDistance;
      const sampleTile = runtime.worldToTile(sampleX, sampleY);
      if (Number.isFinite(sampleTile?.x) && Number.isFinite(sampleTile?.y)) {
        const normalizedTileX = Math.floor(sampleTile.x);
        const normalizedTileY = Math.floor(sampleTile.y);
        tileByKey.set(tileKey(normalizedTileX, normalizedTileY), {
          x: normalizedTileX,
          y: normalizedTileY,
        });
      }
      if (
        !isWalkableWorldPoint(runtime, sampleX, sampleY, lineCheckRadiusTiles)
      ) {
        break;
      }
    }
  }

  return [...tileByKey.values()];
}

export function createHumanPerception({
  runtime,
  lineCheckStepTiles = DEFAULT_LINE_CHECK_STEP_TILES,
  lineCheckRadiusTiles = DEFAULT_LINE_CHECK_RADIUS_TILES,
} = {}) {
  if (!runtime) {
    throw new Error("createHumanPerception requires runtime.");
  }

  const resolvedLineCheckStepTiles = Math.max(
    0.05,
    Number(lineCheckStepTiles) || DEFAULT_LINE_CHECK_STEP_TILES
  );
  const resolvedLineCheckRadiusTiles = Math.max(
    0.01,
    Number(lineCheckRadiusTiles) || DEFAULT_LINE_CHECK_RADIUS_TILES
  );

  function evaluateVision({
    observerWorld,
    observerHeadingRadians,
    visionCone,
    targets,
  } = {}) {
    const origin = normalizeWorldPoint(observerWorld);
    const heading = normalizeAngleRadians(observerHeadingRadians);
    const list = Array.isArray(targets) ? targets : [];
    const visibleTiles = collectVisibleTiles({
      runtime,
      observerWorld: origin,
      observerHeadingRadians: heading,
      visionCone,
      lineCheckStepTiles: resolvedLineCheckStepTiles,
      lineCheckRadiusTiles: resolvedLineCheckRadiusTiles,
    });
    let inConeCount = 0;
    let lineOfSightClearCount = 0;
    let best = null;

    for (const rawTarget of list) {
      const id = rawTarget?.id;
      const targetWorld = normalizeWorldPoint(rawTarget?.world);
      if (
        (typeof id !== "string" && !Number.isFinite(id)) ||
        !isFiniteNumber(targetWorld.x) ||
        !isFiniteNumber(targetWorld.y)
      ) {
        continue;
      }
      if (
        typeof rawTarget?.isDead === "function" &&
        rawTarget.isDead() === true
      ) {
        continue;
      }

      const inCone = isTargetInsideVisionCone({
        observerWorld: origin,
        observerHeadingRadians: heading,
        visionCone,
        targetWorld,
      });
      if (!inCone) {
        continue;
      }
      inConeCount += 1;

      const clearLine = hasClearLineOfSight(
        runtime,
        origin,
        targetWorld,
        resolvedLineCheckStepTiles,
        resolvedLineCheckRadiusTiles
      );
      if (!clearLine) {
        continue;
      }
      lineOfSightClearCount += 1;

      const distance = Math.hypot(
        targetWorld.x - origin.x,
        targetWorld.y - origin.y
      );
      if (!best || distance < best.distance) {
        best = {
          id,
          world: {
            x: targetWorld.x,
            y: targetWorld.y,
          },
          distance,
        };
      }
    }

    return {
      detected: best !== null,
      nearestVisibleTarget: best,
      visibleTiles,
      stats: {
        candidateCount: list.length,
        inConeCount,
        lineOfSightClearCount,
        visibleTileCount: visibleTiles.length,
      },
    };
  }

  return {
    evaluateVision,
    getConfig: () => ({
      lineCheckStepTiles: resolvedLineCheckStepTiles,
      lineCheckRadiusTiles: resolvedLineCheckRadiusTiles,
    }),
  };
}

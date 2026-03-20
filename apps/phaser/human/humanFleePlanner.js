import { createSubTilePathfinder } from "../../../engine/world/subTilePathfinder.js";

const DEFAULT_AGENT_RADIUS_TILES = 0.29;
const DEFAULT_CELL_SIZE_TILES = 0.25;
const DEFAULT_MAX_PATH_NODES = 6000;
const DEFAULT_NAV_PADDING_TILES = 6;
const DEFAULT_FLEE_DISTANCE_TILES = 8;
const DEFAULT_WANDER_MIN_DISTANCE_TILES = 2;
const DEFAULT_WANDER_MAX_DISTANCE_TILES = 6;
const DEFAULT_GOAL_SEARCH_RADIUS_TILES = 2.5;

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

function dedupeWorldPath(path) {
  const out = [];
  let prev = null;
  for (const point of path) {
    const normalized = normalizeWorldPoint(point);
    if (
      prev &&
      Math.abs(prev.x - normalized.x) <= 0.000001 &&
      Math.abs(prev.y - normalized.y) <= 0.000001
    ) {
      continue;
    }
    out.push(normalized);
    prev = normalized;
  }
  return out;
}

function pathWithoutStart(path, startWorld) {
  if (!Array.isArray(path) || path.length === 0) {
    return [];
  }
  const out = [];
  for (const point of path) {
    const world = normalizeWorldPoint(point);
    if (
      Math.abs(world.x - startWorld.x) <= 0.000001 &&
      Math.abs(world.y - startWorld.y) <= 0.000001
    ) {
      continue;
    }
    out.push(world);
  }
  return out;
}

function resolveNearestNavigableWorldPoint(
  runtime,
  targetWorld,
  maxRadiusTiles,
  agentRadiusTiles,
  sampleStepTiles
) {
  if (runtime.isWalkableWorldPoint(targetWorld.x, targetWorld.y, agentRadiusTiles)) {
    return {
      world: { ...targetWorld },
      distance: 0,
    };
  }

  const radius = Math.max(0, Number(maxRadiusTiles) || 0);
  const step = Math.max(0.05, Number(sampleStepTiles) || 0.25);
  if (radius <= 0) {
    return null;
  }

  let best = null;
  const ringCount = Math.ceil(radius / step);
  for (let ring = 1; ring <= ringCount; ring += 1) {
    const r = ring * step;
    const minX = targetWorld.x - r;
    const maxX = targetWorld.x + r;
    const minY = targetWorld.y - r;
    const maxY = targetWorld.y + r;
    const samplesPerEdge = Math.max(2, Math.ceil((r * 2) / step));

    for (let i = 0; i <= samplesPerEdge; i += 1) {
      const t = i / samplesPerEdge;
      const edgeSamples = [
        { x: minX + (maxX - minX) * t, y: minY },
        { x: minX + (maxX - minX) * t, y: maxY },
        { x: minX, y: minY + (maxY - minY) * t },
        { x: maxX, y: minY + (maxY - minY) * t },
      ];
      for (const sample of edgeSamples) {
        if (!runtime.isWalkableWorldPoint(sample.x, sample.y, agentRadiusTiles)) {
          continue;
        }
        const distance = Math.hypot(sample.x - targetWorld.x, sample.y - targetWorld.y);
        if (!best || distance < best.distance) {
          best = {
            world: sample,
            distance,
          };
        }
      }
    }

    if (best) {
      return {
        world: { ...best.world },
        distance: best.distance,
      };
    }
  }

  return null;
}

export function createHumanFleePlanner({
  runtime,
  pathfinder = createSubTilePathfinder(),
  agentRadiusTiles = DEFAULT_AGENT_RADIUS_TILES,
  cellSizeTiles = DEFAULT_CELL_SIZE_TILES,
  maxPathNodes = DEFAULT_MAX_PATH_NODES,
  navPaddingTiles = DEFAULT_NAV_PADDING_TILES,
  fleeDistanceTiles = DEFAULT_FLEE_DISTANCE_TILES,
  wanderMinDistanceTiles = DEFAULT_WANDER_MIN_DISTANCE_TILES,
  wanderMaxDistanceTiles = DEFAULT_WANDER_MAX_DISTANCE_TILES,
  goalSearchRadiusTiles = DEFAULT_GOAL_SEARCH_RADIUS_TILES,
} = {}) {
  if (!runtime) {
    throw new Error("createHumanFleePlanner requires runtime.");
  }
  if (!pathfinder || typeof pathfinder.findPath !== "function") {
    throw new Error("createHumanFleePlanner requires pathfinder.findPath(...).");
  }
  if (typeof runtime.buildSubTileNavigationGrid !== "function") {
    throw new Error(
      "createHumanFleePlanner requires runtime.buildSubTileNavigationGrid(...)."
    );
  }

  const resolvedAgentRadiusTiles = Math.max(0.01, Number(agentRadiusTiles) || DEFAULT_AGENT_RADIUS_TILES);
  const resolvedCellSizeTiles = Math.max(0.05, Number(cellSizeTiles) || DEFAULT_CELL_SIZE_TILES);
  const resolvedMaxPathNodes = Math.max(1, Math.floor(Number(maxPathNodes) || DEFAULT_MAX_PATH_NODES));
  const resolvedNavPaddingTiles = Math.max(1, Number(navPaddingTiles) || DEFAULT_NAV_PADDING_TILES);
  const resolvedFleeDistanceTiles = Math.max(0.5, Number(fleeDistanceTiles) || DEFAULT_FLEE_DISTANCE_TILES);
  const resolvedWanderMinDistanceTiles = Math.max(
    0.2,
    Number(wanderMinDistanceTiles) || DEFAULT_WANDER_MIN_DISTANCE_TILES
  );
  const resolvedWanderMaxDistanceTiles = Math.max(
    resolvedWanderMinDistanceTiles,
    Number(wanderMaxDistanceTiles) || DEFAULT_WANDER_MAX_DISTANCE_TILES
  );
  const resolvedGoalSearchRadiusTiles = Math.max(
    0.2,
    Number(goalSearchRadiusTiles) || DEFAULT_GOAL_SEARCH_RADIUS_TILES
  );

  function computePath(startWorld, goalWorld) {
    const minWorldX = Math.min(startWorld.x, goalWorld.x) - resolvedNavPaddingTiles;
    const minWorldY = Math.min(startWorld.y, goalWorld.y) - resolvedNavPaddingTiles;
    const maxWorldX = Math.max(startWorld.x, goalWorld.x) + resolvedNavPaddingTiles;
    const maxWorldY = Math.max(startWorld.y, goalWorld.y) + resolvedNavPaddingTiles;
    const navigationGrid = runtime.buildSubTileNavigationGrid({
      minWorldX,
      minWorldY,
      maxWorldX,
      maxWorldY,
      cellSizeTiles: resolvedCellSizeTiles,
      agentRadiusTiles: resolvedAgentRadiusTiles,
    });
    const result = pathfinder.findPath({
      startWorld,
      goalWorld,
      navigationGrid,
      maxNodes: resolvedMaxPathNodes,
      includeDebug: false,
    });
    if (result?.status !== "found" || !Array.isArray(result.path)) {
      return {
        accepted: false,
        reason: result?.status || "no_path",
      };
    }
    const worldPath = dedupeWorldPath(pathWithoutStart(result.path, startWorld));
    if (worldPath.length === 0) {
      return {
        accepted: false,
        reason: "empty_path",
      };
    }
    return {
      accepted: true,
      pathWorld: worldPath,
      status: result.status,
    };
  }

  function tryGoalCandidate(startWorld, desiredGoalWorld) {
    const resolvedGoal = resolveNearestNavigableWorldPoint(
      runtime,
      desiredGoalWorld,
      resolvedGoalSearchRadiusTiles,
      resolvedAgentRadiusTiles,
      resolvedCellSizeTiles
    );
    if (!resolvedGoal) {
      return {
        accepted: false,
        reason: "goal_blocked",
      };
    }
    const pathResult = computePath(startWorld, resolvedGoal.world);
    if (!pathResult.accepted) {
      return pathResult;
    }
    return {
      accepted: true,
      pathWorld: pathResult.pathWorld,
      goalWorld: { ...resolvedGoal.world },
      status: pathResult.status,
    };
  }

  function planFleePath({ guestWorld, threatWorld, guestHeadingRadians = 0 } = {}) {
    const startWorld = normalizeWorldPoint(guestWorld);
    const threat = normalizeWorldPoint(threatWorld);
    const awayDx = startWorld.x - threat.x;
    const awayDy = startWorld.y - threat.y;
    const awayDistance = Math.hypot(awayDx, awayDy);
    const baseAngle =
      awayDistance > 0.000001
        ? Math.atan2(awayDy, awayDx)
        : normalizeAngleRadians(guestHeadingRadians + Math.PI);

    const angleOffsets = [0, 0.35, -0.35, 0.7, -0.7];
    const distanceScales = [1, 0.8, 0.6];
    let lastFailureReason = "no_path";

    for (const scale of distanceScales) {
      const distance = resolvedFleeDistanceTiles * scale;
      for (const offset of angleOffsets) {
        const angle = normalizeAngleRadians(baseAngle + offset);
        const desiredGoal = {
          x: startWorld.x + Math.cos(angle) * distance,
          y: startWorld.y + Math.sin(angle) * distance,
        };
        const attempt = tryGoalCandidate(startWorld, desiredGoal);
        if (attempt.accepted) {
          return {
            accepted: true,
            mode: "flee",
            ...attempt,
          };
        }
        lastFailureReason = attempt.reason || lastFailureReason;
      }
    }

    return {
      accepted: false,
      mode: "flee",
      reason: lastFailureReason,
    };
  }

  function planWanderPath({ guestWorld, guestHeadingRadians = 0 } = {}) {
    const startWorld = normalizeWorldPoint(guestWorld);
    let lastFailureReason = "no_path";
    const baseHeading = normalizeAngleRadians(guestHeadingRadians);
    const attempts = 10;

    for (let i = 0; i < attempts; i += 1) {
      const distanceLerp = Math.random();
      const distance =
        resolvedWanderMinDistanceTiles +
        (resolvedWanderMaxDistanceTiles - resolvedWanderMinDistanceTiles) * distanceLerp;
      const angleJitter = (Math.random() * 2 - 1) * Math.PI;
      const angle = normalizeAngleRadians(baseHeading + angleJitter);
      const desiredGoal = {
        x: startWorld.x + Math.cos(angle) * distance,
        y: startWorld.y + Math.sin(angle) * distance,
      };
      const attempt = tryGoalCandidate(startWorld, desiredGoal);
      if (attempt.accepted) {
        return {
          accepted: true,
          mode: "wander",
          ...attempt,
        };
      }
      lastFailureReason = attempt.reason || lastFailureReason;
    }

    return {
      accepted: false,
      mode: "wander",
      reason: lastFailureReason,
    };
  }

  return {
    planFleePath,
    planWanderPath,
    getConfig: () => ({
      agentRadiusTiles: resolvedAgentRadiusTiles,
      cellSizeTiles: resolvedCellSizeTiles,
      maxPathNodes: resolvedMaxPathNodes,
      navPaddingTiles: resolvedNavPaddingTiles,
      fleeDistanceTiles: resolvedFleeDistanceTiles,
      wanderMinDistanceTiles: resolvedWanderMinDistanceTiles,
      wanderMaxDistanceTiles: resolvedWanderMaxDistanceTiles,
      goalSearchRadiusTiles: resolvedGoalSearchRadiusTiles,
    }),
  };
}

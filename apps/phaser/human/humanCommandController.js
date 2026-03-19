const DEFAULT_MAX_PATH_NODES = 28000;
const DEFAULT_GOAL_SEARCH_RADIUS_TILES = 3;
const DEFAULT_MAX_COMMAND_DISTANCE_TILES = 180;
const DEFAULT_SUB_TILE_CELL_SIZE_TILES = 0.25;
const DEFAULT_NAV_GRID_PADDING_TILES = 4;
const DEFAULT_AGENT_RADIUS_TILES = 0.29;
const COMMAND_MIN_INTERVAL_SECONDS = 0.06;
const MARKER_TTL_SECONDS = 0.9;
const MARKER_GOOD_COLOR = 0x64ff8a;
const MARKER_BAD_COLOR = 0xff5f5f;
const MARKER_FILL_ALPHA = 0.18;
const MARKER_STROKE_ALPHA = 0.95;

function normalizeWorldPoint(point) {
  return {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
  };
}

function clampWorldGoalByDistance(startWorld, goalWorld, maxDistanceTiles) {
  const maxDistance = Math.max(1, Number(maxDistanceTiles) || 0);
  const dx = goalWorld.x - startWorld.x;
  const dy = goalWorld.y - startWorld.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= maxDistance) {
    return {
      world: { ...goalWorld },
      wasClamped: false,
      distance,
    };
  }

  const ratio = maxDistance / Math.max(distance, 0.000001);
  return {
    world: {
      x: startWorld.x + dx * ratio,
      y: startWorld.y + dy * ratio,
    },
    wasClamped: true,
    distance,
  };
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

export function createHumanCommandController({
  scene,
  runtime,
  humanController,
  pathfinder,
  maxPathNodes = DEFAULT_MAX_PATH_NODES,
  goalSearchRadiusTiles = DEFAULT_GOAL_SEARCH_RADIUS_TILES,
  maxCommandDistanceTiles = DEFAULT_MAX_COMMAND_DISTANCE_TILES,
  subTileCellSizeTiles = DEFAULT_SUB_TILE_CELL_SIZE_TILES,
  navGridPaddingTiles = DEFAULT_NAV_GRID_PADDING_TILES,
  agentRadiusTiles = DEFAULT_AGENT_RADIUS_TILES,
} = {}) {
  if (!scene || !runtime || !humanController || !pathfinder) {
    throw new Error(
      "createHumanCommandController requires scene, runtime, humanController, and pathfinder."
    );
  }
  if (typeof pathfinder.findPath !== "function") {
    throw new Error("createHumanCommandController requires pathfinder.findPath(...).");
  }
  if (typeof runtime.buildSubTileNavigationGrid !== "function") {
    throw new Error("createHumanCommandController requires runtime.buildSubTileNavigationGrid(...).");
  }

  const markerGraphics = scene.add.graphics();
  markerGraphics.setDepth(70);

  let lastGoalWorld = null;
  let repathAttemptUsed = false;
  let marker = null;
  let debugEnabled = false;
  let lastPathRequest = null;
  let lastPathResult = null;
  let lastWorldPath = [];
  let lastPathDebug = null;
  let commandCooldownRemaining = 0;
  let queuedGoalWorld = null;
  let lastGridSummary = null;

  function showMarker(goalWorld, accepted) {
    const world = normalizeWorldPoint(goalWorld);
    marker = {
      worldX: world.x,
      worldY: world.y,
      ttl: MARKER_TTL_SECONDS,
      accepted,
    };
  }

  function drawMarker({
    cameraTile,
    tilePixels,
    viewWidthPx,
    viewHeightPx,
  }) {
    markerGraphics.clear();
    if (!marker || marker.ttl <= 0) {
      return;
    }

    const screenX =
      (marker.worldX - cameraTile.x) * tilePixels + viewWidthPx * 0.5;
    const screenY =
      (marker.worldY - cameraTile.y) * tilePixels + viewHeightPx * 0.5;
    const baseRadius = Math.max(5, tilePixels * 0.38);
    const fade = Math.max(0, Math.min(1, marker.ttl / MARKER_TTL_SECONDS));
    const color = marker.accepted ? MARKER_GOOD_COLOR : MARKER_BAD_COLOR;

    markerGraphics.fillStyle(color, MARKER_FILL_ALPHA * fade);
    markerGraphics.fillCircle(Math.round(screenX), Math.round(screenY), Math.round(baseRadius));
    markerGraphics.lineStyle(2, color, MARKER_STROKE_ALPHA * fade);
    markerGraphics.strokeCircle(
      Math.round(screenX),
      Math.round(screenY),
      Math.round(baseRadius * (1.3 + (1 - fade) * 0.25))
    );
  }

  function computeAndAssignPath(goalWorld, allowNearestFallback = true) {
    const startWorld = humanController.getCurrentWorldPosition();
    const targetWorld = normalizeWorldPoint(goalWorld);
    const clampedTarget = clampWorldGoalByDistance(
      startWorld,
      targetWorld,
      maxCommandDistanceTiles
    );
    const effectiveTargetWorld = clampedTarget.world;
    const resolvedGoal = resolveNearestNavigableWorldPoint(
      runtime,
      effectiveTargetWorld,
      allowNearestFallback ? goalSearchRadiusTiles : 0,
      agentRadiusTiles,
      subTileCellSizeTiles
    );

    if (!resolvedGoal) {
      showMarker(effectiveTargetWorld, false);
      lastPathRequest = {
        startWorld: { ...startWorld },
        targetWorld: { ...targetWorld },
        effectiveTargetWorld: { ...effectiveTargetWorld },
        resolvedGoalWorld: null,
        wasGoalClamped: clampedTarget.wasClamped,
      };
      lastPathResult = {
        status: "goal_blocked",
        accepted: false,
      };
      lastWorldPath = [];
      lastPathDebug = null;
      lastGridSummary = null;
      return {
        accepted: false,
        reason: "goal_blocked",
      };
    }

    const minWorldX = Math.min(startWorld.x, resolvedGoal.world.x) - navGridPaddingTiles;
    const minWorldY = Math.min(startWorld.y, resolvedGoal.world.y) - navGridPaddingTiles;
    const maxWorldX = Math.max(startWorld.x, resolvedGoal.world.x) + navGridPaddingTiles;
    const maxWorldY = Math.max(startWorld.y, resolvedGoal.world.y) + navGridPaddingTiles;
    const navigationGrid = runtime.buildSubTileNavigationGrid({
      minWorldX,
      minWorldY,
      maxWorldX,
      maxWorldY,
      cellSizeTiles: subTileCellSizeTiles,
      agentRadiusTiles,
    });

    const result = pathfinder.findPath({
      startWorld,
      goalWorld: resolvedGoal.world,
      navigationGrid,
      maxNodes: maxPathNodes,
      includeDebug: debugEnabled,
    });

    lastPathRequest = {
      startWorld: { ...startWorld },
      targetWorld: { ...targetWorld },
      effectiveTargetWorld: { ...effectiveTargetWorld },
      resolvedGoalWorld: { ...resolvedGoal.world },
      wasGoalClamped: clampedTarget.wasClamped,
    };
    lastPathDebug = result.debug || null;
    lastGridSummary = {
      cellSizeTiles: navigationGrid.cellSizeTiles,
      cols: navigationGrid.cols,
      rows: navigationGrid.rows,
      originWorldX: navigationGrid.originWorldX,
      originWorldY: navigationGrid.originWorldY,
      endWorldX: navigationGrid.endWorldX,
      endWorldY: navigationGrid.endWorldY,
      walkableCount: navigationGrid.walkableCount,
      blockedCount: navigationGrid.blockedCount,
    };

    if (result.status !== "found" || !Array.isArray(result.path)) {
      showMarker(resolvedGoal.world, false);
      lastPathResult = {
        status: result.status || "no_path",
        accepted: false,
      };
      lastWorldPath = [];
      return {
        accepted: false,
        reason: result.status || "no_path",
      };
    }

    const worldPath = dedupeWorldPath(pathWithoutStart(result.path, startWorld));
    if (worldPath.length === 0) {
      humanController.clearPath();
    } else {
      humanController.setWorldPath(worldPath);
    }

    lastGoalWorld = { ...resolvedGoal.world };
    repathAttemptUsed = false;
    lastPathResult = {
      status: result.status,
      accepted: true,
    };
    lastWorldPath = worldPath.map((point) => ({ ...point }));
    showMarker(resolvedGoal.world, true);
    return {
      accepted: true,
      goalWorld: { ...resolvedGoal.world },
      pathLength: worldPath.length,
      status: result.status,
      wasGoalClamped: clampedTarget.wasClamped,
    };
  }

  function processMoveCommand(pointerWorldX, pointerWorldY) {
    if (!humanController.isSelected()) {
      return {
        accepted: false,
        reason: "not_selected",
      };
    }

    return computeAndAssignPath(
      {
        x: Number(pointerWorldX) || 0,
        y: Number(pointerWorldY) || 0,
      },
      true
    );
  }

  function issueMoveCommand(pointerWorldX, pointerWorldY) {
    if (!humanController.isSelected()) {
      return {
        accepted: false,
        reason: "not_selected",
      };
    }

    if (commandCooldownRemaining > 0) {
      queuedGoalWorld = {
        x: Number(pointerWorldX) || 0,
        y: Number(pointerWorldY) || 0,
      };
      return {
        accepted: true,
        queued: true,
      };
    }

    const result = processMoveCommand(pointerWorldX, pointerWorldY);
    commandCooldownRemaining = COMMAND_MIN_INTERVAL_SECONDS;
    return result;
  }

  function update(dtSeconds) {
    const dt = Number.isFinite(dtSeconds) ? Math.max(0, dtSeconds) : 0;
    let changed = false;

    if (commandCooldownRemaining > 0) {
      commandCooldownRemaining = Math.max(0, commandCooldownRemaining - dt);
    }
    if (queuedGoalWorld && commandCooldownRemaining <= 0) {
      const queued = queuedGoalWorld;
      queuedGoalWorld = null;
      const queuedResult = processMoveCommand(queued.x, queued.y);
      commandCooldownRemaining = COMMAND_MIN_INTERVAL_SECONDS;
      changed = changed || queuedResult.accepted;
    }

    if (marker && marker.ttl > 0) {
      marker.ttl = Math.max(0, marker.ttl - dt);
      changed = true;
    }

    const blockedEvent = humanController.consumePathBlockedEvent();
    if (blockedEvent && lastGoalWorld && !repathAttemptUsed) {
      repathAttemptUsed = true;
      const repathResult = computeAndAssignPath(lastGoalWorld, true);
      repathAttemptUsed = true;
      changed = changed || repathResult.accepted;
    }

    return changed;
  }

  function syncToView(viewState) {
    drawMarker(viewState);
  }

  function destroy() {
    markerGraphics.clear();
    markerGraphics.destroy();
  }

  function setDebugEnabled(enabled) {
    debugEnabled = Boolean(enabled);
  }

  function getDebugState() {
    return {
      debugEnabled,
      lastPathRequest: lastPathRequest
        ? {
            startWorld: { ...lastPathRequest.startWorld },
            targetWorld: { ...lastPathRequest.targetWorld },
            effectiveTargetWorld: lastPathRequest.effectiveTargetWorld
              ? { ...lastPathRequest.effectiveTargetWorld }
              : null,
            resolvedGoalWorld: lastPathRequest.resolvedGoalWorld
              ? { ...lastPathRequest.resolvedGoalWorld }
              : null,
            wasGoalClamped: lastPathRequest.wasGoalClamped === true,
          }
        : null,
      lastPathResult: lastPathResult ? { ...lastPathResult } : null,
      lastGoalWorld: lastGoalWorld ? { ...lastGoalWorld } : null,
      lastWorldPath: lastWorldPath.map((point) => ({ ...point })),
      lastPathDebug: lastPathDebug
        ? {
            ...lastPathDebug,
            visitedCells: Array.isArray(lastPathDebug.visitedCells)
              ? lastPathDebug.visitedCells.map((cell) => ({ ...cell }))
              : [],
          }
        : null,
      lastGridSummary: lastGridSummary ? { ...lastGridSummary } : null,
      commandCooldownRemaining,
      hasQueuedCommand: queuedGoalWorld !== null,
    };
  }

  return {
    issueMoveCommand,
    update,
    syncToView,
    setDebugEnabled,
    getDebugState,
    destroy,
  };
}

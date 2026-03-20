const DEFAULT_MAX_PATH_NODES = 28000;
const DEFAULT_GOAL_SEARCH_RADIUS_TILES = 3;
const DEFAULT_MAX_COMMAND_DISTANCE_TILES = 180;
const DEFAULT_SUB_TILE_CELL_SIZE_TILES = 0.25;
const DEFAULT_NAV_GRID_PADDING_TILES = 4;
const DEFAULT_NAV_PADDING_EXPANSION_FACTORS = [1, 2, 4, 8];
const DEFAULT_AGENT_RADIUS_TILES = 0.29;
const DEFAULT_START_UNSTICK_SEARCH_RADIUS_TILES = 2;
const DEFAULT_MAX_DYNAMIC_EXPANSION_ATTEMPTS = 12;
const DEFAULT_MAX_AUTO_PADDING_TILES = 4096;
const COMMAND_MIN_INTERVAL_SECONDS = 0.06;
const MARKER_TTL_SECONDS = 0.9;
const MARKER_GOOD_COLOR = 0x64ff8a;
const MARKER_BAD_COLOR = 0xff5f5f;
const MARKER_FILL_ALPHA = 0.18;
const MARKER_STROKE_ALPHA = 0.95;
const DEFAULT_GROUP_TILE_CLAIM_MAX_RADIUS = 24;

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

function worldToSubTileCell(worldPoint, cellSizeTiles) {
  const size = Math.max(0.05, Number(cellSizeTiles) || DEFAULT_SUB_TILE_CELL_SIZE_TILES);
  return {
    x: Math.floor(worldPoint.x / size),
    y: Math.floor(worldPoint.y / size),
  };
}

function subTileCellToWorldCenter(cellX, cellY, cellSizeTiles) {
  const size = Math.max(0.05, Number(cellSizeTiles) || DEFAULT_SUB_TILE_CELL_SIZE_TILES);
  return {
    x: (cellX + 0.5) * size,
    y: (cellY + 0.5) * size,
  };
}

function resolveNearestWalkableWorldOnNavigationGrid(
  navigationGrid,
  targetWorld,
  maxRadiusTiles
) {
  if (!navigationGrid) {
    return null;
  }
  if (
    typeof navigationGrid.isWalkableCell !== "function" ||
    typeof navigationGrid.worldToCell !== "function" ||
    typeof navigationGrid.cellToWorldCenter !== "function"
  ) {
    return null;
  }

  const normalizedTarget = normalizeWorldPoint(targetWorld);
  const cellSize = Math.max(
    0.05,
    Number(navigationGrid.cellSizeTiles) || DEFAULT_SUB_TILE_CELL_SIZE_TILES
  );
  const anchorCell = navigationGrid.worldToCell(normalizedTarget.x, normalizedTarget.y);
  if (navigationGrid.isWalkableCell(anchorCell.x, anchorCell.y)) {
    return {
      world: { ...normalizedTarget },
      distance: 0,
    };
  }

  const radiusTiles = Math.max(0, Number(maxRadiusTiles) || 0);
  const maxRadiusCells = Math.max(1, Math.ceil(radiusTiles / cellSize));
  let best = null;
  for (let radius = 1; radius <= maxRadiusCells; radius += 1) {
    const minX = anchorCell.x - radius;
    const maxX = anchorCell.x + radius;
    const minY = anchorCell.y - radius;
    const maxY = anchorCell.y + radius;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (
          Math.max(Math.abs(x - anchorCell.x), Math.abs(y - anchorCell.y)) !== radius
        ) {
          continue;
        }
        if (!navigationGrid.isWalkableCell(x, y)) {
          continue;
        }
        const world = navigationGrid.cellToWorldCenter(x, y);
        const distance = Math.hypot(
          world.x - normalizedTarget.x,
          world.y - normalizedTarget.y
        );
        if (!best || distance < best.distance) {
          best = {
            world: { x: world.x, y: world.y },
            distance,
          };
        }
      }
    }
    if (best) {
      return best;
    }
  }
  return null;
}

function normalizePositiveNumberArray(values, fallback) {
  const source = Array.isArray(values) ? values : fallback;
  const out = [];
  const seen = new Set();
  for (const value of source) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      continue;
    }
    const key = numeric.toString();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(numeric);
  }
  if (out.length === 0) {
    return [...fallback];
  }
  return out;
}

function buildConfiguredExpansionAttempts(basePaddingTiles, factors) {
  const basePadding = Math.max(0, Number(basePaddingTiles) || 0);
  const normalizedFactors = normalizePositiveNumberArray(
    factors,
    DEFAULT_NAV_PADDING_EXPANSION_FACTORS
  );
  const attempts = [];
  const seen = new Set();

  for (const factor of normalizedFactors) {
    const paddingTiles = basePadding > 0 ? basePadding * factor : factor;
    if (!Number.isFinite(paddingTiles) || paddingTiles <= 0) {
      continue;
    }
    const key = paddingTiles.toFixed(6);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    attempts.push({
      mode: "configured",
      paddingTiles,
      expansionFactor: factor,
    });
  }

  if (attempts.length === 0) {
    attempts.push({
      mode: "configured",
      paddingTiles: basePadding > 0 ? basePadding : 1,
      expansionFactor: basePadding > 0 ? 1 : null,
    });
  }

  return attempts;
}

function createCorridorBounds(startWorld, goalWorld) {
  return {
    minX: Math.min(startWorld.x, goalWorld.x),
    minY: Math.min(startWorld.y, goalWorld.y),
    maxX: Math.max(startWorld.x, goalWorld.x),
    maxY: Math.max(startWorld.y, goalWorld.y),
  };
}

function createBoundsFromPadding(corridorBounds, paddingTiles) {
  const padding = Math.max(0, Number(paddingTiles) || 0);
  return {
    minWorldX: corridorBounds.minX - padding,
    minWorldY: corridorBounds.minY - padding,
    maxWorldX: corridorBounds.maxX + padding,
    maxWorldY: corridorBounds.maxY + padding,
  };
}

function cloneBounds(bounds) {
  return {
    minWorldX: Number(bounds?.minWorldX) || 0,
    minWorldY: Number(bounds?.minWorldY) || 0,
    maxWorldX: Number(bounds?.maxWorldX) || 0,
    maxWorldY: Number(bounds?.maxWorldY) || 0,
  };
}

function boundsKey(bounds) {
  const normalized = cloneBounds(bounds);
  return [
    normalized.minWorldX.toFixed(6),
    normalized.minWorldY.toFixed(6),
    normalized.maxWorldX.toFixed(6),
    normalized.maxWorldY.toFixed(6),
  ].join("|");
}

function normalizeBoundaryHits(boundaryHits) {
  if (!boundaryHits) {
    return null;
  }
  const normalized = {
    minX: boundaryHits.minX === true,
    maxX: boundaryHits.maxX === true,
    minY: boundaryHits.minY === true,
    maxY: boundaryHits.maxY === true,
  };
  if (!normalized.minX && !normalized.maxX && !normalized.minY && !normalized.maxY) {
    return null;
  }
  return normalized;
}

function resolveBoundaryHits(result) {
  return normalizeBoundaryHits(
    result?.searchStats?.boundaryHits || result?.debug?.boundaryHits || null
  );
}

function computePaddingBySide(bounds, corridorBounds) {
  const normalizedBounds = cloneBounds(bounds);
  return {
    minX: Math.max(0, corridorBounds.minX - normalizedBounds.minWorldX),
    maxX: Math.max(0, normalizedBounds.maxWorldX - corridorBounds.maxX),
    minY: Math.max(0, corridorBounds.minY - normalizedBounds.minWorldY),
    maxY: Math.max(0, normalizedBounds.maxWorldY - corridorBounds.maxY),
  };
}

function maxPaddingFromSidePaddings(sidePaddings) {
  return Math.max(
    0,
    Number(sidePaddings?.minX) || 0,
    Number(sidePaddings?.maxX) || 0,
    Number(sidePaddings?.minY) || 0,
    Number(sidePaddings?.maxY) || 0
  );
}

function buildDirectionalExpansionAttempt({
  attempt,
  corridorBounds,
  boundaryHits,
  growStepTiles,
  maxPaddingTiles,
}) {
  const currentBounds = attempt?.bounds ? cloneBounds(attempt.bounds) : null;
  if (!currentBounds) {
    return null;
  }

  const stepTiles = Math.max(1, Number(growStepTiles) || 0);
  const paddingCap = Math.max(1, Number(maxPaddingTiles) || 1);
  const normalizedHits = normalizeBoundaryHits(boundaryHits) || {
    minX: true,
    maxX: true,
    minY: true,
    maxY: true,
  };
  const currentSidePaddings = computePaddingBySide(currentBounds, corridorBounds);

  function nextPadding(currentPadding, expandThisSide) {
    if (!expandThisSide) {
      return currentPadding;
    }
    const additive = currentPadding + stepTiles;
    const doubled = currentPadding > 0 ? currentPadding * 2 : stepTiles;
    return Math.min(paddingCap, Math.max(additive, doubled));
  }

  const nextSidePaddings = {
    minX: nextPadding(currentSidePaddings.minX, normalizedHits.minX),
    maxX: nextPadding(currentSidePaddings.maxX, normalizedHits.maxX),
    minY: nextPadding(currentSidePaddings.minY, normalizedHits.minY),
    maxY: nextPadding(currentSidePaddings.maxY, normalizedHits.maxY),
  };

  const noChange =
    Math.abs(nextSidePaddings.minX - currentSidePaddings.minX) <= 0.000001 &&
    Math.abs(nextSidePaddings.maxX - currentSidePaddings.maxX) <= 0.000001 &&
    Math.abs(nextSidePaddings.minY - currentSidePaddings.minY) <= 0.000001 &&
    Math.abs(nextSidePaddings.maxY - currentSidePaddings.maxY) <= 0.000001;
  if (noChange) {
    return null;
  }

  const nextBounds = {
    minWorldX: corridorBounds.minX - nextSidePaddings.minX,
    maxWorldX: corridorBounds.maxX + nextSidePaddings.maxX,
    minWorldY: corridorBounds.minY - nextSidePaddings.minY,
    maxWorldY: corridorBounds.maxY + nextSidePaddings.maxY,
  };

  return {
    mode: "auto_directional",
    expansionFactor: null,
    paddingTiles: maxPaddingFromSidePaddings(nextSidePaddings),
    bounds: nextBounds,
    paddedSides: normalizedHits,
  };
}

function resultDomainClipped(result) {
  if (!result) {
    return false;
  }
  if (result.searchStats?.domainClipped === true) {
    return true;
  }
  if (result.debug?.domainClipped === true) {
    return true;
  }
  return false;
}

function resultTouchedBoundary(result) {
  if (!result) {
    return false;
  }
  if (result.searchStats?.touchedBoundary === true) {
    return true;
  }
  if (result.debug?.touchedBoundary === true) {
    return true;
  }
  const hits = resolveBoundaryHits(result);
  return hits !== null;
}

export function createHumanCommandController({
  scene,
  runtime,
  humanController = null,
  getSelectedHumanControllers = null,
  pathfinder,
  maxPathNodes = DEFAULT_MAX_PATH_NODES,
  goalSearchRadiusTiles = DEFAULT_GOAL_SEARCH_RADIUS_TILES,
  maxCommandDistanceTiles = DEFAULT_MAX_COMMAND_DISTANCE_TILES,
  subTileCellSizeTiles = DEFAULT_SUB_TILE_CELL_SIZE_TILES,
  navGridPaddingTiles = DEFAULT_NAV_GRID_PADDING_TILES,
  navPaddingExpansionFactors = DEFAULT_NAV_PADDING_EXPANSION_FACTORS,
  agentRadiusTiles = DEFAULT_AGENT_RADIUS_TILES,
  startUnstickSearchRadiusTiles = DEFAULT_START_UNSTICK_SEARCH_RADIUS_TILES,
  maxDynamicExpansionAttempts = DEFAULT_MAX_DYNAMIC_EXPANSION_ATTEMPTS,
  maxAutoPaddingTiles = DEFAULT_MAX_AUTO_PADDING_TILES,
  groupTileClaimMaxRadius = DEFAULT_GROUP_TILE_CLAIM_MAX_RADIUS,
} = {}) {
  if (!scene || !runtime || !pathfinder) {
    throw new Error(
      "createHumanCommandController requires scene, runtime, and pathfinder."
    );
  }
  if (!humanController && typeof getSelectedHumanControllers !== "function") {
    throw new Error(
      "createHumanCommandController requires humanController or getSelectedHumanControllers."
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
  const paddingExpansionFactors = normalizePositiveNumberArray(
    navPaddingExpansionFactors,
    DEFAULT_NAV_PADDING_EXPANSION_FACTORS
  );

  const lastGoalWorldByController = new Map();
  const repathAttemptUsedByController = new Map();
  let marker = null;
  let debugEnabled = false;
  let lastPathRequest = null;
  let lastPathResult = null;
  let lastWorldPath = [];
  let lastPathDebug = null;
  let commandCooldownRemaining = 0;
  let queuedGoalWorld = null;
  let lastGridSummary = null;
  let lastCommandSummary = null;

  function canAcceptCommands(controller) {
    if (!controller) {
      return false;
    }
    if (typeof controller.isDead === "function" && controller.isDead()) {
      return false;
    }
    if (typeof controller.isSelectable === "function" && !controller.isSelectable()) {
      return false;
    }
    return true;
  }

  function getSelectedControllers() {
    if (typeof getSelectedHumanControllers === "function") {
      const source = getSelectedHumanControllers();
      if (!Array.isArray(source)) {
        return [];
      }
      const out = [];
      const seen = new Set();
      for (const controller of source) {
        if (!controller || seen.has(controller)) {
          continue;
        }
        seen.add(controller);
        if (!canAcceptCommands(controller)) {
          continue;
        }
        out.push(controller);
      }
      return out;
    }
    if (!humanController) {
      return [];
    }
    if (!canAcceptCommands(humanController)) {
      return [];
    }
    if (
      typeof humanController.isSelected === "function" &&
      !humanController.isSelected()
    ) {
      return [];
    }
    return [humanController];
  }

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

  function computeAndAssignPath(
    controller,
    goalWorld,
    allowNearestFallback = true,
    { suppressMarker = false } = {}
  ) {
    const currentWorld = controller.getCurrentWorldPosition();
    const currentWalkable =
      typeof runtime.isWalkableWorldPoint === "function"
        ? runtime.isWalkableWorldPoint(
            currentWorld.x,
            currentWorld.y,
            agentRadiusTiles
          )
        : (() => {
            const tile = runtime.worldToTile(currentWorld.x, currentWorld.y);
            return runtime.isWalkableTile(tile.x, tile.y);
          })();
    const resolvedStart =
      currentWalkable
        ? {
            world: { ...currentWorld },
            distance: 0,
          }
        : resolveNearestNavigableWorldPoint(
            runtime,
            currentWorld,
            Math.max(
              Number(startUnstickSearchRadiusTiles) || 0,
              Number(subTileCellSizeTiles) || DEFAULT_SUB_TILE_CELL_SIZE_TILES
            ),
            agentRadiusTiles,
            subTileCellSizeTiles
          );
    if (!resolvedStart) {
      if (!suppressMarker) {
        showMarker(goalWorld, false);
      }
      lastPathRequest = {
        startWorld: { ...currentWorld },
        resolvedStartWorld: null,
        targetWorld: null,
        effectiveTargetWorld: null,
        resolvedGoalWorld: null,
        wasGoalClamped: false,
        wasStartAdjusted: false,
      };
      lastPathResult = {
        status: "start_blocked",
        accepted: false,
      };
      lastWorldPath = [];
      lastPathDebug = null;
      lastGridSummary = null;
      return {
        accepted: false,
        reason: "start_blocked",
      };
    }
    const startWorld = resolvedStart.world;
    let wasStartAdjusted = resolvedStart.distance > 0.000001;
    let selectedResolvedStartWorld = {
      x: startWorld.x,
      y: startWorld.y,
    };
    const targetWorld = normalizeWorldPoint(goalWorld);
    const clampedTarget = clampWorldGoalByDistance(
      currentWorld,
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
      if (!suppressMarker) {
        showMarker(effectiveTargetWorld, false);
      }
      lastPathRequest = {
        startWorld: { ...currentWorld },
        resolvedStartWorld: { ...startWorld },
        targetWorld: { ...targetWorld },
        effectiveTargetWorld: { ...effectiveTargetWorld },
        resolvedGoalWorld: null,
        wasGoalClamped: clampedTarget.wasClamped,
        wasStartAdjusted,
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

    const basePaddingTiles = Math.max(0, Number(navGridPaddingTiles) || 0);
    const corridorBounds = createCorridorBounds(startWorld, resolvedGoal.world);
    const paddedAttemptQueue = buildConfiguredExpansionAttempts(basePaddingTiles, paddingExpansionFactors)
      .map((attempt) => ({
        ...attempt,
        bounds: createBoundsFromPadding(corridorBounds, attempt.paddingTiles),
        paddedSides: {
          minX: true,
          maxX: true,
          minY: true,
          maxY: true,
        },
      }));
    const attemptedBounds = new Set(paddedAttemptQueue.map((attempt) => boundsKey(attempt.bounds)));
    const maxAutoAttempts = Math.max(0, Math.floor(Number(maxDynamicExpansionAttempts) || 0));
    const autoPaddingCap = Math.max(1, Number(maxAutoPaddingTiles) || DEFAULT_MAX_AUTO_PADDING_TILES);

    let autoExpansionAttemptsUsed = 0;
    let selectedResult = null;
    let selectedGrid = null;
    let selectedPaddingTiles = paddedAttemptQueue[0]?.paddingTiles || (basePaddingTiles || 1);
    let selectedExpansionFactor = paddedAttemptQueue[0]?.expansionFactor ?? null;
    let selectedExpansionMode = paddedAttemptQueue[0]?.mode || "configured";
    let selectedBounds = paddedAttemptQueue[0]?.bounds ? cloneBounds(paddedAttemptQueue[0].bounds) : null;
    const expansionAttempts = [];

    for (let attemptIndex = 0; attemptIndex < paddedAttemptQueue.length; attemptIndex += 1) {
      const attempt = paddedAttemptQueue[attemptIndex];
      const attemptBounds = attempt.bounds
        ? cloneBounds(attempt.bounds)
        : createBoundsFromPadding(corridorBounds, attempt.paddingTiles);
      const attemptPaddingTiles = Number.isFinite(attempt.paddingTiles)
        ? Math.max(0, attempt.paddingTiles)
        : maxPaddingFromSidePaddings(computePaddingBySide(attemptBounds, corridorBounds));
      const navigationGrid = runtime.buildSubTileNavigationGrid({
        minWorldX: attemptBounds.minWorldX,
        minWorldY: attemptBounds.minWorldY,
        maxWorldX: attemptBounds.maxWorldX,
        maxWorldY: attemptBounds.maxWorldY,
        cellSizeTiles: subTileCellSizeTiles,
        agentRadiusTiles,
      });

      const startWalkableOnGrid =
        typeof navigationGrid.isWalkableWorld === "function"
          ? navigationGrid.isWalkableWorld(startWorld.x, startWorld.y)
          : (() => {
              const cell = navigationGrid.worldToCell(startWorld.x, startWorld.y);
              return navigationGrid.isWalkableCell(cell.x, cell.y);
            })();
      const gridStartResolution = startWalkableOnGrid
        ? {
            world: { ...startWorld },
            distance: 0,
          }
        : resolveNearestWalkableWorldOnNavigationGrid(
            navigationGrid,
            startWorld,
            Math.max(
              Number(startUnstickSearchRadiusTiles) || 0,
              Number(attemptPaddingTiles) || 0
            )
          );
      const attemptStartWorld = gridStartResolution?.world
        ? {
            x: gridStartResolution.world.x,
            y: gridStartResolution.world.y,
          }
        : {
            x: startWorld.x,
            y: startWorld.y,
          };
      const attemptStartAdjusted =
        Number(gridStartResolution?.distance) > 0.000001;

      const result = pathfinder.findPath({
        startWorld: attemptStartWorld,
        goalWorld: resolvedGoal.world,
        navigationGrid,
        maxNodes: maxPathNodes,
        includeDebug: debugEnabled,
      });

      expansionAttempts.push({
        expansionMode: attempt.mode,
        expansionFactor: attempt.expansionFactor,
        paddingTiles: attemptPaddingTiles,
        status: result.status || "no_path",
        domainClipped: resultDomainClipped(result),
        touchedBoundary: result.searchStats?.touchedBoundary === true,
        boundaryHits: resolveBoundaryHits(result),
        paddedSides: attempt.paddedSides ? { ...attempt.paddedSides } : null,
        bounds: cloneBounds(attemptBounds),
        cols: navigationGrid.cols,
        rows: navigationGrid.rows,
        cellCount: navigationGrid.cols * navigationGrid.rows,
        walkableCount: navigationGrid.walkableCount,
        blockedCount: navigationGrid.blockedCount,
        startAdjustedForGrid: attemptStartAdjusted,
      });

      selectedResult = result;
      selectedGrid = navigationGrid;
      selectedPaddingTiles = attemptPaddingTiles;
      selectedExpansionFactor = attempt.expansionFactor ?? null;
      selectedExpansionMode = attempt.mode;
      selectedBounds = cloneBounds(attemptBounds);
      selectedResolvedStartWorld = {
        x: attemptStartWorld.x,
        y: attemptStartWorld.y,
      };
      wasStartAdjusted = wasStartAdjusted || attemptStartAdjusted;

      if (result.status === "found" && Array.isArray(result.path)) {
        break;
      }
      const shouldAutoExpand =
        (result.status === "no_path" && resultDomainClipped(result)) ||
        (result.status === "budget_exceeded" && resultTouchedBoundary(result));
      if (shouldAutoExpand) {
        if (autoExpansionAttemptsUsed >= maxAutoAttempts) {
          if (result.status === "budget_exceeded") {
            break;
          }
          continue;
        }
        const nextAttempt = buildDirectionalExpansionAttempt({
          attempt: {
            ...attempt,
            bounds: attemptBounds,
          },
          corridorBounds,
          boundaryHits: resolveBoundaryHits(result),
          growStepTiles: Math.max(1, basePaddingTiles || attemptPaddingTiles || 1),
          maxPaddingTiles: autoPaddingCap,
        });
        if (!nextAttempt) {
          continue;
        }
        const nextKey = boundsKey(nextAttempt.bounds);
        if (attemptedBounds.has(nextKey)) {
          continue;
        }
        attemptedBounds.add(nextKey);
        paddedAttemptQueue.push(nextAttempt);
        autoExpansionAttemptsUsed += 1;
        continue;
      }

      if (result.status === "budget_exceeded") {
        break;
      }
    }

    lastPathRequest = {
      startWorld: { ...currentWorld },
      resolvedStartWorld: { ...selectedResolvedStartWorld },
      targetWorld: { ...targetWorld },
      effectiveTargetWorld: { ...effectiveTargetWorld },
      resolvedGoalWorld: { ...resolvedGoal.world },
      wasGoalClamped: clampedTarget.wasClamped,
      wasStartAdjusted,
    };
    lastPathDebug = selectedResult?.debug || null;
    lastGridSummary = selectedGrid
      ? {
          cellSizeTiles: selectedGrid.cellSizeTiles,
          cols: selectedGrid.cols,
          rows: selectedGrid.rows,
          originWorldX: selectedGrid.originWorldX,
          originWorldY: selectedGrid.originWorldY,
          endWorldX: selectedGrid.endWorldX,
          endWorldY: selectedGrid.endWorldY,
          walkableCount: selectedGrid.walkableCount,
          blockedCount: selectedGrid.blockedCount,
          paddingTilesUsed: selectedPaddingTiles,
          expansionFactorUsed: selectedExpansionFactor,
          expansionModeUsed: selectedExpansionMode,
          boundsUsed: selectedBounds ? cloneBounds(selectedBounds) : null,
          autoExpansionAttemptsUsed,
          maxDynamicExpansionAttempts: maxAutoAttempts,
          maxAutoPaddingTiles: autoPaddingCap,
          expansionAttemptCount: expansionAttempts.length,
          expansionAttempts,
        }
      : null;

    if (selectedResult?.status !== "found" || !Array.isArray(selectedResult?.path)) {
      const recoveryDistance = Math.hypot(
        selectedResolvedStartWorld.x - currentWorld.x,
        selectedResolvedStartWorld.y - currentWorld.y
      );
      const canRunRecoveryOnly =
        recoveryDistance > 0.000001 &&
        (typeof runtime.isWalkableWorldPoint !== "function" ||
          runtime.isWalkableWorldPoint(
            selectedResolvedStartWorld.x,
            selectedResolvedStartWorld.y,
            agentRadiusTiles
          ));
      if (canRunRecoveryOnly) {
        controller.setWorldPath([
          {
            x: selectedResolvedStartWorld.x,
            y: selectedResolvedStartWorld.y,
          },
        ]);
        lastGoalWorldByController.set(controller, { ...selectedResolvedStartWorld });
        repathAttemptUsedByController.set(controller, false);
        lastPathResult = {
          status: "start_recovery",
          accepted: true,
        };
        lastWorldPath = [
          {
            x: selectedResolvedStartWorld.x,
            y: selectedResolvedStartWorld.y,
          },
        ];
        if (!suppressMarker) {
          showMarker(selectedResolvedStartWorld, true);
        }
        return {
          accepted: true,
          goalWorld: { ...selectedResolvedStartWorld },
          pathLength: 1,
          status: "start_recovery",
          wasGoalClamped: clampedTarget.wasClamped,
          expansionAttemptCount: expansionAttempts.length,
          expansionFactorUsed: selectedExpansionFactor,
        };
      }
      if (!suppressMarker) {
        showMarker(resolvedGoal.world, false);
      }
      lastPathResult = {
        status: selectedResult?.status || "no_path",
        accepted: false,
      };
      lastWorldPath = [];
      return {
        accepted: false,
        reason: selectedResult?.status || "no_path",
      };
    }

    const worldPath = dedupeWorldPath(pathWithoutStart(selectedResult.path, currentWorld));
    if (worldPath.length === 0) {
      controller.clearPath();
    } else {
      controller.setWorldPath(worldPath);
    }

    lastGoalWorldByController.set(controller, { ...resolvedGoal.world });
    repathAttemptUsedByController.set(controller, false);
    lastPathResult = {
      status: selectedResult.status,
      accepted: true,
    };
    lastWorldPath = worldPath.map((point) => ({ ...point }));
    if (!suppressMarker) {
      showMarker(resolvedGoal.world, true);
    }
    return {
      accepted: true,
      goalWorld: { ...resolvedGoal.world },
      pathLength: worldPath.length,
      status: selectedResult.status,
      wasGoalClamped: clampedTarget.wasClamped,
      expansionAttemptCount: expansionAttempts.length,
      expansionFactorUsed: selectedExpansionFactor,
    };
  }

  function collectClaimableTiles(targetWorld, countNeeded) {
    const cellSize = Math.max(
      0.05,
      Number(subTileCellSizeTiles) || DEFAULT_SUB_TILE_CELL_SIZE_TILES
    );
    const anchorCell = worldToSubTileCell(targetWorld, cellSize);
    const candidates = [];
    const seen = new Set();
    const maxRadiusTiles = Math.max(0, Number(groupTileClaimMaxRadius) || 0);
    const maxRadiusCells = Math.max(0, Math.ceil(maxRadiusTiles / cellSize));

    for (let radius = 0; radius <= maxRadiusCells; radius += 1) {
      const minX = anchorCell.x - radius;
      const maxX = anchorCell.x + radius;
      const minY = anchorCell.y - radius;
      const maxY = anchorCell.y + radius;
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          if (
            radius !== 0 &&
            Math.max(Math.abs(x - anchorCell.x), Math.abs(y - anchorCell.y)) !== radius
          ) {
            continue;
          }
          const key = `${x},${y}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          const world = subTileCellToWorldCenter(x, y, cellSize);
          if (
            typeof runtime.isWalkableWorldPoint === "function" &&
            !runtime.isWalkableWorldPoint(world.x, world.y, agentRadiusTiles)
          ) {
            continue;
          }
          if (typeof runtime.isWalkableWorldPoint !== "function") {
            const tile = runtime.worldToTile(world.x, world.y);
            if (!runtime.isWalkableTile(tile.x, tile.y)) {
              continue;
            }
          }
          const distanceToCommand = Math.hypot(
            world.x - targetWorld.x,
            world.y - targetWorld.y
          );
          candidates.push({
            subTileCell: { x, y },
            world,
            distanceToCommand,
          });
        }
      }
      if (candidates.length >= countNeeded) {
        break;
      }
    }

    candidates.sort((a, b) => a.distanceToCommand - b.distanceToCommand);
    return candidates.slice(0, Math.max(0, countNeeded));
  }

  function buildGroupAssignments(selectedControllers, targetWorld) {
    const sortedControllers = [...selectedControllers].sort((a, b) => {
      const aWorld = a.getCurrentWorldPosition();
      const bWorld = b.getCurrentWorldPosition();
      const aDist = Math.hypot(aWorld.x - targetWorld.x, aWorld.y - targetWorld.y);
      const bDist = Math.hypot(bWorld.x - targetWorld.x, bWorld.y - targetWorld.y);
      return aDist - bDist;
    });

    const claimableTiles = collectClaimableTiles(targetWorld, sortedControllers.length);
    const assignments = [];
    const count = Math.min(sortedControllers.length, claimableTiles.length);
    for (let i = 0; i < count; i += 1) {
      const claimedTile = {
        x: runtime.worldToTile(claimableTiles[i].world.x, claimableTiles[i].world.y).x,
        y: runtime.worldToTile(claimableTiles[i].world.x, claimableTiles[i].world.y).y,
      };
      const claimedSubTile = {
        x: claimableTiles[i].subTileCell.x,
        y: claimableTiles[i].subTileCell.y,
      };
      assignments.push({
        controller: sortedControllers[i],
        goalWorld: {
          x: claimableTiles[i].world.x,
          y: claimableTiles[i].world.y,
        },
        claimedTile,
        claimedSubTile,
      });
    }
    return assignments;
  }

  function processMoveCommand(pointerWorldX, pointerWorldY) {
    const selectedControllers = getSelectedControllers();
    if (selectedControllers.length === 0) {
      lastCommandSummary = {
        selectedCount: 0,
        assignedCount: 0,
        acceptedCount: 0,
        failedCount: 0,
      };
      return {
        accepted: false,
        reason: "not_selected",
      };
    }

    const targetWorld = {
      x: Number(pointerWorldX) || 0,
      y: Number(pointerWorldY) || 0,
    };
    const assignments = buildGroupAssignments(selectedControllers, targetWorld);
    if (assignments.length === 0) {
      showMarker(targetWorld, false);
      lastCommandSummary = {
        selectedCount: selectedControllers.length,
        assignedCount: 0,
        acceptedCount: 0,
        failedCount: selectedControllers.length,
      };
      return {
        accepted: false,
        reason: "no_claimable_tiles",
        selectedCount: selectedControllers.length,
        assignedCount: 0,
      };
    }

    let acceptedCount = 0;
    let failedCount = 0;
    for (const assignment of assignments) {
      const result = computeAndAssignPath(
        assignment.controller,
        assignment.goalWorld,
        true,
        { suppressMarker: true }
      );
      if (result.accepted) {
        acceptedCount += 1;
      } else {
        failedCount += 1;
      }
    }
    failedCount += Math.max(0, selectedControllers.length - assignments.length);
    const anyAccepted = acceptedCount > 0;
    showMarker(targetWorld, anyAccepted);
    lastCommandSummary = {
      selectedCount: selectedControllers.length,
      assignedCount: assignments.length,
      acceptedCount,
      failedCount,
    };

    return {
      accepted: anyAccepted,
      reason: anyAccepted ? "ok" : "no_path",
      selectedCount: selectedControllers.length,
      assignedCount: assignments.length,
      acceptedCount,
      failedCount,
      claimedTiles: assignments.map((assignment) => ({ ...assignment.claimedTile })),
      claimedSubTiles: assignments.map((assignment) => ({
        ...assignment.claimedSubTile,
      })),
    };
  }

  function issueMoveCommand(pointerWorldX, pointerWorldY) {
    const selectedControllers = getSelectedControllers();
    if (selectedControllers.length === 0) {
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

    for (const [controller, lastGoalWorld] of lastGoalWorldByController.entries()) {
      if (!canAcceptCommands(controller)) {
        lastGoalWorldByController.delete(controller);
        repathAttemptUsedByController.delete(controller);
        continue;
      }
      if (typeof controller.consumePathBlockedEvent !== "function") {
        continue;
      }
      const blockedEvent = controller.consumePathBlockedEvent();
      if (!blockedEvent) {
        continue;
      }
      const alreadyRetried = repathAttemptUsedByController.get(controller) === true;
      if (alreadyRetried) {
        continue;
      }
      repathAttemptUsedByController.set(controller, true);
      const repathResult = computeAndAssignPath(
        controller,
        lastGoalWorld,
        true,
        { suppressMarker: true }
      );
      repathAttemptUsedByController.set(controller, true);
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
            resolvedStartWorld: lastPathRequest.resolvedStartWorld
              ? { ...lastPathRequest.resolvedStartWorld }
              : null,
            targetWorld: lastPathRequest.targetWorld
              ? { ...lastPathRequest.targetWorld }
              : null,
            effectiveTargetWorld: lastPathRequest.effectiveTargetWorld
              ? { ...lastPathRequest.effectiveTargetWorld }
              : null,
            resolvedGoalWorld: lastPathRequest.resolvedGoalWorld
              ? { ...lastPathRequest.resolvedGoalWorld }
              : null,
            wasGoalClamped: lastPathRequest.wasGoalClamped === true,
            wasStartAdjusted: lastPathRequest.wasStartAdjusted === true,
          }
        : null,
      lastPathResult: lastPathResult ? { ...lastPathResult } : null,
      trackedGoals: Array.from(lastGoalWorldByController.values()).map((world) => ({
        x: world.x,
        y: world.y,
      })),
      lastWorldPath: lastWorldPath.map((point) => ({ ...point })),
      lastPathDebug: lastPathDebug
        ? {
            ...lastPathDebug,
            visitedCells: Array.isArray(lastPathDebug.visitedCells)
              ? lastPathDebug.visitedCells.map((cell) => ({ ...cell }))
              : [],
          }
        : null,
      lastGridSummary: lastGridSummary
        ? {
            ...lastGridSummary,
            boundsUsed: lastGridSummary.boundsUsed
              ? cloneBounds(lastGridSummary.boundsUsed)
              : null,
            expansionAttempts: Array.isArray(lastGridSummary.expansionAttempts)
              ? lastGridSummary.expansionAttempts.map((attempt) => ({
                  ...attempt,
                  boundaryHits: attempt.boundaryHits ? { ...attempt.boundaryHits } : null,
                  paddedSides: attempt.paddedSides ? { ...attempt.paddedSides } : null,
                  bounds: attempt.bounds ? cloneBounds(attempt.bounds) : null,
                }))
              : [],
          }
        : null,
      commandCooldownRemaining,
      hasQueuedCommand: queuedGoalWorld !== null,
      selectedCount: getSelectedControllers().length,
      lastCommandSummary: lastCommandSummary ? { ...lastCommandSummary } : null,
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

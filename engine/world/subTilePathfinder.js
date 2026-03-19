const CARDINAL_DIRECTIONS = [
  { dx: 1, dy: 0, cost: 1 },
  { dx: -1, dy: 0, cost: 1 },
  { dx: 0, dy: 1, cost: 1 },
  { dx: 0, dy: -1, cost: 1 },
];

const DEFAULT_MAX_NODES = 32000;
const DEFAULT_CELL_SIZE_TILES = 0.25;

function coordKey(x, y) {
  return `${x},${y}`;
}

function parseCoordKey(key) {
  const comma = key.indexOf(",");
  return {
    x: Number(key.slice(0, comma)),
    y: Number(key.slice(comma + 1)),
  };
}

function normalizeWorldPoint(point) {
  return {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
  };
}

function compareCandidate(a, b, nodeRecords) {
  const nodeA = nodeRecords.get(a);
  const nodeB = nodeRecords.get(b);
  if (!nodeA || !nodeB) {
    return 0;
  }

  if (nodeA.f !== nodeB.f) {
    return nodeA.f - nodeB.f;
  }
  if (nodeA.h !== nodeB.h) {
    return nodeA.h - nodeB.h;
  }
  if (nodeA.g !== nodeB.g) {
    return nodeA.g - nodeB.g;
  }
  return nodeA.order - nodeB.order;
}

function pickBestOpenKey(openList, nodeRecords) {
  let bestIndex = 0;
  for (let i = 1; i < openList.length; i += 1) {
    if (compareCandidate(openList[i], openList[bestIndex], nodeRecords) < 0) {
      bestIndex = i;
    }
  }
  const [bestKey] = openList.splice(bestIndex, 1);
  return bestKey;
}

function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function reconstructPath(goalKey, nodeRecords) {
  const reversed = [];
  let current = goalKey;

  while (current) {
    const cell = parseCoordKey(current);
    reversed.push(cell);
    current = nodeRecords.get(current)?.parentKey || null;
  }

  reversed.reverse();
  return reversed;
}

function buildDebugPayload({
  includeDebug,
  status,
  expandedCount,
  maxNodes,
  visitedOrder,
  openSet,
  closedSet,
  navigationGrid,
}) {
  if (!includeDebug) {
    return undefined;
  }

  const cellSizeTiles = Number(navigationGrid?.cellSizeTiles) || DEFAULT_CELL_SIZE_TILES;
  const visitedCells = [];
  for (const key of visitedOrder) {
    const cell = parseCoordKey(key);
    const world = navigationGrid.cellToWorldCenter(cell.x, cell.y);
    visitedCells.push({
      x: world.x - cellSizeTiles * 0.5,
      y: world.y - cellSizeTiles * 0.5,
      w: cellSizeTiles,
      h: cellSizeTiles,
    });
  }

  return {
    status,
    expandedCount,
    maxNodes,
    openCount: openSet.size,
    closedCount: closedSet.size,
    cellSizeTiles,
    visitedCells,
  };
}

function dedupeWorldPath(path) {
  const out = [];
  let prev = null;
  for (const point of path) {
    if (
      prev &&
      Math.abs(prev.x - point.x) <= 0.000001 &&
      Math.abs(prev.y - point.y) <= 0.000001
    ) {
      continue;
    }
    out.push(point);
    prev = point;
  }
  return out;
}

export function findPath({
  startWorld,
  goalWorld,
  navigationGrid,
  maxNodes = DEFAULT_MAX_NODES,
  includeDebug = false,
} = {}) {
  if (!navigationGrid || typeof navigationGrid.isWalkableCell !== "function") {
    throw new Error("findPath requires a navigationGrid with isWalkableCell(cellX, cellY).");
  }
  if (
    typeof navigationGrid.worldToCell !== "function" ||
    typeof navigationGrid.cellToWorldCenter !== "function"
  ) {
    throw new Error("findPath requires navigationGrid world/cell conversion helpers.");
  }

  const normalizedStartWorld = normalizeWorldPoint(startWorld);
  const normalizedGoalWorld = normalizeWorldPoint(goalWorld);
  const cappedMaxNodes = Number.isFinite(maxNodes)
    ? Math.max(1, Math.floor(maxNodes))
    : DEFAULT_MAX_NODES;

  const startCell = navigationGrid.worldToCell(normalizedStartWorld.x, normalizedStartWorld.y);
  const goalCell = navigationGrid.worldToCell(normalizedGoalWorld.x, normalizedGoalWorld.y);
  const startWalkable = navigationGrid.isWalkableCell(startCell.x, startCell.y);
  const goalWalkable = navigationGrid.isWalkableCell(goalCell.x, goalCell.y);

  if (!startWalkable || !goalWalkable) {
    return {
      status: "blocked",
      path: [],
      debug: buildDebugPayload({
        includeDebug,
        status: "blocked",
        expandedCount: 0,
        maxNodes: cappedMaxNodes,
        visitedOrder: [],
        openSet: new Set(),
        closedSet: new Set(),
        navigationGrid,
      }),
    };
  }

  const startKey = coordKey(startCell.x, startCell.y);
  const goalKey = coordKey(goalCell.x, goalCell.y);

  if (startKey === goalKey) {
    return {
      status: "found",
      path: [normalizedGoalWorld],
      debug: buildDebugPayload({
        includeDebug,
        status: "found",
        expandedCount: 0,
        maxNodes: cappedMaxNodes,
        visitedOrder: [startKey],
        openSet: new Set(),
        closedSet: new Set([startKey]),
        navigationGrid,
      }),
    };
  }

  const openList = [startKey];
  const openSet = new Set([startKey]);
  const closedSet = new Set();
  const visitedOrder = [];
  const nodeRecords = new Map();
  let serial = 0;
  let expandedCount = 0;

  nodeRecords.set(startKey, {
    x: startCell.x,
    y: startCell.y,
    g: 0,
    h: manhattanDistance(startCell, goalCell),
    f: manhattanDistance(startCell, goalCell),
    parentKey: null,
    order: serial,
  });

  while (openList.length > 0) {
    if (expandedCount >= cappedMaxNodes) {
      return {
        status: "budget_exceeded",
        path: [],
        debug: buildDebugPayload({
          includeDebug,
          status: "budget_exceeded",
          expandedCount,
          maxNodes: cappedMaxNodes,
          visitedOrder,
          openSet,
          closedSet,
          navigationGrid,
        }),
      };
    }

    const currentKey = pickBestOpenKey(openList, nodeRecords);
    openSet.delete(currentKey);
    closedSet.add(currentKey);
    visitedOrder.push(currentKey);
    expandedCount += 1;

    if (currentKey === goalKey) {
      const pathCells = reconstructPath(currentKey, nodeRecords);
      const pathWorld = dedupeWorldPath([
        normalizedStartWorld,
        ...pathCells.map((cell) => navigationGrid.cellToWorldCenter(cell.x, cell.y)),
        normalizedGoalWorld,
      ]);

      return {
        status: "found",
        path: pathWorld,
        debug: buildDebugPayload({
          includeDebug,
          status: "found",
          expandedCount,
          maxNodes: cappedMaxNodes,
          visitedOrder,
          openSet,
          closedSet,
          navigationGrid,
        }),
      };
    }

    const current = nodeRecords.get(currentKey);
    if (!current) {
      continue;
    }

    for (const direction of CARDINAL_DIRECTIONS) {
      const nx = current.x + direction.dx;
      const ny = current.y + direction.dy;
      const neighborKey = coordKey(nx, ny);

      if (closedSet.has(neighborKey)) {
        continue;
      }
      if (!navigationGrid.isWalkableCell(nx, ny)) {
        continue;
      }

      const tentativeG = current.g + direction.cost;
      const existing = nodeRecords.get(neighborKey);
      if (existing && tentativeG >= existing.g) {
        continue;
      }

      const h = manhattanDistance({ x: nx, y: ny }, goalCell);
      serial += 1;
      nodeRecords.set(neighborKey, {
        x: nx,
        y: ny,
        g: tentativeG,
        h,
        f: tentativeG + h,
        parentKey: currentKey,
        order: serial,
      });

      if (!openSet.has(neighborKey)) {
        openSet.add(neighborKey);
        openList.push(neighborKey);
      }
    }
  }

  return {
    status: "no_path",
    path: [],
    debug: buildDebugPayload({
      includeDebug,
      status: "no_path",
      expandedCount,
      maxNodes: cappedMaxNodes,
      visitedOrder,
      openSet,
      closedSet,
      navigationGrid,
    }),
  };
}

export function createSubTilePathfinder() {
  return {
    findPath,
  };
}

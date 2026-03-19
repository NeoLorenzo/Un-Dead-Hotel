const CARDINAL_DIRECTIONS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

const DEFAULT_MAX_NODES = 8000;

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

function normalizePoint(point) {
  return {
    x: Math.floor(Number(point?.x) || 0),
    y: Math.floor(Number(point?.y) || 0),
  };
}

function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function buildDebugPayload({
  includeDebug,
  status,
  expandedCount,
  maxNodes,
  visitedOrder,
  openSet,
  closedSet,
}) {
  if (!includeDebug) {
    return undefined;
  }

  return {
    status,
    expandedCount,
    maxNodes,
    openCount: openSet.size,
    closedCount: closedSet.size,
    visitedNodes: visitedOrder.map((key) => parseCoordKey(key)),
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

function reconstructPath(goalKey, nodeRecords) {
  const reversedPath = [];
  let currentKey = goalKey;

  while (currentKey) {
    reversedPath.push(parseCoordKey(currentKey));
    const record = nodeRecords.get(currentKey);
    currentKey = record?.parentKey || null;
  }

  reversedPath.reverse();
  return reversedPath;
}

export function findPath({
  start,
  goal,
  isWalkable,
  maxNodes = DEFAULT_MAX_NODES,
  includeDebug = false,
} = {}) {
  if (typeof isWalkable !== "function") {
    throw new Error("findPath requires an isWalkable(tileX, tileY) function.");
  }

  const normalizedStart = normalizePoint(start);
  const normalizedGoal = normalizePoint(goal);
  const cappedMaxNodes = Number.isFinite(maxNodes)
    ? Math.max(1, Math.floor(maxNodes))
    : DEFAULT_MAX_NODES;

  const startWalkable = isWalkable(normalizedStart.x, normalizedStart.y);
  const goalWalkable = isWalkable(normalizedGoal.x, normalizedGoal.y);

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
      }),
    };
  }

  const startKey = coordKey(normalizedStart.x, normalizedStart.y);
  const goalKey = coordKey(normalizedGoal.x, normalizedGoal.y);

  if (startKey === goalKey) {
    return {
      status: "found",
      path: [normalizedStart],
      debug: buildDebugPayload({
        includeDebug,
        status: "found",
        expandedCount: 0,
        maxNodes: cappedMaxNodes,
        visitedOrder: [startKey],
        openSet: new Set(),
        closedSet: new Set([startKey]),
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
    x: normalizedStart.x,
    y: normalizedStart.y,
    g: 0,
    h: manhattanDistance(normalizedStart, normalizedGoal),
    f: manhattanDistance(normalizedStart, normalizedGoal),
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
        }),
      };
    }

    const currentKey = pickBestOpenKey(openList, nodeRecords);
    openSet.delete(currentKey);
    closedSet.add(currentKey);
    visitedOrder.push(currentKey);
    expandedCount += 1;

    if (currentKey === goalKey) {
      return {
        status: "found",
        path: reconstructPath(currentKey, nodeRecords),
        debug: buildDebugPayload({
          includeDebug,
          status: "found",
          expandedCount,
          maxNodes: cappedMaxNodes,
          visitedOrder,
          openSet,
          closedSet,
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
      if (!isWalkable(nx, ny)) {
        continue;
      }

      const tentativeG = current.g + 1;
      const existing = nodeRecords.get(neighborKey);
      if (existing && tentativeG >= existing.g) {
        continue;
      }

      const h = manhattanDistance({ x: nx, y: ny }, normalizedGoal);
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
    }),
  };
}

export function createAStarPathfinder() {
  return {
    findPath,
  };
}

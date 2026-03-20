const SQRT2 = Math.SQRT2;
const SEARCH_DIRECTIONS = [
  { dx: 1, dy: 0, cost: 1 },
  { dx: -1, dy: 0, cost: 1 },
  { dx: 0, dy: 1, cost: 1 },
  { dx: 0, dy: -1, cost: 1 },
  { dx: 1, dy: 1, cost: SQRT2 },
  { dx: 1, dy: -1, cost: SQRT2 },
  { dx: -1, dy: 1, cost: SQRT2 },
  { dx: -1, dy: -1, cost: SQRT2 },
];

const DEFAULT_MAX_NODES = 32000;
const DEFAULT_CELL_SIZE_TILES = 0.25;
const COST_EPSILON = 0.000001;

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

function octileDistance(a, b) {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  const minDelta = Math.min(dx, dy);
  const maxDelta = Math.max(dx, dy);
  return maxDelta + (SQRT2 - 1) * minDelta;
}

function canTraverseDirection(navigationGrid, fromX, fromY, direction) {
  const nextX = fromX + direction.dx;
  const nextY = fromY + direction.dy;
  if (!navigationGrid.isWalkableCell(nextX, nextY)) {
    return false;
  }

  const isDiagonal = direction.dx !== 0 && direction.dy !== 0;
  if (!isDiagonal) {
    return true;
  }

  // Disallow corner cutting for diagonals: both adjacent cardinal cells
  // must be walkable to keep movement collision-safe.
  const sideXWalkable = navigationGrid.isWalkableCell(fromX + direction.dx, fromY);
  const sideYWalkable = navigationGrid.isWalkableCell(fromX, fromY + direction.dy);
  return sideXWalkable && sideYWalkable;
}

function dedupeWorldPath(path) {
  const out = [];
  let prev = null;
  for (const point of path) {
    if (
      prev &&
      Math.abs(prev.x - point.x) <= COST_EPSILON &&
      Math.abs(prev.y - point.y) <= COST_EPSILON
    ) {
      continue;
    }
    out.push(point);
    prev = point;
  }
  return out;
}

function createBoundaryHits() {
  return {
    minX: false,
    maxX: false,
    minY: false,
    maxY: false,
  };
}

function cloneBoundaryHits(boundaryHits) {
  return {
    minX: boundaryHits?.minX === true,
    maxX: boundaryHits?.maxX === true,
    minY: boundaryHits?.minY === true,
    maxY: boundaryHits?.maxY === true,
  };
}

function markBoundaryHit(boundaryHits, x, y, cols, rows) {
  if (!boundaryHits) {
    return;
  }
  if (x <= 0) {
    boundaryHits.minX = true;
  }
  if (y <= 0) {
    boundaryHits.minY = true;
  }
  if (x >= cols - 1) {
    boundaryHits.maxX = true;
  }
  if (y >= rows - 1) {
    boundaryHits.maxY = true;
  }
}

function didTouchBoundary(boundaryHits) {
  if (!boundaryHits) {
    return false;
  }
  return (
    boundaryHits.minX === true ||
    boundaryHits.maxX === true ||
    boundaryHits.minY === true ||
    boundaryHits.maxY === true
  );
}

function isDomainLikelyClipped(status, boundaryHits) {
  return status === "no_path" && didTouchBoundary(boundaryHits);
}

function buildSearchStats({
  status,
  expandedCount,
  maxNodes,
  openCount,
  closedCount,
  boundaryHits,
}) {
  return {
    status,
    expandedCount,
    maxNodes,
    openCount,
    closedCount,
    boundaryHits: cloneBoundaryHits(boundaryHits),
    touchedBoundary: didTouchBoundary(boundaryHits),
    domainClipped: isDomainLikelyClipped(status, boundaryHits),
  };
}

function compareHeapEntry(a, b) {
  if (a.f !== b.f) {
    return a.f - b.f;
  }
  if (a.h !== b.h) {
    return a.h - b.h;
  }
  if (a.g !== b.g) {
    return a.g - b.g;
  }
  return a.order - b.order;
}

function createMinHeap(compareFn) {
  const data = [];

  function bubbleUp(index) {
    let i = index;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (compareFn(data[i], data[parent]) >= 0) {
        break;
      }
      const tmp = data[i];
      data[i] = data[parent];
      data[parent] = tmp;
      i = parent;
    }
  }

  function bubbleDown(index) {
    let i = index;
    while (true) {
      const left = i * 2 + 1;
      const right = left + 1;
      let best = i;

      if (left < data.length && compareFn(data[left], data[best]) < 0) {
        best = left;
      }
      if (right < data.length && compareFn(data[right], data[best]) < 0) {
        best = right;
      }
      if (best === i) {
        break;
      }

      const tmp = data[i];
      data[i] = data[best];
      data[best] = tmp;
      i = best;
    }
  }

  function push(item) {
    data.push(item);
    bubbleUp(data.length - 1);
  }

  function pop() {
    if (data.length === 0) {
      return null;
    }
    const top = data[0];
    const tail = data.pop();
    if (data.length > 0 && tail) {
      data[0] = tail;
      bubbleDown(0);
    }
    return top;
  }

  function peek() {
    return data.length > 0 ? data[0] : null;
  }

  function size() {
    return data.length;
  }

  return {
    push,
    pop,
    peek,
    size,
  };
}

function createSearchState(startCell, heuristicTargetCell) {
  const records = new Map();
  const heap = createMinHeap(compareHeapEntry);
  const startKey = coordKey(startCell.x, startCell.y);
  const h = octileDistance(startCell, heuristicTargetCell);
  const startRecord = {
    x: startCell.x,
    y: startCell.y,
    g: 0,
    h,
    f: h,
    parentKey: null,
    order: 0,
    closed: false,
  };
  records.set(startKey, startRecord);
  heap.push({
    key: startKey,
    f: startRecord.f,
    h: startRecord.h,
    g: startRecord.g,
    order: startRecord.order,
  });

  return {
    records,
    heap,
    visitedOrder: [],
    serial: 0,
    expandedCount: 0,
    heuristicTargetCell,
  };
}

function isHeapEntryCurrent(entry, records) {
  if (!entry) {
    return false;
  }
  const record = records.get(entry.key);
  if (!record || record.closed) {
    return false;
  }
  return (
    Math.abs(record.f - entry.f) <= COST_EPSILON &&
    Math.abs(record.g - entry.g) <= COST_EPSILON &&
    record.order === entry.order
  );
}

function peekValidOpen(search) {
  while (search.heap.size() > 0) {
    const entry = search.heap.peek();
    if (isHeapEntryCurrent(entry, search.records)) {
      return entry;
    }
    search.heap.pop();
  }
  return null;
}

function popValidOpen(search) {
  while (search.heap.size() > 0) {
    const entry = search.heap.pop();
    if (!isHeapEntryCurrent(entry, search.records)) {
      continue;
    }

    const record = search.records.get(entry.key);
    if (!record || record.closed) {
      continue;
    }

    record.closed = true;
    search.expandedCount += 1;
    search.visitedOrder.push(entry.key);
    return {
      key: entry.key,
      record,
    };
  }
  return null;
}

function countOpenRecords(records) {
  let count = 0;
  for (const record of records.values()) {
    if (!record.closed) {
      count += 1;
    }
  }
  return count;
}

function maybeUpdateBestMeet(currentBest, key, activeRecord, passiveRecords) {
  const passiveRecord = passiveRecords.get(key);
  if (!activeRecord || !passiveRecord) {
    return currentBest;
  }

  const candidateCost = activeRecord.g + passiveRecord.g;
  if (!currentBest || candidateCost < currentBest.cost - COST_EPSILON) {
    return {
      key,
      cost: candidateCost,
    };
  }

  if (Math.abs(candidateCost - currentBest.cost) <= COST_EPSILON && key < currentBest.key) {
    return {
      key,
      cost: candidateCost,
    };
  }

  return currentBest;
}

function expandSearchFront({
  activeSearch,
  passiveSearch,
  navigationGrid,
  currentBestMeet,
  boundaryHits,
}) {
  const popped = popValidOpen(activeSearch);
  if (!popped) {
    return {
      expanded: false,
      bestMeet: currentBestMeet,
    };
  }

  const { key: currentKey, record: current } = popped;
  markBoundaryHit(boundaryHits, current.x, current.y, navigationGrid.cols, navigationGrid.rows);
  let bestMeet = maybeUpdateBestMeet(
    currentBestMeet,
    currentKey,
    current,
    passiveSearch.records
  );

  for (const direction of SEARCH_DIRECTIONS) {
    if (!canTraverseDirection(navigationGrid, current.x, current.y, direction)) {
      continue;
    }
    const nx = current.x + direction.dx;
    const ny = current.y + direction.dy;

    const neighborKey = coordKey(nx, ny);
    const tentativeG = current.g + direction.cost;
    const existing = activeSearch.records.get(neighborKey);
    if (existing && tentativeG >= existing.g - COST_EPSILON) {
      continue;
    }

    activeSearch.serial += 1;
    const h = octileDistance({ x: nx, y: ny }, activeSearch.heuristicTargetCell);
    const nextRecord = {
      x: nx,
      y: ny,
      g: tentativeG,
      h,
      f: tentativeG + h,
      parentKey: currentKey,
      order: activeSearch.serial,
      closed: false,
    };
    activeSearch.records.set(neighborKey, nextRecord);
    activeSearch.heap.push({
      key: neighborKey,
      f: nextRecord.f,
      h: nextRecord.h,
      g: nextRecord.g,
      order: nextRecord.order,
    });

    bestMeet = maybeUpdateBestMeet(bestMeet, neighborKey, nextRecord, passiveSearch.records);
  }

  return {
    expanded: true,
    bestMeet,
  };
}

function chainCellsToRoot(startKey, records) {
  const out = [];
  let currentKey = startKey;
  while (currentKey) {
    const record = records.get(currentKey);
    if (!record) {
      break;
    }
    out.push({
      x: record.x,
      y: record.y,
    });
    currentKey = record.parentKey;
  }
  return out;
}

function reconstructBidirectionalCells(meetKey, forwardRecords, backwardRecords) {
  const meetToStart = chainCellsToRoot(meetKey, forwardRecords);
  const meetToGoal = chainCellsToRoot(meetKey, backwardRecords);
  if (meetToStart.length === 0 || meetToGoal.length === 0) {
    return [];
  }

  const startToMeet = [...meetToStart].reverse();
  const meetToGoalWithoutMeet = meetToGoal.slice(1);
  return [...startToMeet, ...meetToGoalWithoutMeet];
}

function buildDebugPayload({
  includeDebug,
  status,
  expandedCount,
  maxNodes,
  visitedOrder,
  openCount,
  closedCount,
  boundaryHits,
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
    openCount,
    closedCount,
    boundaryHits: cloneBoundaryHits(boundaryHits),
    touchedBoundary: didTouchBoundary(boundaryHits),
    domainClipped: isDomainLikelyClipped(status, boundaryHits),
    cellSizeTiles,
    visitedCells,
  };
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
  const boundaryHits = createBoundaryHits();

  if (!startWalkable || !goalWalkable) {
    const searchStats = buildSearchStats({
      status: "blocked",
      expandedCount: 0,
      maxNodes: cappedMaxNodes,
      openCount: 0,
      closedCount: 0,
      boundaryHits,
    });
    return {
      status: "blocked",
      path: [],
      searchStats,
      debug: buildDebugPayload({
        includeDebug,
        status: "blocked",
        expandedCount: 0,
        maxNodes: cappedMaxNodes,
        visitedOrder: [],
        openCount: 0,
        closedCount: 0,
        boundaryHits,
        navigationGrid,
      }),
    };
  }

  const startKey = coordKey(startCell.x, startCell.y);
  const goalKey = coordKey(goalCell.x, goalCell.y);
  if (startKey === goalKey) {
    const searchStats = buildSearchStats({
      status: "found",
      expandedCount: 0,
      maxNodes: cappedMaxNodes,
      openCount: 0,
      closedCount: 1,
      boundaryHits,
    });
    return {
      status: "found",
      path: [normalizedGoalWorld],
      searchStats,
      debug: buildDebugPayload({
        includeDebug,
        status: "found",
        expandedCount: 0,
        maxNodes: cappedMaxNodes,
        visitedOrder: [startKey],
        openCount: 0,
        closedCount: 1,
        boundaryHits,
        navigationGrid,
      }),
    };
  }

  const forward = createSearchState(startCell, goalCell);
  const backward = createSearchState(goalCell, startCell);
  let bestMeet = null;

  while (true) {
    const expandedCount = forward.expandedCount + backward.expandedCount;
    if (expandedCount >= cappedMaxNodes) {
      const visitedOrder = [...forward.visitedOrder, ...backward.visitedOrder];
      const openCount = countOpenRecords(forward.records) + countOpenRecords(backward.records);
      const searchStats = buildSearchStats({
        status: "budget_exceeded",
        expandedCount,
        maxNodes: cappedMaxNodes,
        openCount,
        closedCount: expandedCount,
        boundaryHits,
      });
      return {
        status: "budget_exceeded",
        path: [],
        searchStats,
        debug: buildDebugPayload({
          includeDebug,
          status: "budget_exceeded",
          expandedCount,
          maxNodes: cappedMaxNodes,
          visitedOrder,
          openCount,
          closedCount: expandedCount,
          boundaryHits,
          navigationGrid,
        }),
      };
    }

    const forwardTop = peekValidOpen(forward);
    const backwardTop = peekValidOpen(backward);
    if (!forwardTop || !backwardTop) {
      break;
    }

    if (bestMeet && forwardTop.f + backwardTop.f >= bestMeet.cost - COST_EPSILON) {
      break;
    }

    const expandForward = forwardTop.f <= backwardTop.f;
    const result = expandSearchFront({
      activeSearch: expandForward ? forward : backward,
      passiveSearch: expandForward ? backward : forward,
      navigationGrid,
      currentBestMeet: bestMeet,
      boundaryHits,
    });
    bestMeet = result.bestMeet;
  }

  const visitedOrder = [...forward.visitedOrder, ...backward.visitedOrder];
  const expandedCount = forward.expandedCount + backward.expandedCount;
  const openCount = countOpenRecords(forward.records) + countOpenRecords(backward.records);

  if (bestMeet) {
    const pathCells = reconstructBidirectionalCells(
      bestMeet.key,
      forward.records,
      backward.records
    );
    if (pathCells.length > 0) {
      const pathWorld = dedupeWorldPath([
        normalizedStartWorld,
        ...pathCells.map((cell) => navigationGrid.cellToWorldCenter(cell.x, cell.y)),
        normalizedGoalWorld,
      ]);
      const searchStats = buildSearchStats({
        status: "found",
        expandedCount,
        maxNodes: cappedMaxNodes,
        openCount,
        closedCount: expandedCount,
        boundaryHits,
      });
      return {
        status: "found",
        path: pathWorld,
        searchStats,
        debug: buildDebugPayload({
          includeDebug,
          status: "found",
          expandedCount,
          maxNodes: cappedMaxNodes,
          visitedOrder,
          openCount,
          closedCount: expandedCount,
          boundaryHits,
          navigationGrid,
        }),
      };
    }
  }

  const searchStats = buildSearchStats({
    status: "no_path",
    expandedCount,
    maxNodes: cappedMaxNodes,
    openCount,
    closedCount: expandedCount,
    boundaryHits,
  });
  return {
    status: "no_path",
    path: [],
    searchStats,
    debug: buildDebugPayload({
      includeDebug,
      status: "no_path",
      expandedCount,
      maxNodes: cappedMaxNodes,
      visitedOrder,
      openCount,
      closedCount: expandedCount,
      boundaryHits,
      navigationGrid,
    }),
  };
}

export function createSubTilePathfinder() {
  return {
    findPath,
  };
}

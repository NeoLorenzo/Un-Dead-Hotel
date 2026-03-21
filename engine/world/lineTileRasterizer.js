const DEFAULT_SUB_TILE_SIZE_TILES = 0.25;

function normalizeWorldPoint(point) {
  return {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
  };
}

function normalizeCellSize(cellSizeTiles) {
  return Math.max(
    0.01,
    Number.isFinite(cellSizeTiles)
      ? Number(cellSizeTiles)
      : DEFAULT_SUB_TILE_SIZE_TILES
  );
}

function areSameCell(a, b) {
  return a?.x === b?.x && a?.y === b?.y;
}

function bresenhamLineCells(startCell, goalCell) {
  const cells = [];
  let x0 = startCell.x;
  let y0 = startCell.y;
  const x1 = goalCell.x;
  const y1 = goalCell.y;
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    cells.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) {
      break;
    }
    const e2 = err * 2;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }

  return cells;
}

export function subTileCoordKey(cellX, cellY) {
  return `${Math.floor(cellX)},${Math.floor(cellY)}`;
}

export function worldToSubTileCell(worldX, worldY, cellSizeTiles = DEFAULT_SUB_TILE_SIZE_TILES) {
  const size = normalizeCellSize(cellSizeTiles);
  return {
    x: Math.floor((Number(worldX) || 0) / size),
    y: Math.floor((Number(worldY) || 0) / size),
  };
}

export function subTileCellToWorldCenter(
  cellX,
  cellY,
  cellSizeTiles = DEFAULT_SUB_TILE_SIZE_TILES
) {
  const size = normalizeCellSize(cellSizeTiles);
  return {
    x: (Math.floor(cellX) + 0.5) * size,
    y: (Math.floor(cellY) + 0.5) * size,
  };
}

export function buildOccupiedSubTileKeysFromWorldPoints(
  worldPoints,
  { cellSizeTiles = DEFAULT_SUB_TILE_SIZE_TILES } = {}
) {
  const keys = new Set();
  if (!Array.isArray(worldPoints) || worldPoints.length === 0) {
    return keys;
  }
  const size = normalizeCellSize(cellSizeTiles);
  for (const point of worldPoints) {
    const world = normalizeWorldPoint(point);
    if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) {
      continue;
    }
    const cell = worldToSubTileCell(world.x, world.y, size);
    keys.add(subTileCoordKey(cell.x, cell.y));
  }
  return keys;
}

export function rasterizeSubTileLine({
  startWorld,
  goalWorld,
  cellSizeTiles = DEFAULT_SUB_TILE_SIZE_TILES,
  includeStart = false,
  includeGoal = true,
  isBlockedCell = null,
} = {}) {
  const start = normalizeWorldPoint(startWorld);
  const goal = normalizeWorldPoint(goalWorld);
  if (
    !Number.isFinite(start.x) ||
    !Number.isFinite(start.y) ||
    !Number.isFinite(goal.x) ||
    !Number.isFinite(goal.y)
  ) {
    return {
      status: "invalid",
      startCell: null,
      goalCell: null,
      pathCells: [],
      pathWorld: [],
      blockedCell: null,
      wasTrimmed: false,
    };
  }

  const size = normalizeCellSize(cellSizeTiles);
  const startCell = worldToSubTileCell(start.x, start.y, size);
  const goalCell = worldToSubTileCell(goal.x, goal.y, size);
  const rawCells = bresenhamLineCells(startCell, goalCell);
  const pathCells = [];
  let blockedCell = null;
  let previous = null;

  for (let i = 0; i < rawCells.length; i += 1) {
    const cell = rawCells[i];
    const isStart = areSameCell(cell, startCell);
    const isGoal = areSameCell(cell, goalCell);
    if ((!includeStart && isStart) || (!includeGoal && isGoal)) {
      continue;
    }
    if (previous && areSameCell(previous, cell)) {
      continue;
    }

    const blocked =
      typeof isBlockedCell === "function"
        ? isBlockedCell(cell, {
            index: pathCells.length,
            isStart,
            isGoal,
            startCell,
            goalCell,
          }) === true
        : false;
    if (blocked) {
      blockedCell = { ...cell };
      break;
    }

    pathCells.push({ ...cell });
    previous = cell;
  }

  return {
    status: blockedCell && pathCells.length === 0 ? "blocked" : "ok",
    startCell: { ...startCell },
    goalCell: { ...goalCell },
    pathCells,
    pathWorld: pathCells.map((cell) =>
      subTileCellToWorldCenter(cell.x, cell.y, size)
    ),
    blockedCell,
    wasTrimmed: blockedCell !== null,
  };
}


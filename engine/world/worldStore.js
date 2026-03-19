import {
  CARDINAL_NEIGHBORS,
  NEXTGEN_SEED,
  buildChunkCollisionGeometry,
  buildChunkNavigationData,
  buildAccessCorridorCatalogue,
  buildCorridorTilePatterns,
  buildForcedCorridorAssignment,
  buildSeededCorridorAssignment,
  coordKey,
  generateChunkRooms,
  generateChunkSpecialSpaces,
  hasConnectingNeighbor,
  placeChunkAccessCorridors,
  seededIndex,
} from "../generation/chunkGenerator.js";

export function createWorldStore({
  corridorPatterns = buildCorridorTilePatterns(),
  accessCorridorCatalogue = buildAccessCorridorCatalogue(corridorPatterns),
} = {}) {
  const assignments = new Map();
  const chunkCache = new Map();

  let loadedBounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  };

  function updateLoadedBounds(cx, cy) {
    if (cx < loadedBounds.minX) {
      loadedBounds.minX = cx;
    }
    if (cx > loadedBounds.maxX) {
      loadedBounds.maxX = cx;
    }
    if (cy < loadedBounds.minY) {
      loadedBounds.minY = cy;
    }
    if (cy > loadedBounds.maxY) {
      loadedBounds.maxY = cy;
    }
  }

  function ensureChunkAssignment(cx, cy) {
    const key = coordKey(cx, cy);
    const existing = assignments.get(key);
    if (existing) {
      return existing;
    }

    assignments.set(key, buildSeededCorridorAssignment(corridorPatterns, cx, cy));

    const neighbors = [];
    for (const rule of CARDINAL_NEIGHBORS) {
      const nx = cx + rule.dx;
      const ny = cy + rule.dy;
      const neighborKey = coordKey(nx, ny);
      const neighbor = assignments.get(neighborKey);
      if (!neighbor) {
        continue;
      }
      neighbors.push({ rule, nx, ny, key: neighborKey, neighbor });
    }

    if (neighbors.length === 0 || hasConnectingNeighbor(assignments, cx, cy)) {
      return assignments.get(key);
    }

    const connectable = neighbors.filter((item) => item.neighbor.sockets[item.rule.opposite]);
    if (connectable.length > 0) {
      const pick = seededIndex(connectable.length, NEXTGEN_SEED, cx, cy, "runtime-force-current");
      const chosen = connectable[pick];
      assignments.set(key, buildForcedCorridorAssignment(corridorPatterns, cx, cy, chosen.rule.side, 1));
      return assignments.get(key);
    }

    const pairPick = seededIndex(neighbors.length, NEXTGEN_SEED, cx, cy, "runtime-force-pair");
    const pairChosen = neighbors[pairPick];
    assignments.set(key, buildForcedCorridorAssignment(corridorPatterns, cx, cy, pairChosen.rule.side, 1));
    assignments.set(
      pairChosen.key,
      buildForcedCorridorAssignment(corridorPatterns, pairChosen.nx, pairChosen.ny, pairChosen.rule.opposite, 1)
    );

    chunkCache.delete(pairChosen.key);
    return assignments.get(key);
  }

  function generateChunk(cx, cy) {
    const assignment = ensureChunkAssignment(cx, cy);
    const chunkSpecials = generateChunkSpecialSpaces(assignment.sockets, cx, cy);
    const chunkAccess = placeChunkAccessCorridors(chunkSpecials.tileMap, cx, cy, accessCorridorCatalogue);
    const chunkRooms = generateChunkRooms(chunkAccess.tileMap, cx, cy);
    const collisionGeometry = buildChunkCollisionGeometry(chunkRooms);
    const navigationData = buildChunkNavigationData(chunkRooms);

    return {
      ...chunkRooms,
      collisionGeometry,
      navigationData,
      assignment,
    };
  }

  function ensureChunk(cx, cy) {
    const key = coordKey(cx, cy);
    if (!chunkCache.has(key)) {
      chunkCache.set(key, generateChunk(cx, cy));
    }
    updateLoadedBounds(cx, cy);
    return chunkCache.get(key);
  }

  function ensureWindow(centerCx, centerCy, widthChunks, heightChunks) {
    const minX = centerCx - Math.floor(widthChunks / 2);
    const minY = centerCy - Math.floor(heightChunks / 2);
    const maxX = minX + widthChunks - 1;
    const maxY = minY + heightChunks - 1;

    for (let cy = minY; cy <= maxY; cy += 1) {
      for (let cx = minX; cx <= maxX; cx += 1) {
        ensureChunk(cx, cy);
      }
    }
  }

  function getLoadedBounds() {
    return { ...loadedBounds };
  }

  return {
    ensureChunk,
    ensureWindow,
    getLoadedBounds,
    getLoadedChunkCount: () => chunkCache.size,
    getLoadedAssignmentCount: () => assignments.size,
  };
}

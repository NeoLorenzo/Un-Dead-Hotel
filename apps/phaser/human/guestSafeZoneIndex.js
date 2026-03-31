const DEFAULT_SEARCH_RADIUS_TILES = 24;
const DEFAULT_AGENT_RADIUS_TILES = 0.29;
const DEFAULT_MAX_ROOM_CANDIDATES = 48;
const EPSILON = 0.000001;

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function normalizeWorldPoint(world) {
  return {
    x: Number(world?.x) || 0,
    y: Number(world?.y) || 0,
  };
}

function normalizeExcludedRoomKeys(excludedRoomKeys) {
  if (!excludedRoomKeys) {
    return new Set();
  }
  const keys = new Set();
  const values = Array.isArray(excludedRoomKeys)
    ? excludedRoomKeys
    : excludedRoomKeys instanceof Set
      ? Array.from(excludedRoomKeys)
      : [excludedRoomKeys];
  for (const value of values) {
    const key = String(value || "").trim();
    if (key.length > 0) {
      keys.add(key);
    }
  }
  return keys;
}

function buildRoomBounds(roomTiles) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const tile of roomTiles) {
    const x = Math.floor(Number(tile?.x));
    const y = Math.floor(Number(tile?.y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }
    if (x < minX) {
      minX = x;
    }
    if (y < minY) {
      minY = y;
    }
    if (x > maxX) {
      maxX = x;
    }
    if (y > maxY) {
      maxY = y;
    }
  }
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return null;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) * 0.5 + 0.5,
    centerY: (minY + maxY) * 0.5 + 0.5,
  };
}

function compareRoomTilesForAnchor(tileA, tileB, centerX, centerY) {
  const ax = Math.floor(Number(tileA?.x));
  const ay = Math.floor(Number(tileA?.y));
  const bx = Math.floor(Number(tileB?.x));
  const by = Math.floor(Number(tileB?.y));
  const distA = Math.hypot(ax + 0.5 - centerX, ay + 0.5 - centerY);
  const distB = Math.hypot(bx + 0.5 - centerX, by + 0.5 - centerY);
  if (Math.abs(distA - distB) > EPSILON) {
    return distA - distB;
  }
  if (ay !== by) {
    return ay - by;
  }
  return ax - bx;
}

export function createGuestSafeZoneIndex({
  runtime,
  searchRadiusTiles = DEFAULT_SEARCH_RADIUS_TILES,
  agentRadiusTiles = DEFAULT_AGENT_RADIUS_TILES,
  maxRoomCandidates = DEFAULT_MAX_ROOM_CANDIDATES,
} = {}) {
  if (!runtime) {
    throw new Error("createGuestSafeZoneIndex requires runtime.");
  }
  if (typeof runtime.worldToTile !== "function") {
    throw new Error("createGuestSafeZoneIndex requires runtime.worldToTile(...).");
  }
  if (typeof runtime.tileToWorldCenter !== "function") {
    throw new Error(
      "createGuestSafeZoneIndex requires runtime.tileToWorldCenter(...)."
    );
  }
  if (typeof runtime.classifyAreaAtWorld !== "function") {
    throw new Error(
      "createGuestSafeZoneIndex requires runtime.classifyAreaAtWorld(...)."
    );
  }
  if (typeof runtime.getRoomTilesAtWorld !== "function") {
    throw new Error(
      "createGuestSafeZoneIndex requires runtime.getRoomTilesAtWorld(...)."
    );
  }

  const resolvedSearchRadiusTiles = Math.max(
    1,
    Math.floor(Number(searchRadiusTiles) || DEFAULT_SEARCH_RADIUS_TILES)
  );
  const resolvedAgentRadiusTiles = Math.max(
    0,
    Number(agentRadiusTiles) || DEFAULT_AGENT_RADIUS_TILES
  );
  const resolvedMaxRoomCandidates = Math.max(
    1,
    Math.floor(Number(maxRoomCandidates) || DEFAULT_MAX_ROOM_CANDIDATES)
  );

  function isWalkableAnchorWorld(anchorWorld) {
    if (!isFiniteNumber(anchorWorld?.x) || !isFiniteNumber(anchorWorld?.y)) {
      return false;
    }
    if (typeof runtime.isWalkableWorldRect === "function") {
      return runtime.isWalkableWorldRect(
        anchorWorld.x,
        anchorWorld.y,
        resolvedAgentRadiusTiles,
        resolvedAgentRadiusTiles
      );
    }
    if (typeof runtime.isWalkableWorldPoint === "function") {
      return runtime.isWalkableWorldPoint(
        anchorWorld.x,
        anchorWorld.y,
        resolvedAgentRadiusTiles
      );
    }
    const tile = runtime.worldToTile(anchorWorld.x, anchorWorld.y);
    return runtime.isWalkableTile(tile.x, tile.y);
  }

  function resolveAnchorWorldForRoomTiles(roomTiles) {
    if (!Array.isArray(roomTiles) || roomTiles.length === 0) {
      return null;
    }
    const bounds = buildRoomBounds(roomTiles);
    if (!bounds) {
      return null;
    }
    const sortedTiles = [...roomTiles].sort((a, b) =>
      compareRoomTilesForAnchor(a, b, bounds.centerX, bounds.centerY)
    );
    for (const tile of sortedTiles) {
      const tileX = Math.floor(Number(tile?.x));
      const tileY = Math.floor(Number(tile?.y));
      if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
        continue;
      }
      const anchorWorld = runtime.tileToWorldCenter(tileX, tileY);
      if (!isWalkableAnchorWorld(anchorWorld)) {
        continue;
      }
      return {
        x: anchorWorld.x,
        y: anchorWorld.y,
      };
    }
    return null;
  }

  function findNearestSafeZoneAnchor({
    guestWorld,
    maxSearchRadiusTiles = resolvedSearchRadiusTiles,
    excludedRoomKeys = null,
  } = {}) {
    const guest = normalizeWorldPoint(guestWorld);
    if (!isFiniteNumber(guest.x) || !isFiniteNumber(guest.y)) {
      return {
        accepted: false,
        reason: "shelter_invalid_guest_world",
        selected: null,
        candidates: [],
      };
    }
    const radius = Math.max(1, Math.floor(Number(maxSearchRadiusTiles) || 1));
    const centerTile = runtime.worldToTile(guest.x, guest.y);
    const roomCandidatesByKey = new Map();
    const excludedKeys = normalizeExcludedRoomKeys(excludedRoomKeys);

    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const tileX = centerTile.x + dx;
        const tileY = centerTile.y + dy;
        const sampleWorld = runtime.tileToWorldCenter(tileX, tileY);
        const sampleDistance = Math.hypot(sampleWorld.x - guest.x, sampleWorld.y - guest.y);
        if (sampleDistance - radius > EPSILON) {
          continue;
        }
        const area = runtime.classifyAreaAtWorld(sampleWorld.x, sampleWorld.y);
        if (area?.inRoom !== true && area?.doorwayTreatedAsRoom !== true) {
          continue;
        }
        const roomData = runtime.getRoomTilesAtWorld(sampleWorld.x, sampleWorld.y);
        if (!roomData || !Array.isArray(roomData.tiles) || roomData.tiles.length <= 0) {
          continue;
        }
        const roomKey = String(roomData.roomKey || "");
        if (roomKey.length <= 0 || roomCandidatesByKey.has(roomKey)) {
          continue;
        }
        if (excludedKeys.has(roomKey)) {
          continue;
        }
        const anchorWorld = resolveAnchorWorldForRoomTiles(roomData.tiles);
        if (!anchorWorld) {
          continue;
        }
        const distanceTiles = Math.hypot(anchorWorld.x - guest.x, anchorWorld.y - guest.y);
        roomCandidatesByKey.set(roomKey, {
          roomKey,
          chunkX: Number(roomData.chunkX) || 0,
          chunkY: Number(roomData.chunkY) || 0,
          roomIndex: Number(roomData.roomIndex) || 0,
          roomTileCount: roomData.tiles.length,
          anchorWorld,
          distanceTiles,
        });
        if (roomCandidatesByKey.size >= resolvedMaxRoomCandidates) {
          break;
        }
      }
      if (roomCandidatesByKey.size >= resolvedMaxRoomCandidates) {
        break;
      }
    }

    const candidates = Array.from(roomCandidatesByKey.values()).sort((a, b) => {
      const distanceDelta = a.distanceTiles - b.distanceTiles;
      if (Math.abs(distanceDelta) > EPSILON) {
        return distanceDelta;
      }
      if (a.roomKey !== b.roomKey) {
        return a.roomKey < b.roomKey ? -1 : 1;
      }
      return 0;
    });
    const selected = candidates.length > 0 ? candidates[0] : null;
    const noSafeZoneReason =
      excludedKeys.size > 0
        ? "shelter_no_safe_zone_after_exclusion"
        : "shelter_no_safe_zone_found";

    return {
      accepted: selected != null,
      reason: selected ? "shelter_safe_zone_selected" : noSafeZoneReason,
      selected,
      candidates,
    };
  }

  return {
    getConfig: () => ({
      searchRadiusTiles: resolvedSearchRadiusTiles,
      agentRadiusTiles: resolvedAgentRadiusTiles,
      maxRoomCandidates: resolvedMaxRoomCandidates,
    }),
    findNearestSafeZoneAnchor,
  };
}

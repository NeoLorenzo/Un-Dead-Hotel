export const CHUNK_SIZE = 32;
export const CENTER_LANES = [15, 16];
export const ARTERY_SPACING = 4;
const CENTER_MIN = CENTER_LANES[0];
const CENTER_MAX = CENTER_LANES[1];
const MIN_ROOM_W = 6;
const MIN_ROOM_H = 6;
const MAX_BSP_DEPTH = 5;

export const TILE_TYPES = {
  EMPTY: 0,
  FLOOR_HALL: 1,
  FLOOR_PREFAB: 2,
  FLOOR_ROOM: 3,
  WALL: 4,
  DOOR: 5,
};

const SIDES = ["N", "S", "E", "W"];
const PREFAB_CATALOG = [
  {
    id: "gym_test",
    minZoneW: 8,
    minZoneH: 8,
    spawnChancePermille: 220, // 22%
  },
];

function fnv1a32(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function hashParts(...parts) {
  return fnv1a32(parts.join("|"));
}

function chunkSeed(worldSeed, chunkX, chunkY, generatorVersion) {
  return hashParts(worldSeed, chunkX, chunkY, `chunk_${generatorVersion}`).toString(16);
}

function neighborForSide(chunkX, chunkY, side) {
  if (side === "N") {
    return { x: chunkX, y: chunkY - 1 };
  }
  if (side === "S") {
    return { x: chunkX, y: chunkY + 1 };
  }
  if (side === "E") {
    return { x: chunkX + 1, y: chunkY };
  }
  return { x: chunkX - 1, y: chunkY };
}

function canonicalEdgeId(chunkX, chunkY, side) {
  const a = { x: chunkX, y: chunkY };
  const b = neighborForSide(chunkX, chunkY, side);
  const first = a.x < b.x || (a.x === b.x && a.y <= b.y) ? a : b;
  const second = first === a ? b : a;
  const axis = side === "E" || side === "W" ? "V" : "H";
  return `${axis}_${first.x}_${first.y}_${second.x}_${second.y}`;
}

function socketFromEdge(worldSeed, chunkX, chunkY, side, generatorVersion) {
  const edgeId = canonicalEdgeId(chunkX, chunkY, side);
  const edgeKey = hashParts(worldSeed, edgeId, `edge_${generatorVersion}`);
  const open = edgeKey % 100 < 35;
  return { edgeId, edgeKey, open };
}

function carveVerticalHall(tiles, fromY, toY) {
  const startY = Math.min(fromY, toY);
  const endY = Math.max(fromY, toY);
  for (let y = startY; y <= endY; y += 1) {
    for (const x of CENTER_LANES) {
      tiles[y * CHUNK_SIZE + x] = TILE_TYPES.FLOOR_HALL;
    }
  }
}

function carveHorizontalHall(tiles, fromX, toX) {
  const startX = Math.min(fromX, toX);
  const endX = Math.max(fromX, toX);
  for (let x = startX; x <= endX; x += 1) {
    for (const y of CENTER_LANES) {
      tiles[y * CHUNK_SIZE + x] = TILE_TYPES.FLOOR_HALL;
    }
  }
}

function carveCenterAnchor(tiles) {
  for (const y of CENTER_LANES) {
    for (const x of CENTER_LANES) {
      tiles[y * CHUNK_SIZE + x] = TILE_TYPES.FLOOR_HALL;
    }
  }
}

function isArteryBoundary(chunkX, chunkY, side) {
  if (side === "E") {
    return (chunkX + 1) % ARTERY_SPACING === 0;
  }
  if (side === "W") {
    return chunkX % ARTERY_SPACING === 0;
  }
  if (side === "S") {
    return (chunkY + 1) % ARTERY_SPACING === 0;
  }
  return chunkY % ARTERY_SPACING === 0;
}

function applyArteryOverrides(activeSockets, chunkX, chunkY, edgeMetadata) {
  for (const side of SIDES) {
    if (isArteryBoundary(chunkX, chunkY, side)) {
      activeSockets[side] = true;
      edgeMetadata[side].forcedByArtery = true;
    } else {
      edgeMetadata[side].forcedByArtery = false;
    }
  }
}

function deterministicPermille(worldSeed, chunkX, chunkY, generatorVersion, ...tags) {
  return hashParts(worldSeed, chunkX, chunkY, generatorVersion, ...tags) % 1000;
}

function deterministicIndex(mod, worldSeed, chunkX, chunkY, generatorVersion, ...tags) {
  if (mod <= 0) {
    return 0;
  }
  return hashParts(worldSeed, chunkX, chunkY, generatorVersion, ...tags) % mod;
}

function deriveRectangularZones(tiles) {
  const visited = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const zones = [];

  for (let y = 0; y < CHUNK_SIZE; y += 1) {
    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      const startIdx = y * CHUNK_SIZE + x;
      if (visited[startIdx] || tiles[startIdx] !== TILE_TYPES.EMPTY) {
        continue;
      }

      let width = 0;
      while (x + width < CHUNK_SIZE) {
        const idx = y * CHUNK_SIZE + (x + width);
        if (visited[idx] || tiles[idx] !== TILE_TYPES.EMPTY) {
          break;
        }
        width += 1;
      }

      let height = 0;
      let canExtend = true;
      while (y + height < CHUNK_SIZE && canExtend) {
        for (let dx = 0; dx < width; dx += 1) {
          const idx = (y + height) * CHUNK_SIZE + (x + dx);
          if (visited[idx] || tiles[idx] !== TILE_TYPES.EMPTY) {
            canExtend = false;
            break;
          }
        }
        if (canExtend) {
          height += 1;
        }
      }

      for (let dy = 0; dy < height; dy += 1) {
        for (let dx = 0; dx < width; dx += 1) {
          visited[(y + dy) * CHUNK_SIZE + (x + dx)] = 1;
        }
      }

      zones.push({
        x,
        y,
        w: width,
        h: height,
        area: width * height,
      });
    }
  }

  return zones;
}

function isHallTile(tiles, x, y) {
  if (x < 0 || y < 0 || x >= CHUNK_SIZE || y >= CHUNK_SIZE) {
    return false;
  }
  return tiles[y * CHUNK_SIZE + x] === TILE_TYPES.FLOOR_HALL;
}

function placePrefabFootprint(tiles, x, y, w, h) {
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      const idx = (y + dy) * CHUNK_SIZE + (x + dx);
      tiles[idx] = TILE_TYPES.FLOOR_PREFAB;
    }
  }
}

function zoneHallSides(zone, tiles) {
  let north = false;
  let south = false;
  let east = false;
  let west = false;

  for (let x = zone.x; x < zone.x + zone.w; x += 1) {
    if (isHallTile(tiles, x, zone.y - 1)) {
      north = true;
    }
    if (isHallTile(tiles, x, zone.y + zone.h)) {
      south = true;
    }
  }

  for (let y = zone.y; y < zone.y + zone.h; y += 1) {
    if (isHallTile(tiles, zone.x - 1, y)) {
      west = true;
    }
    if (isHallTile(tiles, zone.x + zone.w, y)) {
      east = true;
    }
  }

  return { N: north, S: south, E: east, W: west };
}

function placePrefabs(tiles, zones, worldSeed, chunkX, chunkY, generatorVersion) {
  const prefabs = [];
  const zonePool = zones.map((zone) => ({ ...zone }));

  for (const prefab of PREFAB_CATALOG) {
    const roll = deterministicPermille(
      worldSeed,
      chunkX,
      chunkY,
      generatorVersion,
      "prefab-roll",
      prefab.id
    );
    if (roll >= prefab.spawnChancePermille) {
      continue;
    }

    const candidates = zonePool.filter((zone) => {
      if (zone.w < prefab.minZoneW || zone.h < prefab.minZoneH) {
        return false;
      }
      const sides = zoneHallSides(zone, tiles);
      return sides.N || sides.S || sides.E || sides.W;
    });

    if (candidates.length === 0) {
      continue;
    }

    const pick = deterministicIndex(
      candidates.length,
      worldSeed,
      chunkX,
      chunkY,
      generatorVersion,
      "prefab-placement",
      prefab.id
    );
    const chosenZone = candidates[pick];
    placePrefabFootprint(tiles, chosenZone.x, chosenZone.y, chosenZone.w, chosenZone.h);

    prefabs.push({
      id: prefab.id,
      x: chosenZone.x,
      y: chosenZone.y,
      w: chosenZone.w,
      h: chosenZone.h,
      rollPermille: roll,
      mode: "full_zone",
    });

    const removeIndex = zonePool.findIndex((zone) => zone.x === chosenZone.x && zone.y === chosenZone.y);
    if (removeIndex >= 0) {
      zonePool.splice(removeIndex, 1);
    }
  }

  return prefabs;
}

function splitZoneToRooms(zone, worldSeed, chunkX, chunkY, generatorVersion, zoneIndex) {
  const leaves = [];

  function recurse(rect, depth, path) {
    const canSplitV = rect.w >= MIN_ROOM_W * 2;
    const canSplitH = rect.h >= MIN_ROOM_H * 2;
    if (depth >= MAX_BSP_DEPTH || (!canSplitV && !canSplitH)) {
      leaves.push(rect);
      return;
    }

    let orientation;
    if (canSplitV && canSplitH) {
      if (rect.w > rect.h) {
        orientation = "V";
      } else if (rect.h > rect.w) {
        orientation = "H";
      } else {
        orientation =
          deterministicIndex(2, worldSeed, chunkX, chunkY, generatorVersion, "bsp-axis", zoneIndex, path) === 0
            ? "V"
            : "H";
      }
    } else {
      orientation = canSplitV ? "V" : "H";
    }

    if (orientation === "V") {
      const minSplit = MIN_ROOM_W;
      const maxSplit = rect.w - MIN_ROOM_W;
      if (maxSplit < minSplit) {
        leaves.push(rect);
        return;
      }
      const splitOffset =
        minSplit +
        deterministicIndex(
          maxSplit - minSplit + 1,
          worldSeed,
          chunkX,
          chunkY,
          generatorVersion,
          "bsp-split-v",
          zoneIndex,
          path
        );
      recurse({ x: rect.x, y: rect.y, w: splitOffset, h: rect.h }, depth + 1, `${path}L`);
      recurse({ x: rect.x + splitOffset, y: rect.y, w: rect.w - splitOffset, h: rect.h }, depth + 1, `${path}R`);
      return;
    }

    const minSplit = MIN_ROOM_H;
    const maxSplit = rect.h - MIN_ROOM_H;
    if (maxSplit < minSplit) {
      leaves.push(rect);
      return;
    }
    const splitOffset =
      minSplit +
      deterministicIndex(
        maxSplit - minSplit + 1,
        worldSeed,
        chunkX,
        chunkY,
        generatorVersion,
        "bsp-split-h",
        zoneIndex,
        path
      );
    recurse({ x: rect.x, y: rect.y, w: rect.w, h: splitOffset }, depth + 1, `${path}T`);
    recurse({ x: rect.x, y: rect.y + splitOffset, w: rect.w, h: rect.h - splitOffset }, depth + 1, `${path}B`);
  }

  recurse({ x: zone.x, y: zone.y, w: zone.w, h: zone.h }, 0, "root");
  return leaves;
}

function carveRoom(tiles, room) {
  for (let y = room.y; y < room.y + room.h; y += 1) {
    for (let x = room.x; x < room.x + room.w; x += 1) {
      const border =
        x === room.x || x === room.x + room.w - 1 || y === room.y || y === room.y + room.h - 1;
      tiles[y * CHUNK_SIZE + x] = border ? TILE_TYPES.WALL : TILE_TYPES.FLOOR_ROOM;
    }
  }
}

function reserveHallTile(tiles, x, y) {
  if (x < 0 || y < 0 || x >= CHUNK_SIZE || y >= CHUNK_SIZE) {
    return 0;
  }
  const idx = y * CHUNK_SIZE + x;
  if (tiles[idx] !== TILE_TYPES.EMPTY) {
    return 0;
  }
  tiles[idx] = TILE_TYPES.FLOOR_HALL;
  return 1;
}

function twoLaneCenterStart(start, size) {
  if (size < 2) {
    return start;
  }
  return start + Math.floor((size - 2) / 2);
}

function reserveZoneAccessNetwork(zone, tiles) {
  if (zone.w < 2 || zone.h < 2) {
    return { reservedArea: 0, sides: { N: false, S: false, E: false, W: false } };
  }

  const sides = zoneHallSides(zone, tiles);
  if (!sides.N && !sides.S && !sides.E && !sides.W) {
    return { reservedArea: 0, sides };
  }

  const cx0 = twoLaneCenterStart(zone.x, zone.w);
  const cx1 = cx0 + 1;
  const cy0 = twoLaneCenterStart(zone.y, zone.h);
  const cy1 = cy0 + 1;
  let reservedArea = 0;

  if (sides.N) {
    for (let y = zone.y; y <= cy1; y += 1) {
      reservedArea += reserveHallTile(tiles, cx0, y);
      reservedArea += reserveHallTile(tiles, cx1, y);
    }
  }
  if (sides.S) {
    for (let y = cy0; y < zone.y + zone.h; y += 1) {
      reservedArea += reserveHallTile(tiles, cx0, y);
      reservedArea += reserveHallTile(tiles, cx1, y);
    }
  }
  if (sides.W) {
    for (let x = zone.x; x <= cx1; x += 1) {
      reservedArea += reserveHallTile(tiles, x, cy0);
      reservedArea += reserveHallTile(tiles, x, cy1);
    }
  }
  if (sides.E) {
    for (let x = cx0; x < zone.x + zone.w; x += 1) {
      reservedArea += reserveHallTile(tiles, x, cy0);
      reservedArea += reserveHallTile(tiles, x, cy1);
    }
  }

  return { reservedArea, sides };
}

function zoneTouchesHall(zone, tiles) {
  const sides = zoneHallSides(zone, tiles);
  return sides.N || sides.S || sides.E || sides.W;
}

function collectPotentialHallDoorCandidates(zoneOrRoom, tiles) {
  const candidates = [];

  for (let x = zoneOrRoom.x + 1; x <= zoneOrRoom.x + zoneOrRoom.w - 2; x += 1) {
    if (isHallTile(tiles, x, zoneOrRoom.y - 1)) {
      candidates.push({ x, y: zoneOrRoom.y });
    }
    if (isHallTile(tiles, x, zoneOrRoom.y + zoneOrRoom.h)) {
      candidates.push({ x, y: zoneOrRoom.y + zoneOrRoom.h - 1 });
    }
  }

  for (let y = zoneOrRoom.y + 1; y <= zoneOrRoom.y + zoneOrRoom.h - 2; y += 1) {
    if (isHallTile(tiles, zoneOrRoom.x - 1, y)) {
      candidates.push({ x: zoneOrRoom.x, y });
    }
    if (isHallTile(tiles, zoneOrRoom.x + zoneOrRoom.w, y)) {
      candidates.push({ x: zoneOrRoom.x + zoneOrRoom.w - 1, y });
    }
  }

  return candidates;
}

function generateBspRooms(tiles, zones, worldSeed, chunkX, chunkY, generatorVersion) {
  const rooms = [];
  const unresolvedZones = [];
  let accessReservedArea = 0;

  // Pass A: reserve 2-tile access corridors as hall-class geometry.
  for (const zone of zones) {
    const access = reserveZoneAccessNetwork(zone, tiles);
    accessReservedArea += access.reservedArea;
  }

  // Pass B: carve rooms only from remaining empty areas with hall frontage.
  const buildZones = deriveRectangularZones(tiles);

  for (let zoneIndex = 0; zoneIndex < buildZones.length; zoneIndex += 1) {
    const zone = buildZones[zoneIndex];
    if (zone.w < MIN_ROOM_W || zone.h < MIN_ROOM_H) {
      unresolvedZones.push({ ...zone, reason: "too_small" });
      continue;
    }
    if (!zoneTouchesHall(zone, tiles)) {
      unresolvedZones.push({ ...zone, reason: "no_hall_frontage" });
      continue;
    }

    const leaves = splitZoneToRooms(zone, worldSeed, chunkX, chunkY, generatorVersion, zoneIndex);
    for (let i = 0; i < leaves.length; i += 1) {
      const leaf = leaves[i];
      if (leaf.w < MIN_ROOM_W || leaf.h < MIN_ROOM_H) {
        unresolvedZones.push({ ...leaf, reason: "leaf_too_small" });
        continue;
      }

      const hallCandidates = collectPotentialHallDoorCandidates(leaf, tiles);
      if (hallCandidates.length === 0) {
        unresolvedZones.push({ ...leaf, reason: "leaf_no_hall_frontage" });
        continue;
      }

      const room = {
        id: `z${zoneIndex}r${i}`,
        zoneIndex,
        x: leaf.x,
        y: leaf.y,
        w: leaf.w,
        h: leaf.h,
        area: leaf.w * leaf.h,
        doors: [],
        connectedToHall: true,
      };

      carveRoom(tiles, room);
      const pick = deterministicIndex(
        hallCandidates.length,
        worldSeed,
        chunkX,
        chunkY,
        generatorVersion,
        "room-hall-door",
        room.id
      );
      const door = hallCandidates[pick];
      tiles[door.y * CHUNK_SIZE + door.x] = TILE_TYPES.DOOR;
      room.doors.push({ x: door.x, y: door.y, kind: "hall" });
      rooms.push(room);
    }
  }

  const roomCoverageArea = rooms.reduce((sum, room) => sum + room.area, 0);
  const allRoomsConnected = rooms.every((room) => room.connectedToHall);

  return {
    rooms,
    unresolvedZones,
    roomCoverageArea,
    allRoomsConnected,
    accessReservedArea,
    buildZones,
  };
}

export function generateChunkGeometry(chunkX, chunkY, worldSeed, generatorVersion = "v1") {
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_TYPES.EMPTY);
  const sockets = {};
  const edgeMetadata = {};

  for (const side of SIDES) {
    const result = socketFromEdge(worldSeed, chunkX, chunkY, side, generatorVersion);
    sockets[side] = result.open;
    edgeMetadata[side] = {
      edgeId: result.edgeId,
      edgeKeyHex: result.edgeKey.toString(16),
      socketFromSeed: result.open,
    };
  }

  applyArteryOverrides(sockets, chunkX, chunkY, edgeMetadata);

  if (sockets.N) {
    carveVerticalHall(tiles, 0, CENTER_MAX);
  }
  if (sockets.S) {
    carveVerticalHall(tiles, CENTER_MIN, CHUNK_SIZE - 1);
  }
  if (sockets.W) {
    carveHorizontalHall(tiles, 0, CENTER_MAX);
  }
  if (sockets.E) {
    carveHorizontalHall(tiles, CENTER_MIN, CHUNK_SIZE - 1);
  }

  if (!sockets.N && !sockets.S && !sockets.E && !sockets.W) {
    carveCenterAnchor(tiles);
  }

  const zoneCandidates = deriveRectangularZones(tiles);
  const prefabs = placePrefabs(tiles, zoneCandidates, worldSeed, chunkX, chunkY, generatorVersion);
  const zones = deriveRectangularZones(tiles);
  const roomResult = generateBspRooms(tiles, zones, worldSeed, chunkX, chunkY, generatorVersion);

  return {
    chunkX,
    chunkY,
    chunkSize: CHUNK_SIZE,
    tiles,
    prefabs,
    zoneCandidates,
    zones,
    rooms: roomResult.rooms,
    unresolvedZones: roomResult.unresolvedZones,
    roomCoverageArea: roomResult.roomCoverageArea,
    allRoomsConnected: roomResult.allRoomsConnected,
    accessReservedArea: roomResult.accessReservedArea,
    buildZones: roomResult.buildZones,
    activeSockets: sockets,
    seedInfo: {
      worldSeed,
      generatorVersion,
      chunkSeed: chunkSeed(worldSeed, chunkX, chunkY, generatorVersion),
      edges: edgeMetadata,
    },
  };
}

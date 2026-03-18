import { CHUNK_SIZE, CENTER_LANES } from "../procgen.js";

const WORLD_SEED = "undead-hotel-dev-seed";
const GENERATOR_VERSION = "v1";
const NEXTGEN_SEED = `${WORLD_SEED}|corridor-tiles|${GENERATOR_VERSION}`;
const NEXTGEN_CHUNKS_X = 6;
const NEXTGEN_CHUNKS_Y = 6;
const NEXTGEN_ORIGIN_X = -3;
const NEXTGEN_ORIGIN_Y = -3;
const NEXTGEN_VIEW_SCALE = 1.4;

const TILE_PIXELS = 3;
const CORRIDOR_TILE_PIXEL = 3;
const ACCESS_CORRIDOR_TILE_PIXEL = 4;
const ROOM_PREFAB_TILE_PIXEL = 8;
const CORRIDOR_SIDES = ["N", "E", "S", "W"];
const NEXTGEN_MAX_CONNECT_PASSES = 24;
const NEXTGEN_MAX_REROLLS_PER_CHUNK = 64;
const MAX_ACCESS_PLACEMENT_PASSES = 8;
const WORLD_PREVIEW_CHUNKS_X = 20;
const WORLD_PREVIEW_CHUNKS_Y = 20;
const WORLD_PREVIEW_TILE_PIXELS = 2;
const WORLD_PREVIEW_ORIGIN_X = -10;
const WORLD_PREVIEW_ORIGIN_Y = -10;
const TILE_ACCESS_RESERVED = 9;
const TILE_ROOM_FLOOR = 10;
const TILE_ROOM_WALL = 11;
const TILE_ROOM_DOOR = 12;
const ROOM_PREFAB_CELL_FLOOR = 1;
const ROOM_PREFAB_CELL_WALL = 2;
const ROOM_THIN_WALL_RATIO = 0.2;
const ROOM_GROWTH_MIN_REAR_CLEARANCE = 2;
const MIN_ROOM_SIZE = 4;
const TARGET_ROOM_SIZE = 8;
const SPECIAL_SPACE_CHANCE_PERMILLE = 30; // 30%
const SPECIAL_SPACE_DEFS = [
  { id: "terrace", label: "Terrace", w: 15, h: 32, color: "#8fd3ff" },
  { id: "restaurant", label: "Restaurant", w: 15, h: 32, color: "#ffc97a" },
  {
    id: "gym",
    label: "Gym",
    sizes: [
      { w: 15, h: 15 },
      { w: 32, h: 15 },
    ],
    color: "#9cf29c",
  },
  { id: "kitchen", label: "Kitchen", w: 15, h: 7, topBottomEdgeOnly: true, color: "#ff9ea8" },
  { id: "spa", label: "SPA", w: 15, h: 7, topBottomEdgeOnly: true, color: "#d8b4ff" },
];
const CARDINAL_NEIGHBORS = [
  { side: "N", dx: 0, dy: -1, opposite: "S" },
  { side: "E", dx: 1, dy: 0, opposite: "W" },
  { side: "S", dx: 0, dy: 1, opposite: "N" },
  { side: "W", dx: -1, dy: 0, opposite: "E" },
];
const ACCESS_CORRIDOR_FOOTPRINTS = [
  { set: "Set 1", w: 17, h: 15 },
  { set: "Set 1", w: 15, h: 17 },
  { set: "Set 2", w: 15, h: 15 },
  { set: "Set 3", w: 32, h: 15 },
  { set: "Set 3", w: 15, h: 32 },
  { set: "Set 4", w: 15, h: 8 },
];
const DISABLED_ACCESS_TILE_KEYS = new Set([
  "Set 3|3",
  "Set 1|5",
  "Set 1|4",
  "Set 2|5",
  "Set 2|4",
]);
const ROOM_PREFAB_CATALOG = [
  buildRoomPrefabDefinition("R01", 4, 5),
  buildRoomPrefabDefinition("R02", 6, 5),
  buildRoomPrefabDefinition("R03", 8, 5),
  buildRoomPrefabDefinition("R04", 10, 5),
];
const ROOM_PREFAB_VARIANTS = buildRoomPrefabVariants(ROOM_PREFAB_CATALOG);


function coordKey(x, y) {
  return `${x},${y}`;
}

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

function seededIndex(mod, ...parts) {
  if (mod <= 0) {
    return 0;
  }
  return hashParts(...parts) % mod;
}

function buildRoomPrefabTileMap(w, h) {
  const tileMap = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const isWall = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      tileMap[y * w + x] = isWall ? ROOM_PREFAB_CELL_WALL : ROOM_PREFAB_CELL_FLOOR;
    }
  }
  return tileMap;
}

function buildRoomPrefabDefinition(id, w, h) {
  return {
    id,
    w,
    h,
    area: w * h,
    tileMap: buildRoomPrefabTileMap(w, h),
  };
}

function rotateRoomPrefabTileMapClockwise(tileMap, w, h) {
  const rotatedW = h;
  const rotatedH = w;
  const rotated = new Uint8Array(rotatedW * rotatedH);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const nx = h - 1 - y;
      const ny = x;
      rotated[ny * rotatedW + nx] = tileMap[y * w + x];
    }
  }

  return { tileMap: rotated, w: rotatedW, h: rotatedH };
}

function buildRoomPrefabVariants(prefabs) {
  const variants = [];
  for (const prefab of prefabs) {
    variants.push({
      id: prefab.id,
      baseId: prefab.id,
      w: prefab.w,
      h: prefab.h,
      area: prefab.area,
      rotationTurns: 0,
      tileMap: prefab.tileMap,
    });
    if (prefab.w !== prefab.h) {
      const rotated = rotateRoomPrefabTileMapClockwise(prefab.tileMap, prefab.w, prefab.h);
      variants.push({
        id: `${prefab.id}_R90`,
        baseId: prefab.id,
        w: rotated.w,
        h: rotated.h,
        area: prefab.area,
        rotationTurns: 1,
        tileMap: rotated.tileMap,
      });
    }
  }
  return variants;
}

function buildCorridorTilePatterns() {
  const patterns = [];
  const seenRotationFamilies = new Set();

  function rotateMaskClockwise(mask) {
    let rotated = 0;
    if (mask & 1) rotated |= 2; // N -> E
    if (mask & 2) rotated |= 4; // E -> S
    if (mask & 4) rotated |= 8; // S -> W
    if (mask & 8) rotated |= 1; // W -> N
    return rotated;
  }

  function rotationCanonicalMask(mask) {
    let current = mask;
    let minMask = mask;
    for (let i = 0; i < 3; i += 1) {
      current = rotateMaskClockwise(current);
      minMask = Math.min(minMask, current);
    }
    return minMask;
  }

  for (let mask = 1; mask <= 15; mask += 1) {
    const familyKey = rotationCanonicalMask(mask);
    if (seenRotationFamilies.has(familyKey)) {
      continue;
    }
    seenRotationFamilies.add(familyKey);

    const sockets = {
      N: (mask & 1) !== 0,
      E: (mask & 2) !== 0,
      S: (mask & 4) !== 0,
      W: (mask & 8) !== 0,
    };
    const openSides = CORRIDOR_SIDES.filter((side) => sockets[side]);
    patterns.push({
      id: mask.toString().padStart(2, "0"),
      sockets,
      openSides,
      corridorCount: openSides.length,
    });
  }
  patterns.sort((a, b) => a.corridorCount - b.corridorCount || a.id.localeCompare(b.id));
  return patterns.map((pattern, index) => ({
    ...pattern,
    id: String(index + 1),
  }));
}

function carveCorridorTileGrid(sockets) {
  const grid = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const centerMin = CENTER_LANES[0];
  const centerMax = CENTER_LANES[1];

  for (let y = centerMin; y <= centerMax; y += 1) {
    for (let x = centerMin; x <= centerMax; x += 1) {
      grid[y * CHUNK_SIZE + x] = 1;
    }
  }

  if (sockets.N) {
    for (let y = 0; y <= centerMax; y += 1) {
      for (const x of CENTER_LANES) {
        grid[y * CHUNK_SIZE + x] = 1;
      }
    }
  }
  if (sockets.S) {
    for (let y = centerMin; y < CHUNK_SIZE; y += 1) {
      for (const x of CENTER_LANES) {
        grid[y * CHUNK_SIZE + x] = 1;
      }
    }
  }
  if (sockets.W) {
    for (let x = 0; x <= centerMax; x += 1) {
      for (const y of CENTER_LANES) {
        grid[y * CHUNK_SIZE + x] = 1;
      }
    }
  }
  if (sockets.E) {
    for (let x = centerMin; x < CHUNK_SIZE; x += 1) {
      for (const y of CENTER_LANES) {
        grid[y * CHUNK_SIZE + x] = 1;
      }
    }
  }

  return grid;
}

function drawCorridorTilePreview(canvasEl, sockets) {
  const previewSize = CHUNK_SIZE * CORRIDOR_TILE_PIXEL;
  canvasEl.width = previewSize;
  canvasEl.height = previewSize;
  const previewCtx = canvasEl.getContext("2d");
  const tileMap = carveCorridorTileGrid(sockets);

  for (let y = 0; y < CHUNK_SIZE; y += 1) {
    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      const filled = tileMap[y * CHUNK_SIZE + x] === 1;
      previewCtx.fillStyle = filled ? "#1f1f1f" : "#ffffff";
      previewCtx.fillRect(
        x * CORRIDOR_TILE_PIXEL,
        y * CORRIDOR_TILE_PIXEL,
        CORRIDOR_TILE_PIXEL,
        CORRIDOR_TILE_PIXEL
      );
    }
  }

  previewCtx.strokeStyle = "#888888";
  previewCtx.lineWidth = 1;
  previewCtx.strokeRect(0.5, 0.5, previewSize - 1, previewSize - 1);
}

function twoLaneCenterStart(size) {
  if (size < 2) {
    return 0;
  }
  return Math.floor((size - 2) / 2);
}

function carveAccessCorridorTileGrid(width, height, sockets, isBlank = false, metadata = {}) {
  const grid = new Uint8Array(width * height);
  if (isBlank) {
    return grid;
  }
  const cx0 = twoLaneCenterStart(width);
  const cx1 = cx0 + 1;
  const cy0 = twoLaneCenterStart(height);
  const cy1 = cy0 + 1;

  for (let y = cy0; y <= cy1; y += 1) {
    for (let x = cx0; x <= cx1; x += 1) {
      grid[y * width + x] = 1;
    }
  }

  if (sockets.N) {
    for (let y = 0; y <= cy1; y += 1) {
      grid[y * width + cx0] = 1;
      grid[y * width + cx1] = 1;
    }
  }
  if (sockets.S) {
    for (let y = cy0; y < height; y += 1) {
      grid[y * width + cx0] = 1;
      grid[y * width + cx1] = 1;
    }
  }
  if (sockets.W) {
    for (let x = 0; x <= cx1; x += 1) {
      grid[cy0 * width + x] = 1;
      grid[cy1 * width + x] = 1;
    }
  }
  if (sockets.E) {
    for (let x = cx0; x < width; x += 1) {
      grid[cy0 * width + x] = 1;
      grid[cy1 * width + x] = 1;
    }
  }

  const isSet3Tile1Wide =
    width === 32 &&
    height === 15 &&
    String(metadata.tileId) === "1";

  if (isSet3Tile1Wide) {
    const leftLen = Math.max(1, Math.floor((cx0 + 1) / 2));
    const rightLen = Math.max(1, Math.floor((width - cx1) / 2));

    const leftStart = Math.max(0, cx0 - leftLen);
    const leftEnd = cx0 - 1;
    for (let x = leftStart; x <= leftEnd; x += 1) {
      grid[cy0 * width + x] = 1;
      grid[cy1 * width + x] = 1;
    }

    const rightStart = cx1 + 1;
    const rightEnd = Math.min(width - 1, cx1 + rightLen);
    for (let x = rightStart; x <= rightEnd; x += 1) {
      grid[cy0 * width + x] = 1;
      grid[cy1 * width + x] = 1;
    }
  }

  return grid;
}

function drawAccessCorridorTilePreview(canvasEl, entry) {
  canvasEl.width = entry.w * ACCESS_CORRIDOR_TILE_PIXEL;
  canvasEl.height = entry.h * ACCESS_CORRIDOR_TILE_PIXEL;
  const previewCtx = canvasEl.getContext("2d");
  const tileMap = entry.tileMap;

  for (let y = 0; y < entry.h; y += 1) {
    for (let x = 0; x < entry.w; x += 1) {
      const filled = tileMap[y * entry.w + x] === 1;
      previewCtx.fillStyle = filled ? "#1f1f1f" : "#ffffff";
      previewCtx.fillRect(
        x * ACCESS_CORRIDOR_TILE_PIXEL,
        y * ACCESS_CORRIDOR_TILE_PIXEL,
        ACCESS_CORRIDOR_TILE_PIXEL,
        ACCESS_CORRIDOR_TILE_PIXEL
      );
    }
  }

  previewCtx.strokeStyle = "#888888";
  previewCtx.lineWidth = 1;
  previewCtx.strokeRect(0.5, 0.5, canvasEl.width - 1, canvasEl.height - 1);
}

function isAccessTileDisabled(setLabel, tileId, variant = "", footprint = null) {
  if (
    setLabel === "Set 3" &&
    String(tileId) === "1" &&
    footprint &&
    footprint.w === 15 &&
    footprint.h === 32
  ) {
    return true;
  }
  if (variant && DISABLED_ACCESS_TILE_KEYS.has(`${setLabel}|${tileId}|${variant}`)) {
    return true;
  }
  return DISABLED_ACCESS_TILE_KEYS.has(`${setLabel}|${tileId}`);
}

function accessPatternsForSet(setLabel, basePatterns) {
  if (setLabel !== "Set 4") {
    return basePatterns;
  }

  return [
    {
      id: "BLANK",
      variant: "",
      sockets: { N: false, E: false, S: false, W: false },
      openSides: [],
      corridorCount: 0,
      isBlank: true,
    },
  ];
}

function footprintKey(footprint) {
  return `${footprint.set}|${footprint.w}x${footprint.h}`;
}

function buildAccessCorridorCatalogue(basePatterns) {
  const entries = [];

  for (const footprint of ACCESS_CORRIDOR_FOOTPRINTS) {
    const patternsForFootprint = accessPatternsForSet(footprint.set, basePatterns);
    for (const pattern of patternsForFootprint) {
      if (isAccessTileDisabled(footprint.set, pattern.id, pattern.variant || "", footprint)) {
        continue;
      }

      entries.push({
        set: footprint.set,
        w: footprint.w,
        h: footprint.h,
        key: footprintKey(footprint),
        tileId: pattern.id,
        tileVariant: pattern.variant || "",
        isBlank: pattern.isBlank === true,
        sockets: pattern.sockets,
        openSides: pattern.openSides,
        tileMap: carveAccessCorridorTileGrid(
          footprint.w,
          footprint.h,
          pattern.sockets,
          pattern.isBlank === true,
          { set: footprint.set, tileId: pattern.id }
        ),
      });
    }
  }

  return entries;
}

function rotateSocketsClockwise(sockets) {
  return {
    N: sockets.W,
    E: sockets.N,
    S: sockets.E,
    W: sockets.S,
  };
}

function rotateSockets(sockets, turns) {
  let rotated = { ...sockets };
  for (let i = 0; i < turns; i += 1) {
    rotated = rotateSocketsClockwise(rotated);
  }
  return rotated;
}

function chunkBoundsFromRadius(radius) {
  return {
    minX: -radius,
    maxX: radius,
    minY: -radius,
    maxY: radius,
  };
}

function nextgenBounds() {
  return {
    minX: NEXTGEN_ORIGIN_X,
    maxX: NEXTGEN_ORIGIN_X + NEXTGEN_CHUNKS_X - 1,
    minY: NEXTGEN_ORIGIN_Y,
    maxY: NEXTGEN_ORIGIN_Y + NEXTGEN_CHUNKS_Y - 1,
  };
}

function drawThinExteriorWallsForRooms(
  ctx,
  originX,
  originY,
  rooms,
  tileMap,
  mapWidth,
  tilePixel,
  wallTile,
  doorTile = -1,
  thicknessRatio = ROOM_THIN_WALL_RATIO
) {
  const thickness = Math.max(1, Math.round(tilePixel * thicknessRatio));
  ctx.fillStyle = "#8f8f8f";
  for (const room of rooms) {
    const xMin = room.x;
    const xMax = room.x + room.w - 1;
    const yMin = room.y;
    const yMax = room.y + room.h - 1;

    for (let x = xMin; x <= xMax; x += 1) {
      const topIdx = yMin * mapWidth + x;
      if (tileMap[topIdx] === wallTile && tileMap[topIdx] !== doorTile) {
        ctx.fillRect(
          originX + x * tilePixel,
          originY + yMin * tilePixel,
          tilePixel,
          thickness
        );
      }

      const bottomIdx = yMax * mapWidth + x;
      if (tileMap[bottomIdx] === wallTile && tileMap[bottomIdx] !== doorTile) {
        ctx.fillRect(
          originX + x * tilePixel,
          originY + (yMax + 1) * tilePixel - thickness,
          tilePixel,
          thickness
        );
      }
    }

    for (let y = yMin; y <= yMax; y += 1) {
      const leftIdx = y * mapWidth + xMin;
      if (tileMap[leftIdx] === wallTile && tileMap[leftIdx] !== doorTile) {
        ctx.fillRect(
          originX + xMin * tilePixel,
          originY + y * tilePixel,
          thickness,
          tilePixel
        );
      }

      const rightIdx = y * mapWidth + xMax;
      if (tileMap[rightIdx] === wallTile && tileMap[rightIdx] !== doorTile) {
        ctx.fillRect(
          originX + (xMax + 1) * tilePixel - thickness,
          originY + y * tilePixel,
          thickness,
          tilePixel
        );
      }
    }
  }
}

function drawCorridorChunk(nextCtx, originX, originY, chunkInput, tilePixel = TILE_PIXELS, drawBorder = true) {
  let tileMap;
  let roomList = [];
  if (chunkInput instanceof Uint8Array) {
    tileMap = chunkInput;
  } else if (chunkInput && chunkInput.tileMap instanceof Uint8Array) {
    tileMap = chunkInput.tileMap;
    if (Array.isArray(chunkInput.rooms)) {
      roomList = chunkInput.rooms;
    }
  } else {
    tileMap = carveCorridorTileGrid(chunkInput);
  }

  for (let y = 0; y < CHUNK_SIZE; y += 1) {
    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      const tile = tileMap[y * CHUNK_SIZE + x];
      let color = "#8f8f8f";
      if (tile === 1) {
        color = "#1f1f1f";
      } else if (tile === TILE_ACCESS_RESERVED) {
        color = "#8f8f8f";
      } else if (tile === TILE_ROOM_FLOOR) {
        color = "#efefef";
      } else if (tile === TILE_ROOM_WALL) {
        color = "#efefef";
      } else if (tile === TILE_ROOM_DOOR) {
        color = "#ff9100";
      } else if (tile >= 2 && tile < 2 + SPECIAL_SPACE_DEFS.length) {
        const special = SPECIAL_SPACE_DEFS[tile - 2];
        color = special ? special.color : "#ffffff";
      }
      nextCtx.fillStyle = color;
      nextCtx.fillRect(
        originX + x * tilePixel,
        originY + y * tilePixel,
        tilePixel,
        tilePixel
      );
    }
  }

  if (roomList.length > 0) {
    drawThinExteriorWallsForRooms(
      nextCtx,
      originX,
      originY,
      roomList,
      tileMap,
      CHUNK_SIZE,
      tilePixel,
      TILE_ROOM_WALL,
      TILE_ROOM_DOOR
    );
  }

  if (drawBorder) {
    nextCtx.strokeStyle = "#888888";
    nextCtx.lineWidth = 1;
    nextCtx.strokeRect(
      originX + 0.5,
      originY + 0.5,
      CHUNK_SIZE * tilePixel - 1,
      CHUNK_SIZE * tilePixel - 1
    );
  }
}

function deriveEmptySpaces(tileMap) {
  const visited = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const spaces = [];

  for (let y = 0; y < CHUNK_SIZE; y += 1) {
    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      const startIdx = y * CHUNK_SIZE + x;
      if (visited[startIdx] || tileMap[startIdx] !== 0) {
        continue;
      }

      let width = 0;
      while (x + width < CHUNK_SIZE) {
        const idx = y * CHUNK_SIZE + (x + width);
        if (visited[idx] || tileMap[idx] !== 0) {
          break;
        }
        width += 1;
      }

      let height = 0;
      let canExtend = true;
      while (y + height < CHUNK_SIZE && canExtend) {
        for (let dx = 0; dx < width; dx += 1) {
          const idx = (y + height) * CHUNK_SIZE + (x + dx);
          if (visited[idx] || tileMap[idx] !== 0) {
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

      spaces.push({
        x,
        y,
        w: width,
        h: height,
        area: width * height,
      });
    }
  }

  return spaces;
}

function isRoomFillableTile(tile) {
  return tile === 0 || tile === TILE_ACCESS_RESERVED;
}

function deriveRoomFillSpaces(tileMap) {
  const visited = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const spaces = [];

  for (let y = 0; y < CHUNK_SIZE; y += 1) {
    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      const startIdx = y * CHUNK_SIZE + x;
      if (visited[startIdx] || !isRoomFillableTile(tileMap[startIdx])) {
        continue;
      }

      let width = 0;
      while (x + width < CHUNK_SIZE) {
        const idx = y * CHUNK_SIZE + (x + width);
        if (visited[idx] || !isRoomFillableTile(tileMap[idx])) {
          break;
        }
        width += 1;
      }

      let height = 0;
      let canExtend = true;
      while (y + height < CHUNK_SIZE && canExtend) {
        for (let dx = 0; dx < width; dx += 1) {
          const idx = (y + height) * CHUNK_SIZE + (x + dx);
          if (visited[idx] || !isRoomFillableTile(tileMap[idx])) {
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

      spaces.push({
        x,
        y,
        w: width,
        h: height,
        area: width * height,
      });
    }
  }

  return spaces;
}

function pickBetterRoomTilingCandidate(best, candidate) {
  if (candidate.coveredArea !== best.coveredArea) {
    return candidate.coveredArea > best.coveredArea ? candidate : best;
  }
  if (candidate.roomCount !== best.roomCount) {
    return candidate.roomCount < best.roomCount ? candidate : best;
  }
  return candidate.tieBreaker < best.tieBreaker ? candidate : best;
}

function tileZoneWithRoomPrefabs(zone, cx, cy, zoneIndex) {
  const memo = new Map();

  function solve(width, height) {
    const key = `${width}x${height}`;
    if (memo.has(key)) {
      return memo.get(key);
    }

    let best = {
      kind: "none",
      coveredArea: 0,
      roomCount: 0,
      tieBreaker: Number.MAX_SAFE_INTEGER,
    };

    for (const variant of ROOM_PREFAB_VARIANTS) {
      if (variant.w !== width || variant.h !== height) {
        continue;
      }

      const candidate = {
        kind: "prefab",
        coveredArea: variant.area,
        roomCount: 1,
        tieBreaker: hashParts(
          NEXTGEN_SEED,
          cx,
          cy,
          "prefab-fit",
          zoneIndex,
          width,
          height,
          variant.id
        ),
        variant,
      };
      best = pickBetterRoomTilingCandidate(best, candidate);
    }

    for (let split = 1; split < width; split += 1) {
      const left = solve(split, height);
      const right = solve(width - split, height);
      const candidate = {
        kind: "splitV",
        coveredArea: left.coveredArea + right.coveredArea,
        roomCount: left.roomCount + right.roomCount,
        tieBreaker: hashParts(
          NEXTGEN_SEED,
          cx,
          cy,
          "prefab-split-v",
          zoneIndex,
          width,
          height,
          split,
          left.tieBreaker,
          right.tieBreaker
        ),
        split,
        left,
        right,
      };
      best = pickBetterRoomTilingCandidate(best, candidate);
    }

    for (let split = 1; split < height; split += 1) {
      const top = solve(width, split);
      const bottom = solve(width, height - split);
      const candidate = {
        kind: "splitH",
        coveredArea: top.coveredArea + bottom.coveredArea,
        roomCount: top.roomCount + bottom.roomCount,
        tieBreaker: hashParts(
          NEXTGEN_SEED,
          cx,
          cy,
          "prefab-split-h",
          zoneIndex,
          width,
          height,
          split,
          top.tieBreaker,
          bottom.tieBreaker
        ),
        split,
        top,
        bottom,
      };
      best = pickBetterRoomTilingCandidate(best, candidate);
    }

    memo.set(key, best);
    return best;
  }

  function emitRooms(node, localX, localY, output) {
    if (!node || node.coveredArea <= 0) {
      return;
    }
    if (node.kind === "prefab") {
      output.push({
        x: zone.x + localX,
        y: zone.y + localY,
        w: node.variant.w,
        h: node.variant.h,
        prefabId: node.variant.baseId,
        rotationTurns: node.variant.rotationTurns,
        prefabTileMap: node.variant.tileMap,
      });
      return;
    }
    if (node.kind === "splitV") {
      emitRooms(node.left, localX, localY, output);
      emitRooms(node.right, localX + node.split, localY, output);
      return;
    }
    if (node.kind === "splitH") {
      emitRooms(node.top, localX, localY, output);
      emitRooms(node.bottom, localX, localY + node.split, output);
    }
  }

  const solved = solve(zone.w, zone.h);
  const rooms = [];
  emitRooms(solved, 0, 0, rooms);
  return {
    rooms,
    coveredArea: solved.coveredArea,
    uncoveredArea: zone.area - solved.coveredArea,
  };
}

function roomOverlapsOccupied(room, occupied, zone) {
  for (let dy = 0; dy < room.h; dy += 1) {
    for (let dx = 0; dx < room.w; dx += 1) {
      const localX = room.x - zone.x + dx;
      const localY = room.y - zone.y + dy;
      if (occupied[localY * zone.w + localX] === 1) {
        return true;
      }
    }
  }
  return false;
}

function markRoomOccupied(room, occupied, zone) {
  for (let dy = 0; dy < room.h; dy += 1) {
    for (let dx = 0; dx < room.w; dx += 1) {
      const localX = room.x - zone.x + dx;
      const localY = room.y - zone.y + dy;
      occupied[localY * zone.w + localX] = 1;
    }
  }
}

function collectCorridorAccessibleRoomCandidates(zone, baseTileMap, cx, cy, zoneIndex) {
  const candidates = [];

  for (const variant of ROOM_PREFAB_VARIANTS) {
    const xMax = zone.x + zone.w - variant.w;
    const yMax = zone.y + zone.h - variant.h;
    if (xMax < zone.x || yMax < zone.y) {
      continue;
    }

    for (let y = zone.y; y <= yMax; y += 1) {
      for (let x = zone.x; x <= xMax; x += 1) {
        const room = {
          x,
          y,
          w: variant.w,
          h: variant.h,
          prefabId: variant.baseId,
          rotationTurns: variant.rotationTurns,
          prefabTileMap: variant.tileMap,
        };
        const doorBySide = collectCorridorDoorCandidatesBySide(baseTileMap, room);
        const doorCandidates = [...doorBySide.N, ...doorBySide.E, ...doorBySide.S, ...doorBySide.W];
        if (doorCandidates.length === 0) {
          continue;
        }
        const shortDoorCandidates = [];
        for (const side of shortSideDirections(room)) {
          shortDoorCandidates.push(...doorBySide[side]);
        }

        candidates.push({
          ...room,
          doorCandidates,
          shortSideDoorCandidates: shortDoorCandidates,
          candidateOrder: candidates.length,
          tie: hashParts(
            NEXTGEN_SEED,
            cx,
            cy,
            "room-candidate",
            zoneIndex,
            variant.id,
            x,
            y
          ),
        });
      }
    }
  }

  return candidates;
}

function scoreRoomSelection(roomList) {
  let area = 0;
  for (const room of roomList) {
    area += room.w * room.h;
  }
  return { area, count: roomList.length };
}

function chooseBetterRoomSelection(currentBest, candidate) {
  if (!currentBest) {
    return candidate;
  }
  if (candidate.score.area !== currentBest.score.area) {
    return candidate.score.area > currentBest.score.area ? candidate : currentBest;
  }
  if (candidate.score.count !== currentBest.score.count) {
    return candidate.score.count < currentBest.score.count ? candidate : currentBest;
  }
  return candidate.orderTag < currentBest.orderTag ? candidate : currentBest;
}

function placeCorridorAccessibleRoomsInZone(zone, baseTileMap, cx, cy, zoneIndex) {
  const candidates = collectCorridorAccessibleRoomCandidates(zone, baseTileMap, cx, cy, zoneIndex);
  if (candidates.length === 0) {
    return { rooms: [], uncoveredArea: zone.area };
  }
  const preferredCandidates = candidates.filter((candidate) => candidate.shortSideDoorCandidates.length > 0);
  const candidatePool = preferredCandidates.length > 0 ? preferredCandidates : candidates;

  const orderings = [
    {
      tag: 0,
      compare: (a, b) =>
        b.shortSideDoorCandidates.length - a.shortSideDoorCandidates.length ||
        b.w * b.h - a.w * a.h ||
        b.doorCandidates.length - a.doorCandidates.length ||
        a.tie - b.tie,
    },
    {
      tag: 1,
      compare: (a, b) =>
        b.shortSideDoorCandidates.length - a.shortSideDoorCandidates.length ||
        b.doorCandidates.length - a.doorCandidates.length ||
        b.w * b.h - a.w * a.h ||
        a.tie - b.tie,
    },
    {
      tag: 2,
      compare: (a, b) =>
        b.shortSideDoorCandidates.length - a.shortSideDoorCandidates.length ||
        a.y - b.y ||
        a.x - b.x ||
        b.w * b.h - a.w * a.h ||
        a.tie - b.tie,
    },
    {
      tag: 3,
      compare: (a, b) =>
        b.shortSideDoorCandidates.length - a.shortSideDoorCandidates.length ||
        a.w * a.h - b.w * b.h ||
        a.tie - b.tie,
    },
  ];

  let best = null;
  for (const ordering of orderings) {
    const occupied = new Uint8Array(zone.w * zone.h);
    const selected = [];
    const ordered = [...candidatePool].sort(ordering.compare);

    for (const candidate of ordered) {
      if (roomOverlapsOccupied(candidate, occupied, zone)) {
        continue;
      }
      selected.push(candidate);
      markRoomOccupied(candidate, occupied, zone);
    }

    best = chooseBetterRoomSelection(best, {
      rooms: selected,
      score: scoreRoomSelection(selected),
      orderTag: ordering.tag,
    });
  }

  const chosenRooms = best ? best.rooms : [];
  const coveredArea = chosenRooms.reduce((sum, room) => sum + room.w * room.h, 0);
  return {
    rooms: chosenRooms,
    uncoveredArea: zone.area - coveredArea,
  };
}

function buildRemainingRoomFillMap(baseTileMap, rooms) {
  const fillMap = baseTileMap.slice();
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.h; y += 1) {
      for (let x = room.x; x < room.x + room.w; x += 1) {
        const idx = y * CHUNK_SIZE + x;
        if (isRoomFillableTile(fillMap[idx])) {
          fillMap[idx] = TILE_ROOM_FLOOR;
        }
      }
    }
  }
  return fillMap;
}

function runAdditionalRoomPlacementPass(rooms, baseTileMap, cx, cy) {
  const fillMap = buildRemainingRoomFillMap(baseTileMap, rooms);
  const leftoverZones = deriveRoomFillSpaces(fillMap);
  const extraRooms = [];
  const zoneIndexOffset = 10000;

  for (let zoneIndex = 0; zoneIndex < leftoverZones.length; zoneIndex += 1) {
    const zone = leftoverZones[zoneIndex];
    const placed = placeCorridorAccessibleRoomsInZone(
      zone,
      baseTileMap,
      cx,
      cy,
      zoneIndexOffset + zoneIndex
    );
    extraRooms.push(...placed.rooms);
  }

  return extraRooms;
}

function partitionSpanIntoRooms(span) {
  if (span <= 0) {
    return [];
  }
  if (span < MIN_ROOM_SIZE) {
    return [span];
  }

  let count = Math.max(1, Math.round(span / TARGET_ROOM_SIZE));
  while (count > 1 && Math.floor(span / count) < MIN_ROOM_SIZE) {
    count -= 1;
  }

  const base = Math.floor(span / count);
  const remainder = span % count;
  if (base < MIN_ROOM_SIZE) {
    return [span];
  }

  const sizes = [];
  for (let i = 0; i < count; i += 1) {
    sizes.push(base + (i < remainder ? 1 : 0));
  }
  return sizes;
}

function buildRoomsForZone(zone) {
  const widths = partitionSpanIntoRooms(zone.w);
  const heights = partitionSpanIntoRooms(zone.h);
  if (widths.length === 0 || heights.length === 0) {
    return [];
  }

  const rooms = [];
  let y = zone.y;
  for (const h of heights) {
    let x = zone.x;
    for (const w of widths) {
      rooms.push({ x, y, w, h });
      x += w;
    }
    y += h;
  }
  return rooms;
}

function roomArea(room) {
  return room.w * room.h;
}

function collectCorridorDoorCandidatesBySide(tileMap, room) {
  const bySide = {
    N: [],
    S: [],
    E: [],
    W: [],
  };

  for (let x = room.x + 1; x < room.x + room.w - 1; x += 1) {
    const yTop = room.y;
    const yBottom = room.y + room.h - 1;
    if (isCorridorTile(tileMap, x, yTop - 1)) {
      bySide.N.push({ x, y: yTop });
    }
    if (isCorridorTile(tileMap, x, yBottom + 1)) {
      bySide.S.push({ x, y: yBottom });
    }
  }

  for (let y = room.y + 1; y < room.y + room.h - 1; y += 1) {
    const xLeft = room.x;
    const xRight = room.x + room.w - 1;
    if (isCorridorTile(tileMap, xLeft - 1, y)) {
      bySide.W.push({ x: xLeft, y });
    }
    if (isCorridorTile(tileMap, xRight + 1, y)) {
      bySide.E.push({ x: xRight, y });
    }
  }

  return bySide;
}

function collectCorridorDoorCandidates(tileMap, room) {
  const bySide = collectCorridorDoorCandidatesBySide(tileMap, room);
  return [...bySide.N, ...bySide.E, ...bySide.S, ...bySide.W];
}

function shortSideDirections(room) {
  if (room.w < room.h) {
    return ["N", "S"];
  }
  if (room.h < room.w) {
    return ["E", "W"];
  }
  return ["N", "E", "S", "W"];
}

function oppositeSide(side) {
  if (side === "N") {
    return "S";
  }
  if (side === "S") {
    return "N";
  }
  if (side === "E") {
    return "W";
  }
  return "E";
}

function findRoomPrefabVariant(baseId, rotationTurns) {
  return ROOM_PREFAB_VARIANTS.find(
    (variant) => variant.baseId === baseId && variant.rotationTurns === rotationTurns
  );
}

function findNextRoomPrefabVariant(room) {
  const index = ROOM_PREFAB_CATALOG.findIndex((prefab) => prefab.id === room.prefabId);
  if (index < 0 || index >= ROOM_PREFAB_CATALOG.length - 1) {
    return null;
  }
  const nextId = ROOM_PREFAB_CATALOG[index + 1].id;
  return findRoomPrefabVariant(nextId, room.rotationTurns);
}

function markRoomOnChunkOccupancy(occupancy, room, value) {
  for (let y = room.y; y < room.y + room.h; y += 1) {
    for (let x = room.x; x < room.x + room.w; x += 1) {
      occupancy[y * CHUNK_SIZE + x] = value;
    }
  }
}

function pickDoorSideForRoomGrowth(room, doorBySide, compatibleDoorSides, cx, cy, roomIndex) {
  const allSides = ["N", "E", "S", "W"];
  const shortSides = shortSideDirections(room);
  const compatible = compatibleDoorSides && compatibleDoorSides.length > 0 ? compatibleDoorSides : allSides;

  const groups = [
    shortSides.filter((side) => compatible.includes(side)),
    compatible.filter((side) => !shortSides.includes(side)),
    shortSides.filter((side) => !compatible.includes(side)),
    allSides.filter((side) => !shortSides.includes(side) && !compatible.includes(side)),
  ];

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const available = groups[groupIndex].filter((side) => doorBySide[side].length > 0);
    if (available.length === 0) {
      continue;
    }
    const pick = seededIndex(
      available.length,
      NEXTGEN_SEED,
      cx,
      cy,
      "room-door-side",
      roomIndex,
      groupIndex,
      room.x,
      room.y,
      room.w,
      room.h
    );
    return available[pick];
  }

  return null;
}

function isGrowthLayerClear(room, growthSide, depth, baseTileMap, occupancy) {
  if (growthSide === "E") {
    const x = room.x + room.w + depth - 1;
    if (x < 0 || x >= CHUNK_SIZE) {
      return false;
    }
    for (let y = room.y; y < room.y + room.h; y += 1) {
      if (y < 0 || y >= CHUNK_SIZE) {
        return false;
      }
      const idx = y * CHUNK_SIZE + x;
      if (!isRoomFillableTile(baseTileMap[idx]) || occupancy[idx] !== 0) {
        return false;
      }
    }
    return true;
  }

  if (growthSide === "W") {
    const x = room.x - depth;
    if (x < 0 || x >= CHUNK_SIZE) {
      return false;
    }
    for (let y = room.y; y < room.y + room.h; y += 1) {
      if (y < 0 || y >= CHUNK_SIZE) {
        return false;
      }
      const idx = y * CHUNK_SIZE + x;
      if (!isRoomFillableTile(baseTileMap[idx]) || occupancy[idx] !== 0) {
        return false;
      }
    }
    return true;
  }

  if (growthSide === "S") {
    const y = room.y + room.h + depth - 1;
    if (y < 0 || y >= CHUNK_SIZE) {
      return false;
    }
    for (let x = room.x; x < room.x + room.w; x += 1) {
      if (x < 0 || x >= CHUNK_SIZE) {
        return false;
      }
      const idx = y * CHUNK_SIZE + x;
      if (!isRoomFillableTile(baseTileMap[idx]) || occupancy[idx] !== 0) {
        return false;
      }
    }
    return true;
  }

  const y = room.y - depth;
  if (y < 0 || y >= CHUNK_SIZE) {
    return false;
  }
  for (let x = room.x; x < room.x + room.w; x += 1) {
    if (x < 0 || x >= CHUNK_SIZE) {
      return false;
    }
    const idx = y * CHUNK_SIZE + x;
    if (!isRoomFillableTile(baseTileMap[idx]) || occupancy[idx] !== 0) {
      return false;
    }
  }
  return true;
}

function measureRearClearDepth(room, growthSide, baseTileMap, occupancy) {
  let depth = 0;
  const maxDepth = CHUNK_SIZE;
  for (let d = 1; d <= maxDepth; d += 1) {
    if (!isGrowthLayerClear(room, growthSide, d, baseTileMap, occupancy)) {
      break;
    }
    depth = d;
  }
  return depth;
}

function applyRoomGrowthPass(rooms, baseTileMap, cx, cy) {
  const occupancy = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  for (const room of rooms) {
    markRoomOnChunkOccupancy(occupancy, room, 1);
  }

  let grownArea = 0;
  let growthAttempted = 0;
  let growthUpgraded = 0;
  let growthBlocked = 0;
  for (let roomIndex = 0; roomIndex < rooms.length; roomIndex += 1) {
    const room = rooms[roomIndex];
    const doorBySide = collectCorridorDoorCandidatesBySide(baseTileMap, room);
    const nextVariant = findNextRoomPrefabVariant(room);
    let compatibleDoorSides = ["N", "E", "S", "W"];
    let deltaW = 0;
    let deltaH = 0;

    if (nextVariant) {
      deltaW = nextVariant.w - room.w;
      deltaH = nextVariant.h - room.h;
      if (deltaW > 0) {
        compatibleDoorSides = ["W", "E"];
      } else if (deltaH > 0) {
        compatibleDoorSides = ["N", "S"];
      }
    }

    const chosenDoorSide = pickDoorSideForRoomGrowth(
      room,
      doorBySide,
      compatibleDoorSides,
      cx,
      cy,
      roomIndex
    );
    room.preferredDoorSide = chosenDoorSide || room.preferredDoorSide;

    if (!nextVariant || !chosenDoorSide) {
      continue;
    }

    const growthSide = oppositeSide(chosenDoorSide);
    const neededDepth = deltaW > 0 ? deltaW : deltaH;
    if (neededDepth <= 0) {
      continue;
    }
    if (
      (deltaW > 0 && growthSide !== "E" && growthSide !== "W") ||
      (deltaH > 0 && growthSide !== "N" && growthSide !== "S")
    ) {
      continue;
    }

    growthAttempted += 1;
    markRoomOnChunkOccupancy(occupancy, room, 0);
    const clearDepth = measureRearClearDepth(room, growthSide, baseTileMap, occupancy);
    if (clearDepth >= ROOM_GROWTH_MIN_REAR_CLEARANCE && clearDepth >= neededDepth) {
      const oldArea = roomArea(room);
      if (growthSide === "W") {
        room.x -= deltaW;
      } else if (growthSide === "N") {
        room.y -= deltaH;
      }
      room.w = nextVariant.w;
      room.h = nextVariant.h;
      room.prefabId = nextVariant.baseId;
      room.prefabTileMap = nextVariant.tileMap;
      grownArea += roomArea(room) - oldArea;
      growthUpgraded += 1;
    } else {
      growthBlocked += 1;
    }
    markRoomOnChunkOccupancy(occupancy, room, 1);
  }

  return { grownArea, growthAttempted, growthUpgraded, growthBlocked };
}

function sharedEdgeLength(a, b) {
  if (a.x + a.w === b.x || b.x + b.w === a.x) {
    const top = Math.max(a.y, b.y);
    const bottom = Math.min(a.y + a.h, b.y + b.h);
    return Math.max(0, bottom - top);
  }
  if (a.y + a.h === b.y || b.y + b.h === a.y) {
    const left = Math.max(a.x, b.x);
    const right = Math.min(a.x + a.w, b.x + b.w);
    return Math.max(0, right - left);
  }
  return 0;
}

function canMergeRoomsRectangular(a, b) {
  const shared = sharedEdgeLength(a, b);
  if (shared <= 0) {
    return false;
  }

  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.w, b.x + b.w);
  const maxY = Math.max(a.y + a.h, b.y + b.h);
  const unionArea = (maxX - minX) * (maxY - minY);
  return unionArea === roomArea(a) + roomArea(b);
}

function mergeRooms(a, b) {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.w, b.x + b.w);
  const maxY = Math.max(a.y + a.h, b.y + b.h);
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
  };
}

function roomNeedsMerge(room, corridorMap) {
  if (room.w < MIN_ROOM_SIZE || room.h < MIN_ROOM_SIZE) {
    return true;
  }
  return collectCorridorDoorCandidates(corridorMap, room).length === 0;
}

function resolveRoomsByMerging(initialRooms, corridorMap, cx, cy) {
  const pool = initialRooms.map((room) => ({ ...room, active: true }));
  let mergePass = 0;
  let changed = true;

  while (changed) {
    changed = false;
    mergePass += 1;

    for (let i = 0; i < pool.length; i += 1) {
      const room = pool[i];
      if (!room.active || !roomNeedsMerge(room, corridorMap)) {
        continue;
      }

      const candidates = [];
      for (let j = 0; j < pool.length; j += 1) {
        if (i === j) {
          continue;
        }
        const target = pool[j];
        if (!target.active || !canMergeRoomsRectangular(room, target)) {
          continue;
        }

        const merged = mergeRooms(room, target);
        const mergedHasDoor = collectCorridorDoorCandidates(corridorMap, merged).length > 0;
        const targetHasDoor = collectCorridorDoorCandidates(corridorMap, target).length > 0;
        candidates.push({
          index: j,
          merged,
          mergedHasDoor,
          targetHasDoor,
          shared: sharedEdgeLength(room, target),
          targetArea: roomArea(target),
        });
      }

      if (candidates.length === 0) {
        continue;
      }

      candidates.sort((a, b) => {
        if (Number(b.mergedHasDoor) !== Number(a.mergedHasDoor)) {
          return Number(b.mergedHasDoor) - Number(a.mergedHasDoor);
        }
        if (Number(b.targetHasDoor) !== Number(a.targetHasDoor)) {
          return Number(b.targetHasDoor) - Number(a.targetHasDoor);
        }
        if (b.shared !== a.shared) {
          return b.shared - a.shared;
        }
        return b.targetArea - a.targetArea;
      });

      const top = candidates[0];
      const tieSet = candidates.filter(
        (candidate) =>
          candidate.mergedHasDoor === top.mergedHasDoor &&
          candidate.targetHasDoor === top.targetHasDoor &&
          candidate.shared === top.shared &&
          candidate.targetArea === top.targetArea
      );
      const pick =
        tieSet[
          seededIndex(
            tieSet.length,
            NEXTGEN_SEED,
            cx,
            cy,
            "room-merge",
            mergePass,
            room.x,
            room.y,
            room.w,
            room.h
          )
        ];

      pool[i].active = false;
      pool[pick.index].active = false;
      pool.push({ ...pick.merged, active: true });
      changed = true;
      break;
    }

    if (mergePass > 512) {
      break;
    }
  }

  return pool.filter((room) => room.active).map((room) => ({
    x: room.x,
    y: room.y,
    w: room.w,
    h: room.h,
  }));
}

function stampRoomPrefabFootprint(tileMap, room) {
  if (!room.prefabTileMap) {
    return;
  }

  for (let dy = 0; dy < room.h; dy += 1) {
    for (let dx = 0; dx < room.w; dx += 1) {
      const prefabTile = room.prefabTileMap[dy * room.w + dx];
      const idx = (room.y + dy) * CHUNK_SIZE + (room.x + dx);
      if (prefabTile === ROOM_PREFAB_CELL_WALL) {
        tileMap[idx] = TILE_ROOM_WALL;
      } else if (prefabTile === ROOM_PREFAB_CELL_FLOOR) {
        tileMap[idx] = TILE_ROOM_FLOOR;
      }
    }
  }
}

function generateChunkRooms(baseTileMap, cx, cy) {
  const tileMap = baseTileMap.slice();
  const zones = deriveRoomFillSpaces(tileMap);
  const rooms = [];
  let doorCount = 0;
  let doorlessRooms = 0;
  let undersizedRooms = 0;
  let uncoveredPrefabArea = 0;

  for (let zoneIndex = 0; zoneIndex < zones.length; zoneIndex += 1) {
    const zone = zones[zoneIndex];
    const placed = placeCorridorAccessibleRoomsInZone(zone, baseTileMap, cx, cy, zoneIndex);
    rooms.push(...placed.rooms);
    uncoveredPrefabArea += placed.uncoveredArea;
  }

  const extraRooms = runAdditionalRoomPlacementPass(rooms, baseTileMap, cx, cy);
  rooms.push(...extraRooms);

  const growthTelemetry = applyRoomGrowthPass(rooms, baseTileMap, cx, cy);

  for (const room of rooms) {
    stampRoomPrefabFootprint(tileMap, room);
  }

  for (let roomIndex = 0; roomIndex < rooms.length; roomIndex += 1) {
    const room = rooms[roomIndex];
    if (room.w < MIN_ROOM_SIZE || room.h < MIN_ROOM_SIZE) {
      undersizedRooms += 1;
    }
    const doorBySide = collectCorridorDoorCandidatesBySide(baseTileMap, room);
    const shortSides = shortSideDirections(room);
    const shortCandidates = [];
    for (const side of shortSides) {
      shortCandidates.push(...doorBySide[side]);
    }
    let doorCandidates = [];
    if (room.preferredDoorSide && doorBySide[room.preferredDoorSide].length > 0) {
      doorCandidates = doorBySide[room.preferredDoorSide];
    } else if (shortCandidates.length > 0) {
      doorCandidates = shortCandidates;
    } else {
      doorCandidates = [...doorBySide.N, ...doorBySide.E, ...doorBySide.S, ...doorBySide.W];
    }
    if (!doorCandidates || doorCandidates.length === 0) {
      doorlessRooms += 1;
      continue;
    }

    const pick = seededIndex(
      doorCandidates.length,
      NEXTGEN_SEED,
      cx,
      cy,
      "room-door",
      roomIndex,
      room.x,
      room.y,
      room.w,
      room.h
    );
    const door = doorCandidates[pick];
    tileMap[door.y * CHUNK_SIZE + door.x] = TILE_ROOM_DOOR;
    doorCount += 1;
  }

  for (let i = 0; i < tileMap.length; i += 1) {
    if (tileMap[i] === TILE_ACCESS_RESERVED) {
      tileMap[i] = 0;
    }
  }

  let reservedResidueCount = 0;
  for (let i = 0; i < tileMap.length; i += 1) {
    if (tileMap[i] === TILE_ACCESS_RESERVED) {
      reservedResidueCount += 1;
    }
  }
  const validatorReasonCodes = [];
  if (reservedResidueCount > 0) {
    validatorReasonCodes.push("RESERVED_TILE_RESIDUE");
  }
  const validatorPassed = validatorReasonCodes.length === 0;

  let unfilledCount = 0;
  for (let i = 0; i < tileMap.length; i += 1) {
    if (isRoomFillableTile(tileMap[i])) {
      unfilledCount += 1;
    }
  }
  uncoveredPrefabArea = unfilledCount;

  return {
    tileMap,
    zones,
    rooms,
    roomZoneCount: rooms.length,
    doorCount,
    doorlessRooms,
    undersizedRooms,
    unfilledCount,
    uncoveredPrefabArea,
    growthAttempted: growthTelemetry.growthAttempted,
    growthUpgraded: growthTelemetry.growthUpgraded,
    growthBlocked: growthTelemetry.growthBlocked,
    reservedResidueCount,
    validatorPassed,
    validatorReasonCodes,
  };
}

function carveSpecialFootprint(tileMap, x, y, w, h, tileValue) {
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      tileMap[(y + dy) * CHUNK_SIZE + (x + dx)] = tileValue;
    }
  }
}

function isCorridorTile(tileMap, x, y) {
  if (x < 0 || y < 0 || x >= CHUNK_SIZE || y >= CHUNK_SIZE) {
    return false;
  }
  return tileMap[y * CHUNK_SIZE + x] === 1;
}

function footprintTouchesCorridor(tileMap, x, y, w, h) {
  for (let px = x; px < x + w; px += 1) {
    if (isCorridorTile(tileMap, px, y - 1) || isCorridorTile(tileMap, px, y + h)) {
      return true;
    }
  }
  for (let py = y; py < y + h; py += 1) {
    if (isCorridorTile(tileMap, x - 1, py) || isCorridorTile(tileMap, x + w, py)) {
      return true;
    }
  }
  return false;
}

function footprintTouchesTopOrBottomChunkEdge(y, h) {
  return y === 0 || y + h === CHUNK_SIZE;
}

function footprintIsEmpty(tileMap, x, y, w, h) {
  if (x < 0 || y < 0 || x + w > CHUNK_SIZE || y + h > CHUNK_SIZE) {
    return false;
  }
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      if (tileMap[(y + dy) * CHUNK_SIZE + (x + dx)] !== 0) {
        return false;
      }
    }
  }
  return true;
}

function maybeExpandGymFootprint(tileMap, special, placement, cx, cy, placementIndex) {
  if (special.id !== "gym" || placement.w !== 15 || placement.h !== 15) {
    return placement;
  }

  const candidates = [];
  if (footprintIsEmpty(tileMap, placement.x - 2, placement.y, 2, 15)) {
    candidates.push({ x: placement.x - 2, y: placement.y, w: 17, h: 15, direction: "W" });
  }
  if (footprintIsEmpty(tileMap, placement.x + placement.w, placement.y, 2, 15)) {
    candidates.push({ x: placement.x, y: placement.y, w: 17, h: 15, direction: "E" });
  }
  if (footprintIsEmpty(tileMap, placement.x, placement.y - 2, 15, 2)) {
    candidates.push({ x: placement.x, y: placement.y - 2, w: 15, h: 17, direction: "N" });
  }
  if (footprintIsEmpty(tileMap, placement.x, placement.y + placement.h, 15, 2)) {
    candidates.push({ x: placement.x, y: placement.y, w: 15, h: 17, direction: "S" });
  }

  if (candidates.length === 0) {
    return placement;
  }

  const pick = seededIndex(
    candidates.length,
    NEXTGEN_SEED,
    cx,
    cy,
    "gym-expand",
    placement.x,
    placement.y,
    placementIndex
  );
  return candidates[pick];
}

function enumerateSpecialPlacements(tileMap, spaces, special) {
  const placements = [];
  const baseDimensions = Array.isArray(special.sizes)
    ? special.sizes
    : [{ w: special.w, h: special.h }];
  const dimensionVariants = [];
  for (const dims of baseDimensions) {
    dimensionVariants.push({ w: dims.w, h: dims.h });
    if (special.allowRotation !== false && dims.w !== dims.h) {
      dimensionVariants.push({ w: dims.h, h: dims.w });
    }
  }

  for (const space of spaces) {
    for (const dims of dimensionVariants) {
      const w = dims.w;
      const h = dims.h;
      const isSmallSpecial = w < 15 || h < 15;

      if (space.w < w || space.h < h) {
        continue;
      }

      if (isSmallSpecial) {
        if (space.w !== w) {
          continue;
        }
        const yTop = space.y;
        const yBottom = space.y + space.h - h;
        const yCandidates = yTop === yBottom ? [yTop] : [yTop, yBottom];
        for (const y of yCandidates) {
          const x = space.x;
          if (special.topBottomEdgeOnly && !footprintTouchesTopOrBottomChunkEdge(y, h)) {
            continue;
          }
          if (footprintTouchesCorridor(tileMap, x, y, w, h)) {
            placements.push({ x, y, w, h });
          }
        }
        continue;
      }

      const xMax = space.x + space.w - w;
      const yMax = space.y + space.h - h;
      for (let y = space.y; y <= yMax; y += 1) {
        for (let x = space.x; x <= xMax; x += 1) {
          if (special.topBottomEdgeOnly && !footprintTouchesTopOrBottomChunkEdge(y, h)) {
            continue;
          }
          if (footprintTouchesCorridor(tileMap, x, y, w, h)) {
            placements.push({ x, y, w, h });
          }
        }
      }
    }
  }

  return placements;
}

function generateChunkSpecialSpaces(sockets, cx, cy) {
  const tileMap = carveCorridorTileGrid(sockets).slice();
  const identifiedSpaces = deriveEmptySpaces(tileMap);
  const placedSpecials = [];

  for (let specialIndex = 0; specialIndex < SPECIAL_SPACE_DEFS.length; specialIndex += 1) {
    const special = SPECIAL_SPACE_DEFS[specialIndex];
    const roll = seededIndex(1000, NEXTGEN_SEED, cx, cy, "special-roll", special.id);
    if (roll >= SPECIAL_SPACE_CHANCE_PERMILLE) {
      continue;
    }

    const currentSpaces = deriveEmptySpaces(tileMap);
    const placements = enumerateSpecialPlacements(tileMap, currentSpaces, special);
    if (placements.length === 0) {
      continue;
    }

    const chosen =
      placements[
        seededIndex(placements.length, NEXTGEN_SEED, cx, cy, "special-placement", special.id, placedSpecials.length)
      ];
    const finalizedPlacement = maybeExpandGymFootprint(tileMap, special, chosen, cx, cy, placedSpecials.length);
    const { x, y, w, h } = finalizedPlacement;

    carveSpecialFootprint(tileMap, x, y, w, h, specialIndex + 2);
    placedSpecials.push({
      id: special.id,
      label: special.label,
      color: special.color,
      x,
      y,
      w,
      h,
      area: w * h,
      rollPermille: roll,
    });
  }

  return { tileMap, identifiedSpaces, placedSpecials };
}

function accessTileTouchesExistingCorridor(tileMap, x, y, entry) {
  const local = entry.tileMap;

  for (let ly = 0; ly < entry.h; ly += 1) {
    for (let lx = 0; lx < entry.w; lx += 1) {
      if (local[ly * entry.w + lx] !== 1) {
        continue;
      }

      const gx = x + lx;
      const gy = y + ly;

      if (ly === 0 && isCorridorTile(tileMap, gx, gy - 1)) {
        return true;
      }
      if (ly === entry.h - 1 && isCorridorTile(tileMap, gx, gy + 1)) {
        return true;
      }
      if (lx === 0 && isCorridorTile(tileMap, gx - 1, gy)) {
        return true;
      }
      if (lx === entry.w - 1 && isCorridorTile(tileMap, gx + 1, gy)) {
        return true;
      }
    }
  }

  return false;
}

function carveAccessFootprint(tileMap, x, y, entry) {
  const local = entry.tileMap;
  for (let ly = 0; ly < entry.h; ly += 1) {
    for (let lx = 0; lx < entry.w; lx += 1) {
      const idx = (y + ly) * CHUNK_SIZE + (x + lx);
      if (local[ly * entry.w + lx] === 1) {
        tileMap[idx] = 1;
      } else if (tileMap[idx] === 0) {
        tileMap[idx] = TILE_ACCESS_RESERVED;
      }
    }
  }
}

function sortSpacesLargestFirst(spaces) {
  return [...spaces].sort((a, b) => {
    if (b.area !== a.area) {
      return b.area - a.area;
    }
    if (b.h !== a.h) {
      return b.h - a.h;
    }
    if (b.w !== a.w) {
      return b.w - a.w;
    }
    if (a.y !== b.y) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });
}

function accessFootprintsLargestFirst() {
  return [...ACCESS_CORRIDOR_FOOTPRINTS].sort((a, b) => {
    const areaA = a.w * a.h;
    const areaB = b.w * b.h;
    if (areaB !== areaA) {
      return areaB - areaA;
    }
    if (b.h !== a.h) {
      return b.h - a.h;
    }
    return b.w - a.w;
  });
}

function enumerateAccessPlacementsForFootprint(tileMap, space, entriesForFootprint) {
  const placements = [];
  if (entriesForFootprint.length === 0) {
    return placements;
  }

  const footprint = entriesForFootprint[0];
  if (space.w < footprint.w || space.h < footprint.h) {
    return placements;
  }

  const xMax = space.x + space.w - footprint.w;
  const yMax = space.y + space.h - footprint.h;

  for (let y = space.y; y <= yMax; y += 1) {
    for (let x = space.x; x <= xMax; x += 1) {
      for (const entry of entriesForFootprint) {
        if (!accessTileTouchesExistingCorridor(tileMap, x, y, entry)) {
          continue;
        }
        placements.push({
          x,
          y,
          entry,
        });
      }
    }
  }

  return placements;
}

function placeChunkAccessCorridors(baseTileMap, cx, cy, accessCatalogue) {
  const tileMap = baseTileMap.slice();
  const placements = [];
  const footprintOrder = accessFootprintsLargestFirst();
  let identifiedRemainingSpaces = [];
  const entriesByFootprint = new Map();

  for (const entry of accessCatalogue) {
    if (!entriesByFootprint.has(entry.key)) {
      entriesByFootprint.set(entry.key, []);
    }
    entriesByFootprint.get(entry.key).push(entry);
  }

  for (let pass = 0; pass < MAX_ACCESS_PLACEMENT_PASSES; pass += 1) {
    const spaces = sortSpacesLargestFirst(deriveEmptySpaces(tileMap));
    if (pass === 0) {
      identifiedRemainingSpaces = spaces.map((space) => ({ ...space }));
    }
    let placedThisPass = 0;

    for (const space of spaces) {
      let chosen = null;

      for (const footprint of footprintOrder) {
        const entriesForFootprint = entriesByFootprint.get(footprintKey(footprint)) || [];
        const candidates = enumerateAccessPlacementsForFootprint(
          tileMap,
          space,
          entriesForFootprint
        );
        if (candidates.length === 0) {
          continue;
        }

        const pick = seededIndex(
          candidates.length,
          NEXTGEN_SEED,
          cx,
          cy,
          "access-placement",
          pass,
          space.x,
          space.y,
          footprint.w,
          footprint.h,
          placements.length
        );
        chosen = candidates[pick];
        break;
      }

      if (!chosen) {
        continue;
      }

      carveAccessFootprint(tileMap, chosen.x, chosen.y, chosen.entry);

      placements.push({
        x: chosen.x,
        y: chosen.y,
        w: chosen.entry.w,
        h: chosen.entry.h,
        set: chosen.entry.set,
        tileId: chosen.entry.tileId,
        tileVariant: chosen.entry.tileVariant,
        isBlank: chosen.entry.isBlank === true,
      });
      placedThisPass += 1;
    }

    if (placedThisPass === 0) {
      break;
    }
  }

  return { tileMap, placements, remainingSpaces: identifiedRemainingSpaces };
}

function buildSeededCorridorAssignment(patterns, cx, cy, rerollIndex = 0) {
  const tileIndex = seededIndex(patterns.length, NEXTGEN_SEED, cx, cy, "tile", rerollIndex);
  const rotationTurns = seededIndex(4, NEXTGEN_SEED, cx, cy, "rot", rerollIndex);
  const tile = patterns[tileIndex];
  return {
    tileId: tile.id,
    rotationTurns,
    sockets: rotateSockets(tile.sockets, rotationTurns),
    rerollIndex,
  };
}

function buildForcedCorridorAssignment(patterns, cx, cy, requiredSide, forceIndex = 0) {
  const candidates = [];
  for (const pattern of patterns) {
    for (let rotationTurns = 0; rotationTurns < 4; rotationTurns += 1) {
      const sockets = rotateSockets(pattern.sockets, rotationTurns);
      if (sockets[requiredSide]) {
        candidates.push({
          tileId: pattern.id,
          rotationTurns,
          sockets,
        });
      }
    }
  }

  const pick = seededIndex(candidates.length, NEXTGEN_SEED, cx, cy, "force", requiredSide, forceIndex);
  const choice = candidates[pick];
  return {
    tileId: choice.tileId,
    rotationTurns: choice.rotationTurns,
    sockets: choice.sockets,
    rerollIndex: forceIndex,
  };
}

function buildNextgenAssignments(patterns, bounds = nextgenBounds()) {
  const assignments = new Map();
  for (let cy = bounds.minY; cy <= bounds.maxY; cy += 1) {
    for (let cx = bounds.minX; cx <= bounds.maxX; cx += 1) {
      assignments.set(coordKey(cx, cy), buildSeededCorridorAssignment(patterns, cx, cy));
    }
  }
  return assignments;
}

function hasConnectingNeighbor(assignments, cx, cy) {
  const current = assignments.get(coordKey(cx, cy));
  if (!current) {
    return false;
  }

  for (const rule of CARDINAL_NEIGHBORS) {
    const neighbor = assignments.get(coordKey(cx + rule.dx, cy + rule.dy));
    if (!neighbor) {
      continue;
    }
    if (current.sockets[rule.side] && neighbor.sockets[rule.opposite]) {
      return true;
    }
  }

  return false;
}

function buildChunkValidator(cx, cy, connected, chunkRooms) {
  const failureReasonCodes = [];
  const warningReasonCodes = [];

  if (!connected) {
    failureReasonCodes.push("DISCONNECTED_CHUNK");
  }
  if (chunkRooms.reservedResidueCount > 0) {
    failureReasonCodes.push("RESERVED_TILE_RESIDUE");
  }
  if (chunkRooms.doorlessRooms > 0) {
    warningReasonCodes.push("DOORLESS_ROOMS_PRESENT");
  }
  if (chunkRooms.undersizedRooms > 0) {
    warningReasonCodes.push("UNDERSIZED_ROOMS_PRESENT");
  }

  return {
    cx,
    cy,
    passed: failureReasonCodes.length === 0,
    failureReasonCodes,
    warningReasonCodes,
  };
}

function aggregateChunkValidators(validators) {
  const failureReasonCounts = {};
  const warningReasonCounts = {};
  const failing = [];

  for (const validator of validators) {
    if (!validator.passed) {
      failing.push(validator);
    }
    for (const code of validator.failureReasonCodes) {
      failureReasonCounts[code] = (failureReasonCounts[code] || 0) + 1;
    }
    for (const code of validator.warningReasonCodes) {
      warningReasonCounts[code] = (warningReasonCounts[code] || 0) + 1;
    }
  }

  return {
    total: validators.length,
    failedCount: failing.length,
    passedCount: validators.length - failing.length,
    passing: failing.length === 0,
    failing,
    failureReasonCounts,
    warningReasonCounts,
  };
}

function formatReasonCountMap(reasonCounts) {
  const keys = Object.keys(reasonCounts).sort();
  if (keys.length === 0) {
    return "none";
  }
  return keys.map((key) => `${key}:${reasonCounts[key]}`).join(", ");
}

function formatFailingChunkList(failing, maxEntries = 12) {
  if (!failing || failing.length === 0) {
    return "none";
  }
  const limit = Math.max(1, maxEntries);
  const shown = failing
    .slice(0, limit)
    .map((v) => `(${v.cx},${v.cy})[${v.failureReasonCodes.join("+")}]`);
  const remaining = failing.length - shown.length;
  return remaining > 0 ? `${shown.join(", ")} +${remaining} more` : shown.join(", ");
}

function formatChunkValidatorSummary(validator) {
  if (validator.passed) {
    if (validator.warningReasonCodes.length > 0) {
      return `validator pass(warn:${validator.warningReasonCodes.join("+")})`;
    }
    return "validator pass";
  }
  return `validator fail(${validator.failureReasonCodes.join("+")})`;
}

function inBoundsNeighbors(cx, cy, bounds = nextgenBounds()) {
  const valid = [];
  for (const rule of CARDINAL_NEIGHBORS) {
    const nx = cx + rule.dx;
    const ny = cy + rule.dy;
    if (nx < bounds.minX || nx > bounds.maxX || ny < bounds.minY || ny > bounds.maxY) {
      continue;
    }
    valid.push(rule);
  }
  return valid;
}

function rerollUntilConnected(assignments, patterns, cx, cy, rerollCounts) {
  const key = coordKey(cx, cy);
  let rerollIndex = rerollCounts.get(key) || 0;

  while (!hasConnectingNeighbor(assignments, cx, cy) && rerollIndex < NEXTGEN_MAX_REROLLS_PER_CHUNK) {
    rerollIndex += 1;
    assignments.set(key, buildSeededCorridorAssignment(patterns, cx, cy, rerollIndex));
  }

  rerollCounts.set(key, rerollIndex);
  return hasConnectingNeighbor(assignments, cx, cy);
}

function forcePairConnection(assignments, patterns, cx, cy, rerollCounts, bounds = nextgenBounds()) {
  const neighbors = inBoundsNeighbors(cx, cy, bounds);
  if (neighbors.length === 0) {
    return false;
  }

  const sourceKey = coordKey(cx, cy);
  const sourceForceIndex = (rerollCounts.get(sourceKey) || 0) + 1;
  const rulePick = seededIndex(neighbors.length, NEXTGEN_SEED, cx, cy, "force-neighbor", sourceForceIndex);
  const chosen = neighbors[rulePick];
  const nx = cx + chosen.dx;
  const ny = cy + chosen.dy;
  const neighborKey = coordKey(nx, ny);
  const neighborForceIndex = (rerollCounts.get(neighborKey) || 0) + 1;

  assignments.set(
    sourceKey,
    buildForcedCorridorAssignment(patterns, cx, cy, chosen.side, sourceForceIndex)
  );
  assignments.set(
    neighborKey,
    buildForcedCorridorAssignment(patterns, nx, ny, chosen.opposite, neighborForceIndex)
  );

  rerollCounts.set(sourceKey, sourceForceIndex);
  rerollCounts.set(neighborKey, neighborForceIndex);

  return hasConnectingNeighbor(assignments, cx, cy);
}

function enforceNextgenConnections(assignments, patterns, bounds = nextgenBounds()) {
  const rerollCounts = new Map();
  let passesRun = 0;

  for (let pass = 1; pass <= NEXTGEN_MAX_CONNECT_PASSES; pass += 1) {
    passesRun = pass;
    const failing = [];

    for (let cy = bounds.minY; cy <= bounds.maxY; cy += 1) {
      for (let cx = bounds.minX; cx <= bounds.maxX; cx += 1) {
        if (!hasConnectingNeighbor(assignments, cx, cy)) {
          failing.push({ cx, cy });
        }
      }
    }

    if (failing.length === 0) {
      break;
    }

    for (const cell of failing) {
      const connected = rerollUntilConnected(assignments, patterns, cell.cx, cell.cy, rerollCounts);
      if (!connected) {
        forcePairConnection(assignments, patterns, cell.cx, cell.cy, rerollCounts, bounds);
      }
    }
  }

  const unresolved = [];
  for (let cy = bounds.minY; cy <= bounds.maxY; cy += 1) {
    for (let cx = bounds.minX; cx <= bounds.maxX; cx += 1) {
      if (!hasConnectingNeighbor(assignments, cx, cy)) {
        unresolved.push({ cx, cy });
      }
    }
  }

  const totalRerolls = [...rerollCounts.values()].reduce((sum, count) => sum + count, 0);
  return { passesRun, rerollCounts, totalRerolls, unresolved };
}

export {
  WORLD_SEED,
  GENERATOR_VERSION,
  NEXTGEN_SEED,
  CORRIDOR_SIDES,
  NEXTGEN_MAX_CONNECT_PASSES,
  NEXTGEN_MAX_REROLLS_PER_CHUNK,
  MAX_ACCESS_PLACEMENT_PASSES,
  TILE_ACCESS_RESERVED,
  TILE_ROOM_FLOOR,
  TILE_ROOM_WALL,
  TILE_ROOM_DOOR,
  ROOM_PREFAB_CELL_FLOOR,
  ROOM_PREFAB_CELL_WALL,
  ROOM_GROWTH_MIN_REAR_CLEARANCE,
  MIN_ROOM_SIZE,
  TARGET_ROOM_SIZE,
  SPECIAL_SPACE_CHANCE_PERMILLE,
  SPECIAL_SPACE_DEFS,
  CARDINAL_NEIGHBORS,
  ACCESS_CORRIDOR_FOOTPRINTS,
  DISABLED_ACCESS_TILE_KEYS,
  ROOM_PREFAB_CATALOG,
  ROOM_PREFAB_VARIANTS,
  coordKey,
  seededIndex,
  buildCorridorTilePatterns,
  carveCorridorTileGrid,
  carveAccessCorridorTileGrid,
  buildAccessCorridorCatalogue,
  rotateSockets,
  chunkBoundsFromRadius,
  nextgenBounds,
  deriveEmptySpaces,
  deriveRoomFillSpaces,
  generateChunkRooms,
  generateChunkSpecialSpaces,
  placeChunkAccessCorridors,
  buildSeededCorridorAssignment,
  buildForcedCorridorAssignment,
  buildNextgenAssignments,
  hasConnectingNeighbor,
  buildChunkValidator,
  aggregateChunkValidators,
  inBoundsNeighbors,
  enforceNextgenConnections,
};

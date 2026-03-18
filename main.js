import { CHUNK_SIZE, TILE_TYPES, generateChunkGeometry } from "./engine/procgen.js";

const WORLD_SEED = "undead-hotel-dev-seed";
const GENERATOR_VERSION = "v1";
const RADIUS = 1; // 3x3 around origin

const TILE_PIXELS = 6;
const CHUNK_GAP = 8;
const VIEW_CHUNKS = RADIUS * 2 + 1;
const CHUNK_PIXELS = CHUNK_SIZE * TILE_PIXELS;

const canvas = document.getElementById("debug-canvas");
const ctx = canvas.getContext("2d");
const report = document.getElementById("report");
const meta = document.getElementById("meta");

canvas.width = VIEW_CHUNKS * CHUNK_PIXELS + (VIEW_CHUNKS - 1) * CHUNK_GAP;
canvas.height = canvas.width;

function tileColor(tileType) {
  if (tileType === TILE_TYPES.FLOOR_HALL) {
    return "#1f1f1f";
  }
  if (tileType === TILE_TYPES.FLOOR_PREFAB) {
    return "#cfe9ff";
  }
  if (tileType === TILE_TYPES.FLOOR_ROOM) {
    return "#efefef";
  }
  if (tileType === TILE_TYPES.WALL) {
    return "#8f8f8f";
  }
  if (tileType === TILE_TYPES.DOOR) {
    return "#ff9100";
  }
  return "#ffffff";
}

function coordKey(x, y) {
  return `${x},${y}`;
}

function renderChunk(chunk, originX, originY) {
  for (let y = 0; y < CHUNK_SIZE; y += 1) {
    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      const tile = chunk.tiles[y * CHUNK_SIZE + x];
      ctx.fillStyle = tileColor(tile);
      ctx.fillRect(
        originX + x * TILE_PIXELS,
        originY + y * TILE_PIXELS,
        TILE_PIXELS,
        TILE_PIXELS
      );
    }
  }

  ctx.strokeStyle = "#888888";
  ctx.lineWidth = 1;
  ctx.strokeRect(originX + 0.5, originY + 0.5, CHUNK_PIXELS - 1, CHUNK_PIXELS - 1);

  if (Array.isArray(chunk.zones)) {
    ctx.strokeStyle = "#0088cc";
    ctx.lineWidth = 1;
    for (const zone of chunk.zones) {
      ctx.strokeRect(
        originX + zone.x * TILE_PIXELS + 0.5,
        originY + zone.y * TILE_PIXELS + 0.5,
        zone.w * TILE_PIXELS - 1,
        zone.h * TILE_PIXELS - 1
      );
    }
  }

  if (Array.isArray(chunk.prefabs)) {
    ctx.strokeStyle = "#cc2a00";
    ctx.lineWidth = 2;
    for (const prefab of chunk.prefabs) {
      ctx.strokeRect(
        originX + prefab.x * TILE_PIXELS + 0.5,
        originY + prefab.y * TILE_PIXELS + 0.5,
        prefab.w * TILE_PIXELS - 1,
        prefab.h * TILE_PIXELS - 1
      );
    }
  }

  if (Array.isArray(chunk.rooms)) {
    ctx.strokeStyle = "#4caf50";
    ctx.lineWidth = 1;
    for (const room of chunk.rooms) {
      ctx.strokeRect(
        originX + room.x * TILE_PIXELS + 0.5,
        originY + room.y * TILE_PIXELS + 0.5,
        room.w * TILE_PIXELS - 1,
        room.h * TILE_PIXELS - 1
      );
    }
  }

  ctx.fillStyle = "#bb0000";
  ctx.font = "12px Consolas, monospace";
  ctx.fillText(`(${chunk.chunkX},${chunk.chunkY})`, originX + 4, originY + 14);
}

function socketConsistencyReport(chunks) {
  const lines = [];
  let pass = true;
  const directions = [
    { side: "E", dx: 1, dy: 0, opposite: "W" },
    { side: "S", dx: 0, dy: 1, opposite: "N" },
  ];

  for (const chunk of chunks.values()) {
    for (const rule of directions) {
      const nx = chunk.chunkX + rule.dx;
      const ny = chunk.chunkY + rule.dy;
      const neighbor = chunks.get(coordKey(nx, ny));
      if (!neighbor) {
        continue;
      }
      const a = chunk.activeSockets[rule.side];
      const b = neighbor.activeSockets[rule.opposite];
      if (a !== b) {
        pass = false;
        lines.push(
          `FAIL seam mismatch ${chunk.chunkX},${chunk.chunkY} ${rule.side} != ${nx},${ny} ${rule.opposite}`
        );
      }
    }
  }

  if (pass) {
    lines.push("PASS seam matching across rendered chunk borders");
  }
  return { pass, lines };
}

function deterministicReport() {
  const first = generateChunkGeometry(0, 0, WORLD_SEED, GENERATOR_VERSION);
  const second = generateChunkGeometry(0, 0, WORLD_SEED, GENERATOR_VERSION);
  if (first.tiles.length !== second.tiles.length) {
    return "FAIL deterministic replay: tile array length changed";
  }

  for (let i = 0; i < first.tiles.length; i += 1) {
    if (first.tiles[i] !== second.tiles[i]) {
      return `FAIL deterministic replay: tile mismatch at index ${i}`;
    }
  }

  return "PASS deterministic replay for chunk (0,0)";
}

function zoneCoverageReport(chunk) {
  let emptyCount = 0;
  for (let i = 0; i < chunk.tiles.length; i += 1) {
    if (chunk.tiles[i] === TILE_TYPES.EMPTY) {
      emptyCount += 1;
    }
  }

  const zoneArea = chunk.zones.reduce((sum, zone) => sum + zone.area, 0);
  const roomArea = chunk.roomCoverageArea || 0;
  const accessArea = chunk.accessReservedArea || 0;
  if (zoneArea !== roomArea + emptyCount + accessArea) {
    return `FAIL zone coverage mismatch: zones=${zoneArea} rooms=${roomArea} access=${accessArea} empty=${emptyCount}`;
  }
  return `PASS zone coverage center chunk: zones=${zoneArea} rooms=${roomArea} access=${accessArea} empty=${emptyCount}`;
}

function prefabSummary(chunk) {
  if (!Array.isArray(chunk.prefabs) || chunk.prefabs.length === 0) {
    return "Center prefabs: none";
  }
  return `Center prefabs: ${chunk.prefabs
    .map((p) => `${p.id}@${p.x},${p.y}(${p.w}x${p.h})`)
    .join(" | ")}`;
}

function roomSummary(chunk) {
  const count = Array.isArray(chunk.rooms) ? chunk.rooms.length : 0;
  const connected = Array.isArray(chunk.rooms)
    ? chunk.rooms.filter((room) => room.connectedToHall).length
    : 0;
  const status = chunk.allRoomsConnected ? "all-connected" : "partial";
  return `Center rooms: ${count} connected:${connected} status:${status}`;
}

function draw() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const chunks = new Map();
  for (let cy = -RADIUS; cy <= RADIUS; cy += 1) {
    for (let cx = -RADIUS; cx <= RADIUS; cx += 1) {
      const chunk = generateChunkGeometry(cx, cy, WORLD_SEED, GENERATOR_VERSION);
      chunks.set(coordKey(cx, cy), chunk);
      const gridX = cx + RADIUS;
      const gridY = cy + RADIUS;
      const pixelX = gridX * (CHUNK_PIXELS + CHUNK_GAP);
      const pixelY = gridY * (CHUNK_PIXELS + CHUNK_GAP);
      renderChunk(chunk, pixelX, pixelY);
    }
  }

  const seams = socketConsistencyReport(chunks);
  const deterministicLine = deterministicReport();

  const centerChunk = chunks.get("0,0");
  const centerSocketSummary = `Center sockets N:${Number(
    centerChunk.activeSockets.N
  )} S:${Number(centerChunk.activeSockets.S)} E:${Number(centerChunk.activeSockets.E)} W:${Number(
    centerChunk.activeSockets.W
  )}`;
  const zoneSummary = `Center zones: ${centerChunk.zones.length} (${centerChunk.zones
    .slice(0, 6)
    .map((z) => `${z.w}x${z.h}`)
    .join(", ")}${centerChunk.zones.length > 6 ? ", ..." : ""})`;
  const zoneCoverage = zoneCoverageReport(centerChunk);
  const prefabLine = prefabSummary(centerChunk);
  const candidateZonesLine = `Center candidate zones pre-prefab: ${centerChunk.zoneCandidates.length}`;
  const buildZonesLine = `Center build zones post-access: ${centerChunk.buildZones.length}`;
  const roomLine = roomSummary(centerChunk);

  meta.textContent = `Seed: ${WORLD_SEED} | Version: ${GENERATOR_VERSION} | View: 3x3 chunks`;
  report.textContent = [
    deterministicLine,
    ...seams.lines,
    centerSocketSummary,
    candidateZonesLine,
    buildZonesLine,
    zoneSummary,
    zoneCoverage,
    prefabLine,
    roomLine,
  ].join("\n");
}

draw();

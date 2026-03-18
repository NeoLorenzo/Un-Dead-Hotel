import { CHUNK_SIZE } from "../../engine/procgen.js";
import {
  NEXTGEN_SEED,
  ROOM_PREFAB_CATALOG,
  ROOM_PREFAB_CELL_FLOOR,
  ROOM_PREFAB_CELL_WALL,
  SPECIAL_SPACE_DEFS,
  TILE_ACCESS_RESERVED,
  TILE_ROOM_DOOR,
  TILE_ROOM_FLOOR,
  TILE_ROOM_WALL,
  aggregateChunkValidators,
  buildAccessCorridorCatalogue,
  buildChunkValidator,
  buildCorridorTilePatterns,
  buildNextgenAssignments,
  carveCorridorTileGrid,
  coordKey,
  enforceNextgenConnections,
  generateChunkRooms,
  generateChunkSpecialSpaces,
  hasConnectingNeighbor,
  placeChunkAccessCorridors,
} from "../../engine/generation/chunkGenerator.js";

const NEXTGEN_CHUNKS_X = 6;
const NEXTGEN_CHUNKS_Y = 6;
const NEXTGEN_ORIGIN_X = -3;
const NEXTGEN_ORIGIN_Y = -3;
const NEXTGEN_VIEW_SCALE = 1.4;

const TILE_PIXELS = 3;
const CHUNK_GAP = 4;
const CHUNK_PIXELS = CHUNK_SIZE * TILE_PIXELS;

const CORRIDOR_TILE_PIXEL = 3;
const ACCESS_CORRIDOR_TILE_PIXEL = 4;
const ROOM_PREFAB_TILE_PIXEL = 8;
const ROOM_THIN_WALL_RATIO = 0.2;

const WORLD_PREVIEW_CHUNKS_X = 20;
const WORLD_PREVIEW_CHUNKS_Y = 20;
const WORLD_PREVIEW_TILE_PIXELS = 2;
const WORLD_PREVIEW_ORIGIN_X = -10;
const WORLD_PREVIEW_ORIGIN_Y = -10;

const nextgenCanvas = document.getElementById("nextgen-canvas");
const nextgenCtx = nextgenCanvas.getContext("2d");
const nextgenMeta = document.getElementById("nextgen-meta");
const nextgenReport = document.getElementById("nextgen-report");
const corridorTileGrid = document.getElementById("corridor-tile-grid");
const corridorTilesMeta = document.getElementById("corridor-tiles-meta");
const accessCorridorTileGrid = document.getElementById("access-corridor-tile-grid");
const accessCorridorTilesMeta = document.getElementById("access-corridor-tiles-meta");
const roomPrefabGrid = document.getElementById("room-prefab-grid");
const roomPrefabsMeta = document.getElementById("room-prefabs-meta");
const openWorldPreviewButton = document.getElementById("open-world-preview");
const closeWorldPreviewButton = document.getElementById("close-world-preview");
const appMain = document.querySelector("main");
const worldPreviewScreen = document.getElementById("world-preview-screen");
const worldPreviewCanvas = document.getElementById("world-preview-canvas");
const worldPreviewCtx = worldPreviewCanvas ? worldPreviewCanvas.getContext("2d") : null;
const worldPreviewMeta = document.getElementById("world-preview-meta");

nextgenCanvas.width = NEXTGEN_CHUNKS_X * CHUNK_PIXELS + (NEXTGEN_CHUNKS_X - 1) * CHUNK_GAP;
nextgenCanvas.height = NEXTGEN_CHUNKS_Y * CHUNK_PIXELS + (NEXTGEN_CHUNKS_Y - 1) * CHUNK_GAP;
nextgenCanvas.style.width = `${Math.round(nextgenCanvas.width * NEXTGEN_VIEW_SCALE)}px`;

function nextgenBounds() {
  return {
    minX: NEXTGEN_ORIGIN_X,
    maxX: NEXTGEN_ORIGIN_X + NEXTGEN_CHUNKS_X - 1,
    minY: NEXTGEN_ORIGIN_Y,
    maxY: NEXTGEN_ORIGIN_Y + NEXTGEN_CHUNKS_Y - 1,
  };
}

function worldPreviewBounds() {
  return {
    minX: WORLD_PREVIEW_ORIGIN_X,
    maxX: WORLD_PREVIEW_ORIGIN_X + WORLD_PREVIEW_CHUNKS_X - 1,
    minY: WORLD_PREVIEW_ORIGIN_Y,
    maxY: WORLD_PREVIEW_ORIGIN_Y + WORLD_PREVIEW_CHUNKS_Y - 1,
  };
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

function renderCorridorTileCatalog(patterns) {
  if (!corridorTileGrid) {
    return;
  }

  corridorTileGrid.innerHTML = "";

  for (const pattern of patterns) {
    const card = document.createElement("article");
    card.className = "corridor-tile-card";

    const title = document.createElement("h3");
    title.className = "corridor-tile-title";
    title.textContent = `Tile ${pattern.id} | Corridors ${pattern.corridorCount}`;

    const canvasEl = document.createElement("canvas");
    canvasEl.className = "corridor-tile-canvas";
    canvasEl.setAttribute("aria-label", `Corridor tile ${pattern.id}`);
    drawCorridorTilePreview(canvasEl, pattern.sockets);

    const socketsLine = document.createElement("p");
    socketsLine.className = "corridor-tile-sockets";
    socketsLine.textContent = `Open sides: ${pattern.openSides.join(", ")}`;

    card.append(title, canvasEl, socketsLine);
    corridorTileGrid.appendChild(card);
  }

  if (corridorTilesMeta) {
    corridorTilesMeta.textContent = `${patterns.length} preset corridor tiles (1-4 side corridors to center).`;
  }
}

function renderAccessCorridorCatalog(accessCatalogue) {
  if (!accessCorridorTileGrid) {
    return;
  }

  accessCorridorTileGrid.innerHTML = "";
  for (const entry of accessCatalogue) {
    const card = document.createElement("article");
    card.className = "corridor-tile-card";

    const title = document.createElement("h3");
    title.className = "corridor-tile-title";
    const tileLabel = entry.isBlank
      ? "Tile BLANK"
      : entry.tileVariant
        ? `Tile ${entry.tileId}-${entry.tileVariant}`
        : `Tile ${entry.tileId}`;
    title.textContent = `${entry.set} | ${entry.w}x${entry.h} | ${tileLabel}`;

    const canvasEl = document.createElement("canvas");
    canvasEl.className = "access-corridor-tile-canvas";
    canvasEl.setAttribute("aria-label", `Access corridor tile ${tileLabel}, ${entry.w}x${entry.h}`);
    drawAccessCorridorTilePreview(canvasEl, entry);

    const socketsLine = document.createElement("p");
    socketsLine.className = "corridor-tile-sockets";
    socketsLine.textContent = entry.isBlank
      ? "Open sides: none | Blank tile"
      : `Open sides: ${entry.openSides.join(", ")} | Corridor width: 2`;

    card.append(title, canvasEl, socketsLine);
    accessCorridorTileGrid.appendChild(card);
  }

  if (accessCorridorTilesMeta) {
    accessCorridorTilesMeta.textContent = `${accessCatalogue.length} active access corridor tiles after exclusions.`;
  }
}

function drawRoomPrefabPreview(canvasEl, prefab) {
  canvasEl.width = prefab.w * ROOM_PREFAB_TILE_PIXEL;
  canvasEl.height = prefab.h * ROOM_PREFAB_TILE_PIXEL;
  const previewCtx = canvasEl.getContext("2d");
  previewCtx.fillStyle = "#ffffff";
  previewCtx.fillRect(0, 0, canvasEl.width, canvasEl.height);

  for (let y = 0; y < prefab.h; y += 1) {
    for (let x = 0; x < prefab.w; x += 1) {
      const tile = prefab.tileMap[y * prefab.w + x];
      if (tile !== ROOM_PREFAB_CELL_FLOOR && tile !== ROOM_PREFAB_CELL_WALL) {
        continue;
      }
      previewCtx.fillStyle = "#efefef";
      previewCtx.fillRect(
        x * ROOM_PREFAB_TILE_PIXEL,
        y * ROOM_PREFAB_TILE_PIXEL,
        ROOM_PREFAB_TILE_PIXEL,
        ROOM_PREFAB_TILE_PIXEL
      );
    }
  }

  drawThinExteriorWallsForRooms(
    previewCtx,
    0,
    0,
    [{ x: 0, y: 0, w: prefab.w, h: prefab.h }],
    prefab.tileMap,
    prefab.w,
    ROOM_PREFAB_TILE_PIXEL,
    ROOM_PREFAB_CELL_WALL
  );
}

function renderRoomPrefabCatalog(prefabs) {
  if (!roomPrefabGrid) {
    return;
  }

  roomPrefabGrid.innerHTML = "";

  for (const prefab of prefabs) {
    const card = document.createElement("article");
    card.className = "corridor-tile-card";

    const title = document.createElement("h3");
    title.className = "corridor-tile-title";
    title.textContent = `${prefab.id} | ${prefab.w}x${prefab.h}`;

    const canvasEl = document.createElement("canvas");
    canvasEl.className = "room-prefab-canvas";
    canvasEl.setAttribute("aria-label", `Room prefab ${prefab.id}, ${prefab.w} by ${prefab.h}`);
    drawRoomPrefabPreview(canvasEl, prefab);

    const stats = document.createElement("p");
    stats.className = "corridor-tile-sockets";
    stats.textContent = `Footprint: ${prefab.w}x${prefab.h} | Area: ${prefab.w * prefab.h}`;

    card.append(title, canvasEl, stats);
    roomPrefabGrid.appendChild(card);
  }

  if (roomPrefabsMeta) {
    roomPrefabsMeta.textContent = `${prefabs.length} room prefabs available for placement tests.`;
  }
}

function drawNextGeneratorRandomized(patterns, accessCatalogue) {
  nextgenCtx.fillStyle = "#ffffff";
  nextgenCtx.fillRect(0, 0, nextgenCanvas.width, nextgenCanvas.height);
  const bounds = nextgenBounds();
  const assignments = buildNextgenAssignments(patterns, bounds);
  const passResult = enforceNextgenConnections(assignments, patterns, bounds);
  const assignmentLines = [];
  const chunkValidators = [];

  for (let cy = bounds.minY; cy <= bounds.maxY; cy += 1) {
    for (let cx = bounds.minX; cx <= bounds.maxX; cx += 1) {
      const assignment = assignments.get(coordKey(cx, cy));
      const chunkSpecials = generateChunkSpecialSpaces(assignment.sockets, cx, cy);
      const chunkAccess = placeChunkAccessCorridors(chunkSpecials.tileMap, cx, cy, accessCatalogue);
      const chunkRooms = generateChunkRooms(chunkAccess.tileMap, cx, cy);

      const gridX = cx - bounds.minX;
      const gridY = cy - bounds.minY;
      const pixelX = gridX * (CHUNK_PIXELS + CHUNK_GAP);
      const pixelY = gridY * (CHUNK_PIXELS + CHUNK_GAP);

      drawCorridorChunk(nextgenCtx, pixelX, pixelY, chunkRooms);

      nextgenCtx.fillStyle = "#bb0000";
      nextgenCtx.font = "12px Consolas, monospace";
      nextgenCtx.fillText(
        `(${cx},${cy}) T${assignment.tileId} R${assignment.rotationTurns * 90}`,
        pixelX + 4,
        pixelY + 14
      );

      const connected = hasConnectingNeighbor(assignments, cx, cy);
      const spacesSummary =
        chunkAccess.remainingSpaces.length === 0
          ? "none"
          : chunkAccess.remainingSpaces
              .map((space) => `${space.x},${space.y}(${space.w}x${space.h})`)
              .join(" | ");
      const specialsSummary =
        chunkSpecials.placedSpecials.length === 0
          ? "none"
          : chunkSpecials.placedSpecials.map((s) => `${s.id}@${s.x},${s.y}(${s.w}x${s.h})`).join(" | ");
      const accessSummary =
        chunkAccess.placements.length === 0
          ? "none"
          : chunkAccess.placements
              .map((a) => {
                const tileLabel = a.isBlank
                  ? "TBLANK"
                  : a.tileVariant
                    ? `T${a.tileId}-${a.tileVariant}`
                    : `T${a.tileId}`;
                const shapeMarker =
                  a.set === "Set 3" && a.tileId === "1" && a.w === 32 && a.h === 15 ? "*" : "";
                return `${a.set}:${tileLabel}${shapeMarker}@${a.x},${a.y}(${a.w}x${a.h})`;
              })
              .join(" | ");
      const chunkValidator = buildChunkValidator(cx, cy, connected, chunkRooms);
      chunkValidators.push(chunkValidator);
      const formalValidatorSummary = formatChunkValidatorSummary(chunkValidator);
      const roomsSummary = `rooms ${chunkRooms.roomZoneCount}, doors ${chunkRooms.doorCount}, doorless ${chunkRooms.doorlessRooms}, undersized ${chunkRooms.undersizedRooms}, unfilled ${chunkRooms.unfilledCount}, prefab-uncovered ${chunkRooms.uncoveredPrefabArea}, growth ${chunkRooms.growthAttempted}/${chunkRooms.growthUpgraded}/${chunkRooms.growthBlocked}, reserved-residue ${chunkRooms.reservedResidueCount}`;
      assignmentLines.push(
        `Chunk (${cx},${cy}) -> tile ${assignment.tileId}, rotation ${assignment.rotationTurns * 90}deg, rerolls ${assignment.rerollIndex}, connected ${connected ? "yes" : "no"}, spaces ${spacesSummary}, specials ${specialsSummary}, access ${accessSummary}, rooms ${roomsSummary}, formal ${formalValidatorSummary}`
      );
    }
  }

  const validationSummary = aggregateChunkValidators(chunkValidators);

  if (nextgenMeta) {
    nextgenMeta.textContent = `Status: seeded + connection pass | Seed: ${NEXTGEN_SEED} | Passes: ${passResult.passesRun} | Total rerolls: ${passResult.totalRerolls} | Validator: ${validationSummary.passing ? "PASS" : "FAIL"} (${validationSummary.failedCount}/${validationSummary.total} failed)`;
  }
  if (nextgenReport) {
    const legend = `Legend: ${SPECIAL_SPACE_DEFS.map((s) => `${s.label}=${s.color}`).join(" | ")}`;
    const unresolvedLine =
      passResult.unresolved.length === 0
        ? "Unresolved: none"
        : `Unresolved: ${passResult.unresolved.map((c) => `(${c.cx},${c.cy})`).join(", ")}`;
    const validatorSummaryLine = `Validator summary: ${validationSummary.passing ? "PASS" : "FAIL"} | Failed: ${validationSummary.failedCount}/${validationSummary.total} | Failure reasons: ${formatReasonCountMap(validationSummary.failureReasonCounts)} | Warning reasons: ${formatReasonCountMap(validationSummary.warningReasonCounts)}`;
    const validatorFailingLine = `Validator failing chunks: ${formatFailingChunkList(validationSummary.failing, 36)}`;
    nextgenReport.textContent = [
      unresolvedLine,
      validatorSummaryLine,
      validatorFailingLine,
      legend,
      ...assignmentLines,
    ].join("\n");
  }
}

function drawWorldPreview(patterns, accessCatalogue) {
  if (!worldPreviewCanvas || !worldPreviewCtx) {
    return;
  }

  const bounds = worldPreviewBounds();
  const chunkPixel = CHUNK_SIZE * WORLD_PREVIEW_TILE_PIXELS;
  const widthChunks = bounds.maxX - bounds.minX + 1;
  const heightChunks = bounds.maxY - bounds.minY + 1;
  worldPreviewCanvas.width = widthChunks * chunkPixel;
  worldPreviewCanvas.height = heightChunks * chunkPixel;
  worldPreviewCtx.imageSmoothingEnabled = false;

  worldPreviewCtx.fillStyle = "#ffffff";
  worldPreviewCtx.fillRect(0, 0, worldPreviewCanvas.width, worldPreviewCanvas.height);

  const assignments = buildNextgenAssignments(patterns, bounds);
  const passResult = enforceNextgenConnections(assignments, patterns, bounds);

  let totalRooms = 0;
  let totalDoors = 0;
  let totalDoorless = 0;
  let totalUndersized = 0;
  let totalUnfilled = 0;
  let totalPrefabUncovered = 0;
  let totalGrowthAttempted = 0;
  let totalGrowthUpgraded = 0;
  let totalGrowthBlocked = 0;
  let totalReservedResidue = 0;
  const chunkValidators = [];

  for (let cy = bounds.minY; cy <= bounds.maxY; cy += 1) {
    for (let cx = bounds.minX; cx <= bounds.maxX; cx += 1) {
      const assignment = assignments.get(coordKey(cx, cy));
      const chunkSpecials = generateChunkSpecialSpaces(assignment.sockets, cx, cy);
      const chunkAccess = placeChunkAccessCorridors(chunkSpecials.tileMap, cx, cy, accessCatalogue);
      const chunkRooms = generateChunkRooms(chunkAccess.tileMap, cx, cy);
      const connected = hasConnectingNeighbor(assignments, cx, cy);
      const chunkValidator = buildChunkValidator(cx, cy, connected, chunkRooms);
      chunkValidators.push(chunkValidator);

      const pixelX = (cx - bounds.minX) * chunkPixel;
      const pixelY = (cy - bounds.minY) * chunkPixel;
      drawCorridorChunk(
        worldPreviewCtx,
        pixelX,
        pixelY,
        chunkRooms,
        WORLD_PREVIEW_TILE_PIXELS,
        false
      );

      totalRooms += chunkRooms.roomZoneCount;
      totalDoors += chunkRooms.doorCount;
      totalDoorless += chunkRooms.doorlessRooms;
      totalUndersized += chunkRooms.undersizedRooms;
      totalUnfilled += chunkRooms.unfilledCount;
      totalPrefabUncovered += chunkRooms.uncoveredPrefabArea;
      totalGrowthAttempted += chunkRooms.growthAttempted;
      totalGrowthUpgraded += chunkRooms.growthUpgraded;
      totalGrowthBlocked += chunkRooms.growthBlocked;
      totalReservedResidue += chunkRooms.reservedResidueCount;
    }
  }

  const validationSummary = aggregateChunkValidators(chunkValidators);
  const validatorFailingList = formatFailingChunkList(validationSummary.failing, 10);

  if (worldPreviewMeta) {
    worldPreviewMeta.textContent = `Seed: ${NEXTGEN_SEED} | Area: ${WORLD_PREVIEW_CHUNKS_X}x${WORLD_PREVIEW_CHUNKS_Y} chunks | Connection passes: ${passResult.passesRun} | Rerolls: ${passResult.totalRerolls} | Rooms: ${totalRooms} | Doors: ${totalDoors} | Doorless: ${totalDoorless} | Undersized: ${totalUndersized} | Unfilled: ${totalUnfilled} | Prefab-uncovered: ${totalPrefabUncovered} | Growth(A/U/B): ${totalGrowthAttempted}/${totalGrowthUpgraded}/${totalGrowthBlocked} | Reserved residue: ${totalReservedResidue} | Validator: ${validationSummary.passing ? "PASS" : "FAIL"} (${validationSummary.failedCount}/${validationSummary.total} failed) | Failure reasons: ${formatReasonCountMap(validationSummary.failureReasonCounts)} | Failing chunks: ${validatorFailingList}`;
  }
}

function openWorldPreview(patterns, accessCatalogue) {
  if (!worldPreviewScreen || !appMain) {
    return;
  }
  appMain.hidden = true;
  worldPreviewScreen.hidden = false;
  if (worldPreviewMeta) {
    worldPreviewMeta.textContent = "Generating 20x20 chunk preview...";
  }
  requestAnimationFrame(() => {
    try {
      drawWorldPreview(patterns, accessCatalogue);
    } catch (error) {
      if (worldPreviewMeta) {
        worldPreviewMeta.textContent = `Preview generation failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    }
  });
}

function closeWorldPreview() {
  if (!worldPreviewScreen || !appMain) {
    return;
  }
  worldPreviewScreen.hidden = true;
  appMain.hidden = false;
}

const corridorPatterns = buildCorridorTilePatterns();
const accessCorridorCatalogue = buildAccessCorridorCatalogue(corridorPatterns);

drawNextGeneratorRandomized(corridorPatterns, accessCorridorCatalogue);
renderCorridorTileCatalog(corridorPatterns);
renderAccessCorridorCatalog(accessCorridorCatalogue);
renderRoomPrefabCatalog(ROOM_PREFAB_CATALOG);

if (openWorldPreviewButton) {
  openWorldPreviewButton.addEventListener("click", () => {
    openWorldPreview(corridorPatterns, accessCorridorCatalogue);
  });
}

if (closeWorldPreviewButton) {
  closeWorldPreviewButton.addEventListener("click", () => {
    closeWorldPreview();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && worldPreviewScreen && !worldPreviewScreen.hidden) {
    closeWorldPreview();
  }
});

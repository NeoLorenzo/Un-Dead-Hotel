const HUMAN_TEXTURE_KEY = "human-placeholder-v1";
const HUMAN_VISUAL_DIAMETER_TILES = 0.82;
const HUMAN_COLLIDER_DIAMETER_TILES = 0.58;
const HUMAN_COLLIDER_RADIUS_TILES = HUMAN_COLLIDER_DIAMETER_TILES * 0.5;
const HUMAN_SELECTION_RING_SCALE = 0.78;
const HUMAN_SELECTION_RING_COLOR = 0x6bf779;
const DEFAULT_MOVE_SPEED_TILES_PER_SECOND = 2.3;
const DEFAULT_SPAWN_SEARCH_RADIUS_TILES = 10;
const ARRIVAL_RADIUS_TILES = 0.09;
const MIN_MOVEMENT_DISTANCE_TILES = 0.001;
const COLLISION_RESOLVE_STEP_TILES = 0.12;

function clampFinite(value, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function normalizeTilePoint(point) {
  return {
    x: Math.floor(Number(point?.x) || 0),
    y: Math.floor(Number(point?.y) || 0),
  };
}

function normalizeWorldPoint(point) {
  return {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
  };
}

function buildHumanTexture(scene, textureKey) {
  if (scene.textures.exists(textureKey)) {
    return;
  }

  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const size = 64;
  const cx = size * 0.5;
  const bodyRadius = 19;
  const headRadius = 10;

  g.clear();
  g.fillStyle(0x315a3a, 1);
  g.fillCircle(cx, cx + 5, bodyRadius);
  g.fillStyle(0xe8c8aa, 1);
  g.fillCircle(cx, cx - 11, headRadius);
  g.lineStyle(3, 0x122017, 1);
  g.strokeCircle(cx, cx + 5, bodyRadius);
  g.lineStyle(2, 0x122017, 1);
  g.strokeCircle(cx, cx - 11, headRadius);
  g.generateTexture(textureKey, size, size);
  g.destroy();
}

function findNearestWalkableTile(runtime, startTile, maxRadius) {
  if (runtime.isWalkableTile(startTile.x, startTile.y)) {
    return startTile;
  }

  const cappedRadius = Math.max(0, Math.floor(maxRadius));
  for (let radius = 1; radius <= cappedRadius; radius += 1) {
    const minX = startTile.x - radius;
    const maxX = startTile.x + radius;
    const minY = startTile.y - radius;
    const maxY = startTile.y + radius;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (Math.max(Math.abs(x - startTile.x), Math.abs(y - startTile.y)) !== radius) {
          continue;
        }
        if (runtime.isWalkableTile(x, y)) {
          return { x, y };
        }
      }
    }
  }

  return null;
}

function dedupeWorldPoints(points) {
  const out = [];
  let prev = null;
  for (const point of points) {
    const normalized = normalizeWorldPoint(point);
    if (
      prev &&
      Math.abs(prev.x - normalized.x) <= 0.000001 &&
      Math.abs(prev.y - normalized.y) <= 0.000001
    ) {
      continue;
    }
    out.push(normalized);
    prev = normalized;
  }
  return out;
}

export function createHumanController({
  scene,
  runtime,
  moveSpeedTilesPerSecond = DEFAULT_MOVE_SPEED_TILES_PER_SECOND,
  spawnSearchRadiusTiles = DEFAULT_SPAWN_SEARCH_RADIUS_TILES,
  spawnTile: providedSpawnTile = null,
} = {}) {
  if (!scene || !runtime) {
    throw new Error("createHumanController requires scene and runtime.");
  }
  if (!scene.physics) {
    throw new Error("createHumanController requires Phaser Arcade Physics to be enabled.");
  }

  buildHumanTexture(scene, HUMAN_TEXTURE_KEY);

  const cameraTile = runtime.getCameraTilePosition();
  const fallbackStartTile = runtime.worldToTile(cameraTile.x, cameraTile.y);
  const preferredSpawnTile = providedSpawnTile
    ? normalizeTilePoint(providedSpawnTile)
    : fallbackStartTile;
  const spawnTile =
    findNearestWalkableTile(runtime, preferredSpawnTile, spawnSearchRadiusTiles) ||
    findNearestWalkableTile(runtime, preferredSpawnTile, 64) ||
    preferredSpawnTile;
  const spawnWorld = runtime.tileToWorldCenter(spawnTile.x, spawnTile.y);

  const sprite = scene.add.sprite(0, 0, HUMAN_TEXTURE_KEY);
  sprite.setOrigin(0.5, 0.5);
  sprite.setDepth(25);
  const selectionRing = scene.add.graphics();
  selectionRing.setDepth(30);
  scene.physics.add.existing(sprite);
  const body = sprite.body;
  body.setAllowGravity(false);
  body.setImmovable(true);
  // Movement is simulated in world-space and projected to screen-space manually.
  // Keep Arcade body synced as collider visualization only.
  body.moves = false;

  const worldPosition = {
    x: spawnWorld.x,
    y: spawnWorld.y,
  };
  const worldVelocity = {
    x: 0,
    y: 0,
  };

  let selected = false;
  let pathWaypointsWorld = [];
  let waypointIndex = 0;
  let lastTilePixels = 12;
  let lastScreenX = 0;
  let lastScreenY = 0;
  let lastDisplaySize = 0;
  let pendingPathBlockedEvent = null;

  function redrawSelectionRing() {
    selectionRing.clear();
    if (!selected || lastDisplaySize <= 0) {
      return;
    }

    const radius = Math.max(4, lastDisplaySize * HUMAN_SELECTION_RING_SCALE * 0.5);
    const lineWidth = Math.max(1, Math.round(lastTilePixels * 0.12));
    selectionRing.lineStyle(lineWidth, HUMAN_SELECTION_RING_COLOR, 1);
    selectionRing.strokeCircle(
      Math.round(lastScreenX),
      Math.round(lastScreenY),
      Math.round(radius)
    );
  }

  function clearVelocity() {
    worldVelocity.x = 0;
    worldVelocity.y = 0;
  }

  function isWalkableWorld(worldX, worldY) {
    if (typeof runtime.isWalkableWorldRect === "function") {
      return runtime.isWalkableWorldRect(
        worldX,
        worldY,
        HUMAN_COLLIDER_RADIUS_TILES,
        HUMAN_COLLIDER_RADIUS_TILES
      );
    }
    if (typeof runtime.isWalkableWorldPoint === "function") {
      return runtime.isWalkableWorldPoint(worldX, worldY, HUMAN_COLLIDER_RADIUS_TILES);
    }
    const tile = runtime.worldToTile(worldX, worldY);
    return runtime.isWalkableTile(tile.x, tile.y);
  }

  function sanitizeWorldPath(pathWorldPoints) {
    if (!Array.isArray(pathWorldPoints)) {
      return [];
    }
    const points = [];
    for (const point of pathWorldPoints) {
      const normalized = normalizeWorldPoint(point);
      if (!isWalkableWorld(normalized.x, normalized.y)) {
        continue;
      }
      points.push(normalized);
    }
    return dedupeWorldPoints(points);
  }

  function clearPath() {
    pathWaypointsWorld = [];
    waypointIndex = 0;
    clearVelocity();
  }

  function setPath(nextPathTiles, options = {}) {
    const tileWaypoints = Array.isArray(nextPathTiles)
      ? nextPathTiles.map((tile) => normalizeTilePoint(tile))
      : [];
    const worldWaypoints = [];
    for (const tile of tileWaypoints) {
      worldWaypoints.push(runtime.tileToWorldCenter(tile.x, tile.y));
    }
    if (
      options?.finalWorldTarget &&
      Number.isFinite(options.finalWorldTarget.x) &&
      Number.isFinite(options.finalWorldTarget.y)
    ) {
      worldWaypoints.push(normalizeWorldPoint(options.finalWorldTarget));
    }
    setWorldPath(worldWaypoints);
  }

  function setWorldPath(nextWorldPathPoints) {
    const sanitized = sanitizeWorldPath(nextWorldPathPoints);
    pendingPathBlockedEvent = null;
    if (sanitized.length === 0) {
      clearPath();
      return;
    }

    pathWaypointsWorld = sanitized;
    waypointIndex = 0;
  }

  function moveWithCollisionGate(dx, dy) {
    const startX = worldPosition.x;
    const startY = worldPosition.y;
    if (typeof runtime.resolveWorldRectMovement === "function") {
      const resolved = runtime.resolveWorldRectMovement({
        startWorldX: startX,
        startWorldY: startY,
        deltaWorldX: dx,
        deltaWorldY: dy,
        halfWidthTiles: HUMAN_COLLIDER_RADIUS_TILES,
        halfHeightTiles: HUMAN_COLLIDER_RADIUS_TILES,
        stepTiles: COLLISION_RESOLVE_STEP_TILES,
      });
      worldPosition.x = resolved.worldX;
      worldPosition.y = resolved.worldY;
      return {
        moved: resolved.moved,
        dx: worldPosition.x - startX,
        dy: worldPosition.y - startY,
      };
    }

    const nextX = startX + dx;
    const nextY = startY + dy;
    if (isWalkableWorld(nextX, nextY)) {
      worldPosition.x = nextX;
      worldPosition.y = nextY;
      return {
        moved: true,
        dx: worldPosition.x - startX,
        dy: worldPosition.y - startY,
      };
    }

    const xOnlyWalkable = dx !== 0 && isWalkableWorld(startX + dx, startY);
    const yOnlyWalkable = dy !== 0 && isWalkableWorld(startX, startY + dy);

    if (xOnlyWalkable && yOnlyWalkable) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        worldPosition.x = startX + dx;
      } else {
        worldPosition.y = startY + dy;
      }
    } else if (xOnlyWalkable) {
      worldPosition.x = startX + dx;
    } else if (yOnlyWalkable) {
      worldPosition.y = startY + dy;
    }

    return {
      moved:
        Math.abs(worldPosition.x - startX) > 0.000001 ||
        Math.abs(worldPosition.y - startY) > 0.000001,
      dx: worldPosition.x - startX,
      dy: worldPosition.y - startY,
    };
  }

  function update(dtSeconds) {
    const dt = clampFinite(dtSeconds, 0);
    if (dt <= 0) {
      clearVelocity();
      return false;
    }
    if (waypointIndex >= pathWaypointsWorld.length) {
      clearVelocity();
      return false;
    }

    const targetWorld = pathWaypointsWorld[waypointIndex];
    const toTargetX = targetWorld.x - worldPosition.x;
    const toTargetY = targetWorld.y - worldPosition.y;
    const distance = Math.hypot(toTargetX, toTargetY);

    if (distance <= ARRIVAL_RADIUS_TILES) {
      clearVelocity();
      waypointIndex += 1;
      if (waypointIndex >= pathWaypointsWorld.length) {
        clearPath();
      }
      return true;
    }

    const maxStep = moveSpeedTilesPerSecond * dt;
    const step = Math.min(maxStep, distance);
    const stepX = (toTargetX / distance) * step;
    const stepY = (toTargetY / distance) * step;
    const moveResult = moveWithCollisionGate(stepX, stepY);
    const movedDistance = Math.hypot(moveResult.dx, moveResult.dy);

    if (!moveResult.moved || movedDistance < MIN_MOVEMENT_DISTANCE_TILES) {
      const currentTile = runtime.worldToTile(worldPosition.x, worldPosition.y);
      const blockedTile = runtime.worldToTile(targetWorld.x, targetWorld.y);
      pendingPathBlockedEvent = {
        fromWorld: { x: worldPosition.x, y: worldPosition.y },
        blockedTargetWorld: { x: targetWorld.x, y: targetWorld.y },
        fromTile: { x: currentTile.x, y: currentTile.y },
        blockedTile: { x: blockedTile.x, y: blockedTile.y },
      };
      clearPath();
      return false;
    }

    worldVelocity.x = moveResult.dx / dt;
    worldVelocity.y = moveResult.dy / dt;
    return true;
  }

  function syncToView({
    cameraTile,
    tilePixels,
    viewWidthPx,
    viewHeightPx,
  }) {
    lastTilePixels = Math.max(1, clampFinite(tilePixels, lastTilePixels));

    const screenX =
      (worldPosition.x - cameraTile.x) * lastTilePixels + viewWidthPx * 0.5;
    const screenY =
      (worldPosition.y - cameraTile.y) * lastTilePixels + viewHeightPx * 0.5;
    const displaySize = Math.max(8, lastTilePixels * HUMAN_VISUAL_DIAMETER_TILES);
    lastScreenX = screenX;
    lastScreenY = screenY;
    lastDisplaySize = displaySize;

    sprite.setPosition(screenX, screenY);
    sprite.setDisplaySize(displaySize, displaySize);
    redrawSelectionRing();

    if (body) {
      const bodySize = Math.max(6, displaySize * HUMAN_COLLIDER_DIAMETER_TILES);
      body.setSize(bodySize, bodySize, true);
      body.updateFromGameObject();
    }
  }

  function select() {
    selected = true;
    redrawSelectionRing();
  }

  function deselect() {
    selected = false;
    redrawSelectionRing();
  }

  function isSelected() {
    return selected;
  }

  function getBoundsWorld() {
    return {
      x: worldPosition.x - HUMAN_COLLIDER_RADIUS_TILES,
      y: worldPosition.y - HUMAN_COLLIDER_RADIUS_TILES,
      w: HUMAN_COLLIDER_DIAMETER_TILES,
      h: HUMAN_COLLIDER_DIAMETER_TILES,
    };
  }

  function getDebugState() {
    return {
      spawnTile: { ...spawnTile },
      worldPosition: { ...worldPosition },
      worldVelocity: { ...worldVelocity },
      collider: getBoundsWorld(),
      pathWorld: pathWaypointsWorld.map((point) => ({ ...point })),
      waypointIndex,
      selected,
    };
  }

  function getScreenBounds() {
    const bounds = sprite.getBounds();
    return {
      x: bounds.x,
      y: bounds.y,
      w: bounds.width,
      h: bounds.height,
    };
  }

  function containsScreenPoint(screenX, screenY) {
    const bounds = getScreenBounds();
    return (
      screenX >= bounds.x &&
      screenX <= bounds.x + bounds.w &&
      screenY >= bounds.y &&
      screenY <= bounds.y + bounds.h
    );
  }

  function intersectsScreenRect(rect) {
    if (!rect) {
      return false;
    }
    const bounds = getScreenBounds();
    const rectRight = rect.x + rect.w;
    const rectBottom = rect.y + rect.h;
    const boundsRight = bounds.x + bounds.w;
    const boundsBottom = bounds.y + bounds.h;
    return !(
      boundsRight < rect.x ||
      bounds.x > rectRight ||
      boundsBottom < rect.y ||
      bounds.y > rectBottom
    );
  }

  function destroy() {
    clearPath();
    selectionRing.destroy();
    sprite.destroy();
  }

  function getCurrentTile() {
    const tile = runtime.worldToTile(worldPosition.x, worldPosition.y);
    return { x: tile.x, y: tile.y };
  }

  function getCurrentWorldPosition() {
    return { x: worldPosition.x, y: worldPosition.y };
  }

  function hasActivePath() {
    return waypointIndex < pathWaypointsWorld.length;
  }

  function consumePathBlockedEvent() {
    const event = pendingPathBlockedEvent;
    pendingPathBlockedEvent = null;
    return event;
  }

  return {
    select,
    deselect,
    isSelected,
    setPath,
    setWorldPath,
    clearPath,
    update,
    syncToView,
    getBoundsWorld,
    getScreenBounds,
    containsScreenPoint,
    intersectsScreenRect,
    getDebugState,
    getCurrentTile,
    getCurrentWorldPosition,
    hasActivePath,
    consumePathBlockedEvent,
    getSpawnTile: () => ({ ...spawnTile }),
    destroy,
  };
}

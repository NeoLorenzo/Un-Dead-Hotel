export const ZOMBIE_TEXTURE_KEY = "zombie-placeholder-v1";
export const ZOMBIE_VISUAL_DIAMETER_TILES = 0.82;
export const ZOMBIE_COLLIDER_RADIUS_TILES = 0.28;
export const ZOMBIE_VISION_CONE_ANGLE_DEGREES = 90;
export const ZOMBIE_VISION_CONE_RANGE_TILES = 8;

const DEFAULT_MOVE_SPEED_TILES_PER_SECOND = 1.0;
const DEFAULT_ARRIVAL_RADIUS_TILES = 0.2;
const MIN_MOVEMENT_DISTANCE_TILES = 0.001;
const COLLISION_RESOLVE_STEP_TILES = 0.12;

function clampFinite(value, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function normalizeAngleRadians(angleRadians) {
  let angle = Number(angleRadians) || 0;
  while (angle > Math.PI) {
    angle -= Math.PI * 2;
  }
  while (angle < -Math.PI) {
    angle += Math.PI * 2;
  }
  return angle;
}

function isWalkableWorld(runtime, worldX, worldY) {
  if (typeof runtime.isWalkableWorldRect === "function") {
    return runtime.isWalkableWorldRect(
      worldX,
      worldY,
      ZOMBIE_COLLIDER_RADIUS_TILES,
      ZOMBIE_COLLIDER_RADIUS_TILES
    );
  }
  if (typeof runtime.isWalkableWorldPoint === "function") {
    return runtime.isWalkableWorldPoint(worldX, worldY, ZOMBIE_COLLIDER_RADIUS_TILES);
  }
  const tile = runtime.worldToTile(worldX, worldY);
  return runtime.isWalkableTile(tile.x, tile.y);
}

function normalizeWorldPoint(point) {
  return {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
  };
}

export function createZombieController({
  id,
  scene,
  runtime,
  initialWorld,
  moveSpeedTilesPerSecond = DEFAULT_MOVE_SPEED_TILES_PER_SECOND,
  arrivalRadiusTiles = DEFAULT_ARRIVAL_RADIUS_TILES,
} = {}) {
  if (!scene || !runtime) {
    throw new Error("createZombieController requires scene and runtime.");
  }
  if (!Number.isFinite(id)) {
    throw new Error("createZombieController requires numeric id.");
  }

  const spawnWorld = normalizeWorldPoint(initialWorld);
  const sprite = scene.add.sprite(0, 0, ZOMBIE_TEXTURE_KEY);
  sprite.setOrigin(0.5, 0.5);
  sprite.setDepth(24);

  const worldPosition = {
    x: spawnWorld.x,
    y: spawnWorld.y,
  };
  const worldVelocity = {
    x: 0,
    y: 0,
  };
  const moveSpeed = Math.max(0.01, Number(moveSpeedTilesPerSecond) || DEFAULT_MOVE_SPEED_TILES_PER_SECOND);
  const arrivalRadius = Math.max(0.01, Number(arrivalRadiusTiles) || DEFAULT_ARRIVAL_RADIUS_TILES);

  let headingRadians = 0;
  let waypointWorld = null;
  let lastTilePixels = 12;

  function clearVelocity() {
    worldVelocity.x = 0;
    worldVelocity.y = 0;
  }

  function setWaypointWorld(nextWaypoint) {
    if (!Number.isFinite(nextWaypoint?.x) || !Number.isFinite(nextWaypoint?.y)) {
      waypointWorld = null;
      return false;
    }
    const normalized = normalizeWorldPoint(nextWaypoint);
    if (!isWalkableWorld(runtime, normalized.x, normalized.y)) {
      waypointWorld = null;
      return false;
    }
    waypointWorld = normalized;
    return true;
  }

  function clearWaypoint() {
    waypointWorld = null;
    clearVelocity();
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
        halfWidthTiles: ZOMBIE_COLLIDER_RADIUS_TILES,
        halfHeightTiles: ZOMBIE_COLLIDER_RADIUS_TILES,
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
    if (isWalkableWorld(runtime, nextX, nextY)) {
      worldPosition.x = nextX;
      worldPosition.y = nextY;
      return {
        moved: true,
        dx: worldPosition.x - startX,
        dy: worldPosition.y - startY,
      };
    }

    return {
      moved: false,
      dx: 0,
      dy: 0,
    };
  }

  function update(dtSeconds) {
    const dt = clampFinite(dtSeconds, 0);
    if (dt <= 0) {
      clearVelocity();
      return false;
    }
    if (!waypointWorld) {
      clearVelocity();
      return false;
    }

    const toTargetX = waypointWorld.x - worldPosition.x;
    const toTargetY = waypointWorld.y - worldPosition.y;
    const distance = Math.hypot(toTargetX, toTargetY);

    if (distance <= arrivalRadius) {
      clearWaypoint();
      return true;
    }

    headingRadians = Math.atan2(toTargetY, toTargetX);
    const maxStep = moveSpeed * dt;
    const step = Math.min(maxStep, distance);
    const stepX = (toTargetX / distance) * step;
    const stepY = (toTargetY / distance) * step;
    const moveResult = moveWithCollisionGate(stepX, stepY);
    const movedDistance = Math.hypot(moveResult.dx, moveResult.dy);

    if (!moveResult.moved || movedDistance < MIN_MOVEMENT_DISTANCE_TILES) {
      clearWaypoint();
      return true;
    }

    worldVelocity.x = moveResult.dx / dt;
    worldVelocity.y = moveResult.dy / dt;

    const remainingX = waypointWorld.x - worldPosition.x;
    const remainingY = waypointWorld.y - worldPosition.y;
    const remainingDistance = Math.hypot(remainingX, remainingY);
    if (remainingDistance <= arrivalRadius) {
      clearWaypoint();
      return true;
    }

    return true;
  }

  function nudge(deltaWorldX, deltaWorldY) {
    if (!Number.isFinite(deltaWorldX) || !Number.isFinite(deltaWorldY)) {
      return false;
    }
    const moveResult = moveWithCollisionGate(deltaWorldX, deltaWorldY);
    if (!moveResult.moved) {
      return false;
    }
    const distance = Math.hypot(moveResult.dx, moveResult.dy);
    if (distance < MIN_MOVEMENT_DISTANCE_TILES) {
      return false;
    }
    headingRadians = Math.atan2(moveResult.dy, moveResult.dx);
    return true;
  }

  function syncToView({
    cameraTile,
    tilePixels,
    viewWidthPx,
    viewHeightPx,
  }) {
    lastTilePixels = Math.max(1, clampFinite(tilePixels, lastTilePixels));
    const displaySize = Math.max(8, lastTilePixels * ZOMBIE_VISUAL_DIAMETER_TILES);
    const screenX =
      (worldPosition.x - cameraTile.x) * lastTilePixels + viewWidthPx * 0.5;
    const screenY =
      (worldPosition.y - cameraTile.y) * lastTilePixels + viewHeightPx * 0.5;
    sprite.setPosition(screenX, screenY);
    sprite.setDisplaySize(displaySize, displaySize);
  }

  function getWorldPosition() {
    return {
      x: worldPosition.x,
      y: worldPosition.y,
    };
  }

  function getHeadingRadians() {
    return headingRadians;
  }

  function setHeadingRadians(nextHeadingRadians) {
    if (!Number.isFinite(nextHeadingRadians)) {
      return false;
    }
    headingRadians = normalizeAngleRadians(nextHeadingRadians);
    return true;
  }

  function rotateHeading(deltaRadians) {
    if (!Number.isFinite(deltaRadians)) {
      return false;
    }
    headingRadians = normalizeAngleRadians(headingRadians + deltaRadians);
    return true;
  }

  function getVisionCone() {
    return {
      angleDegrees: ZOMBIE_VISION_CONE_ANGLE_DEGREES,
      rangeTiles: ZOMBIE_VISION_CONE_RANGE_TILES,
    };
  }

  function getColliderWorld() {
    return {
      x: worldPosition.x - ZOMBIE_COLLIDER_RADIUS_TILES,
      y: worldPosition.y - ZOMBIE_COLLIDER_RADIUS_TILES,
      w: ZOMBIE_COLLIDER_RADIUS_TILES * 2,
      h: ZOMBIE_COLLIDER_RADIUS_TILES * 2,
    };
  }

  function getDebugState() {
    return {
      id,
      worldPosition: getWorldPosition(),
      worldVelocity: {
        x: worldVelocity.x,
        y: worldVelocity.y,
      },
      collider: getColliderWorld(),
      headingRadians,
      visionConeAngleDegrees: ZOMBIE_VISION_CONE_ANGLE_DEGREES,
      visionConeRangeTiles: ZOMBIE_VISION_CONE_RANGE_TILES,
      waypointWorld: waypointWorld ? { ...waypointWorld } : null,
    };
  }

  function destroy() {
    clearWaypoint();
    sprite.destroy();
  }

  return {
    getId: () => id,
    setWaypointWorld,
    clearWaypoint,
    hasWaypoint: () => Boolean(waypointWorld),
    update,
    nudge,
    syncToView,
    getWorldPosition,
    getHeadingRadians,
    setHeadingRadians,
    rotateHeading,
    getVisionCone,
    getColliderWorld,
    getDebugState,
    destroy,
  };
}

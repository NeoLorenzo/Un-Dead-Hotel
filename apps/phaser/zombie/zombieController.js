import {
  createHealthModel,
  DEFAULT_AGENT_MAX_HP,
} from "../combat/healthModel.js";

export const ZOMBIE_TEXTURE_KEY = "zombie-placeholder-v1";
export const ZOMBIE_VISUAL_DIAMETER_TILES = 0.82;
export const ZOMBIE_COLLIDER_RADIUS_TILES = 0.28;
export const ZOMBIE_VISION_CONE_ANGLE_DEGREES = 90;
export const ZOMBIE_VISION_CONE_RANGE_TILES = 8;
const ZOMBIE_DEAD_TINT = 0x7a3f3f;
const ZOMBIE_ALIVE_TINT = 0xffffff;

const DEFAULT_MOVE_SPEED_TILES_PER_SECOND = 1.0;
const DEFAULT_ARRIVAL_RADIUS_TILES = 0.2;
const DEFAULT_ZOMBIE_MAX_HP = DEFAULT_AGENT_MAX_HP;
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

function normalizeTilePoint(point) {
  return {
    x: Math.floor(Number(point?.x) || 0),
    y: Math.floor(Number(point?.y) || 0),
  };
}

function dedupeWorldPoints(points) {
  const out = [];
  let previous = null;
  for (const point of points) {
    const normalized = normalizeWorldPoint(point);
    if (
      previous &&
      Math.abs(previous.x - normalized.x) <= 0.000001 &&
      Math.abs(previous.y - normalized.y) <= 0.000001
    ) {
      continue;
    }
    out.push(normalized);
    previous = normalized;
  }
  return out;
}

export function createZombieController({
  id,
  scene,
  runtime,
  initialWorld,
  moveSpeedTilesPerSecond = DEFAULT_MOVE_SPEED_TILES_PER_SECOND,
  arrivalRadiusTiles = DEFAULT_ARRIVAL_RADIUS_TILES,
  maxHp = DEFAULT_ZOMBIE_MAX_HP,
  currentHp = maxHp,
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
  const health = createHealthModel({
    maxHp,
    currentHp,
    onDeath: () => {
      clearWaypoint();
      sprite.setTint(ZOMBIE_DEAD_TINT);
      sprite.setAlpha(0.86);
    },
    onRevive: () => {
      sprite.setTint(ZOMBIE_ALIVE_TINT);
      sprite.setAlpha(1);
    },
  });
  if (health.isDead()) {
    sprite.setTint(ZOMBIE_DEAD_TINT);
    sprite.setAlpha(0.86);
  }
  const moveSpeed = Math.max(0.01, Number(moveSpeedTilesPerSecond) || DEFAULT_MOVE_SPEED_TILES_PER_SECOND);
  const arrivalRadius = Math.max(0.01, Number(arrivalRadiusTiles) || DEFAULT_ARRIVAL_RADIUS_TILES);

  let headingRadians = 0;
  let pathWaypointsWorld = [];
  let waypointIndex = 0;
  let lastTilePixels = 12;

  function clearVelocity() {
    worldVelocity.x = 0;
    worldVelocity.y = 0;
  }

  function sanitizeWorldPath(pathWorldPoints) {
    if (!Array.isArray(pathWorldPoints)) {
      return [];
    }
    const points = [];
    for (const point of pathWorldPoints) {
      const normalized = normalizeWorldPoint(point);
      if (!isWalkableWorld(runtime, normalized.x, normalized.y)) {
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

  function setPath(nextPathTiles) {
    if (health.isDead()) {
      clearPath();
      return false;
    }
    const tileWaypoints = Array.isArray(nextPathTiles)
      ? nextPathTiles.map((tile) => normalizeTilePoint(tile))
      : [];
    const worldWaypoints = [];
    for (const tile of tileWaypoints) {
      worldWaypoints.push(runtime.tileToWorldCenter(tile.x, tile.y));
    }
    return setWorldPath(worldWaypoints);
  }

  function setWorldPath(nextWorldPathPoints) {
    if (health.isDead()) {
      clearPath();
      return false;
    }
    const sanitized = sanitizeWorldPath(nextWorldPathPoints);
    if (sanitized.length === 0) {
      clearPath();
      return false;
    }

    pathWaypointsWorld = sanitized;
    waypointIndex = 0;
    return true;
  }

  function clearWaypoint() {
    clearPath();
  }

  function hasWaypoint() {
    return waypointIndex < pathWaypointsWorld.length;
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
    if (health.isDead()) {
      clearVelocity();
      return false;
    }
    const dt = clampFinite(dtSeconds, 0);
    if (dt <= 0) {
      clearVelocity();
      return false;
    }
    if (waypointIndex >= pathWaypointsWorld.length) {
      clearVelocity();
      return false;
    }

    const waypointWorld = pathWaypointsWorld[waypointIndex];
    const toTargetX = waypointWorld.x - worldPosition.x;
    const toTargetY = waypointWorld.y - worldPosition.y;
    const distance = Math.hypot(toTargetX, toTargetY);

    if (distance <= arrivalRadius) {
      waypointIndex += 1;
      if (waypointIndex >= pathWaypointsWorld.length) {
        clearPath();
      } else {
        clearVelocity();
      }
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
      clearPath();
      return true;
    }

    worldVelocity.x = moveResult.dx / dt;
    worldVelocity.y = moveResult.dy / dt;

    const remainingX = waypointWorld.x - worldPosition.x;
    const remainingY = waypointWorld.y - worldPosition.y;
    const remainingDistance = Math.hypot(remainingX, remainingY);
    if (remainingDistance <= arrivalRadius) {
      waypointIndex += 1;
      if (waypointIndex >= pathWaypointsWorld.length) {
        clearPath();
      } else {
        clearVelocity();
      }
      return true;
    }

    return true;
  }

  function nudge(deltaWorldX, deltaWorldY) {
    if (health.isDead()) {
      return false;
    }
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
      moveSpeedTilesPerSecond: moveSpeed,
      collider: getColliderWorld(),
      headingRadians,
      health: health.getState(),
      visionConeAngleDegrees: ZOMBIE_VISION_CONE_ANGLE_DEGREES,
      visionConeRangeTiles: ZOMBIE_VISION_CONE_RANGE_TILES,
      waypointWorld: hasWaypoint()
        ? {
            x: pathWaypointsWorld[waypointIndex].x,
            y: pathWaypointsWorld[waypointIndex].y,
          }
        : null,
      pathWorld: pathWaypointsWorld
        .slice(waypointIndex)
        .map((point) => ({ ...point })),
      waypointIndex,
    };
  }

  function destroy() {
    clearWaypoint();
    sprite.destroy();
  }

  function applyDamage(amount) {
    return health.applyDamage(amount);
  }

  function heal(amount) {
    return health.heal(amount);
  }

  function setCurrentHp(nextCurrentHp) {
    return health.setCurrentHp(nextCurrentHp);
  }

  function setMaxHp(nextMaxHp, options) {
    return health.setMaxHp(nextMaxHp, options);
  }

  return {
    getId: () => id,
    setPath,
    setWorldPath,
    clearPath,
    clearWaypoint,
    hasWaypoint,
    update,
    nudge,
    syncToView,
    getWorldPosition,
    getHeadingRadians,
    setHeadingRadians,
    rotateHeading,
    getVisionCone,
    getColliderWorld,
    getMoveSpeedTilesPerSecond: () => moveSpeed,
    getHealthState: () => health.getState(),
    getCurrentHp: () => health.getCurrentHp(),
    getMaxHp: () => health.getMaxHp(),
    isDead: () => health.isDead(),
    applyDamage,
    heal,
    setCurrentHp,
    setMaxHp,
    getDebugState,
    destroy,
  };
}

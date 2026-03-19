import { ZOMBIE_COLLIDER_RADIUS_TILES } from "../zombie/zombieController.js";

const BLACKOUT_ALPHA = 0.9;
const BLOCKED_FILL_COLOR = 0xff4d4d;
const BLOCKED_FILL_ALPHA = 0.72;
const BLOCKED_STROKE_COLOR = 0xff9a9a;
const BLOCKED_STROKE_ALPHA = 0.45;
const COLLIDER_STROKE_COLOR = 0x89ff4f;
const COLLIDER_STROKE_ALPHA = 1;
const COLLIDER_FILL_COLOR = 0x89ff4f;
const COLLIDER_FILL_ALPHA = 0.2;
const CONE_FILL_COLOR = 0x86f7c1;
const CONE_FILL_ALPHA = 0.2;
const CONE_STROKE_COLOR = 0x86f7c1;
const CONE_STROKE_ALPHA = 0.85;
const PATH_STROKE_COLOR = 0x64fffa;
const PATH_STROKE_ALPHA = 1;
const WAYPOINT_FILL_COLOR = 0x64fffa;
const WAYPOINT_FILL_ALPHA = 0.8;
const CANDIDATE_ACCEPTED_COLOR = 0x64fffa;
const CANDIDATE_ACCEPTED_ALPHA = 0.85;
const CANDIDATE_FALLBACK_COLOR = 0x52d1ff;
const CANDIDATE_FALLBACK_ALPHA = 0.92;
const CANDIDATE_FAILED_SECTOR_COLOR = 0xb084ff;
const CANDIDATE_FAILED_SECTOR_ALPHA = 0.86;
const CANDIDATE_BLOCKED_COLOR = 0xff5a5a;
const CANDIDATE_BLOCKED_ALPHA = 0.7;
const CANDIDATE_LOS_BLOCKED_COLOR = 0xffb347;
const CANDIDATE_LOS_BLOCKED_ALPHA = 0.78;
const CANDIDATE_NO_CONTINUATION_COLOR = 0xffe26a;
const CANDIDATE_NO_CONTINUATION_ALPHA = 0.7;
const CANDIDATE_TOO_CLOSE_COLOR = 0xff7ad9;
const CANDIDATE_TOO_CLOSE_ALPHA = 0.9;
const RAY_OPEN_COLOR = 0x6df5c3;
const RAY_OPEN_ALPHA = 0.24;
const RAY_BLOCKED_SECTOR_COLOR = 0xb084ff;
const RAY_BLOCKED_SECTOR_ALPHA = 0.3;
const FAILED_SECTOR_ARC_COLOR = 0xb084ff;
const FAILED_SECTOR_ARC_ALPHA = 0.86;
const RECOVERY_RING_COLOR = 0xffd166;
const RECOVERY_RING_ALPHA = 0.95;
const HEADING_STROKE_COLOR = 0xffd166;
const HEADING_STROKE_ALPHA = 0.95;
const LIVE_CONE_RAY_COUNT = 20;
const LIVE_CONE_STEP_TILES = 0.2;

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

function shortestAngleDeltaRadians(fromRadians, toRadians) {
  return normalizeAngleRadians(toRadians - fromRadians);
}

function isAngleBlockedBySectors(angleRadians, blockedSectorsRadians) {
  if (!Array.isArray(blockedSectorsRadians) || blockedSectorsRadians.length === 0) {
    return false;
  }
  const normalizedAngle = normalizeAngleRadians(angleRadians);
  for (const sector of blockedSectorsRadians) {
    const centerRadians = normalizeAngleRadians(sector?.centerRadians || 0);
    const halfAngleRadians = Math.max(0, Number(sector?.halfAngleRadians) || 0);
    if (halfAngleRadians <= 0) {
      continue;
    }
    const delta = Math.abs(shortestAngleDeltaRadians(centerRadians, normalizedAngle));
    if (delta <= halfAngleRadians) {
      return true;
    }
  }
  return false;
}

function isWalkableWorld(runtime, worldX, worldY) {
  if (typeof runtime?.isWalkableWorldPoint === "function") {
    return runtime.isWalkableWorldPoint(worldX, worldY, ZOMBIE_COLLIDER_RADIUS_TILES);
  }
  if (typeof runtime?.isWalkableWorldRect === "function") {
    return runtime.isWalkableWorldRect(
      worldX,
      worldY,
      ZOMBIE_COLLIDER_RADIUS_TILES,
      ZOMBIE_COLLIDER_RADIUS_TILES
    );
  }
  const tile = runtime?.worldToTile?.(worldX, worldY);
  if (!tile) {
    return false;
  }
  return runtime?.isWalkableTile?.(tile.x, tile.y) === true;
}

function computeRayMaxReach(runtime, startWorld, angleRadians, maxRangeTiles, stepTiles) {
  const safeRange = Math.max(0, Number(maxRangeTiles) || 0);
  if (safeRange <= 0) {
    return 0;
  }
  const safeStep = Math.max(0.01, Number(stepTiles) || LIVE_CONE_STEP_TILES);
  let lastWalkableDistance = 0;
  for (let distance = safeStep; distance <= safeRange + 0.000001; distance += safeStep) {
    const clampedDistance = Math.min(distance, safeRange);
    const sampleX = startWorld.x + Math.cos(angleRadians) * clampedDistance;
    const sampleY = startWorld.y + Math.sin(angleRadians) * clampedDistance;
    if (!isWalkableWorld(runtime, sampleX, sampleY)) {
      return lastWalkableDistance;
    }
    lastWalkableDistance = clampedDistance;
  }
  return lastWalkableDistance;
}

function buildLiveClippedConeRays(runtime, zombie, rayCount = LIVE_CONE_RAY_COUNT) {
  const position = zombie?.worldPosition;
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return [];
  }

  const headingRadians = Number.isFinite(zombie?.headingRadians) ? zombie.headingRadians : 0;
  const coneAngleDegrees = Math.max(0, Number(zombie?.visionConeAngleDegrees) || 0);
  const coneRangeTiles = Math.max(0, Number(zombie?.visionConeRangeTiles) || 0);
  if (coneRangeTiles <= 0) {
    return [];
  }

  const blockedSectorsRadians = Array.isArray(zombie?.wanderRecovery?.failedSectors)
    ? zombie.wanderRecovery.failedSectors
    : [];
  const safeRayCount = Math.max(1, Math.floor(rayCount));
  const halfAngleRadians = ((coneAngleDegrees * Math.PI) / 180) * 0.5;
  const startAngle = headingRadians - halfAngleRadians;
  const totalWidth = halfAngleRadians * 2;
  const rays = [];

  for (let i = 0; i < safeRayCount; i += 1) {
    const t = safeRayCount === 1 ? 0.5 : i / (safeRayCount - 1);
    const angleRadians = normalizeAngleRadians(startAngle + totalWidth * t);
    const blockedBySector = isAngleBlockedBySectors(angleRadians, blockedSectorsRadians);
    const maxReach = blockedBySector
      ? 0
      : computeRayMaxReach(runtime, position, angleRadians, coneRangeTiles, LIVE_CONE_STEP_TILES);
    rays.push({
      x: position.x + Math.cos(angleRadians) * maxReach,
      y: position.y + Math.sin(angleRadians) * maxReach,
      angleRadians,
      maxReach,
      blockedBySector,
    });
  }

  return rays;
}

function worldToScreen(worldX, worldY, cameraTile, tilePixels, width, height) {
  return {
    x: (worldX - cameraTile.x) * tilePixels + width * 0.5,
    y: (worldY - cameraTile.y) * tilePixels + height * 0.5,
  };
}

function worldRectScreen(worldX, worldY, worldW, worldH, cameraTile, tilePixels, width, height) {
  const topLeft = worldToScreen(worldX, worldY, cameraTile, tilePixels, width, height);
  const bottomRight = worldToScreen(
    worldX + worldW,
    worldY + worldH,
    cameraTile,
    tilePixels,
    width,
    height
  );
  return {
    x: Math.floor(topLeft.x),
    y: Math.floor(topLeft.y),
    w: Math.max(1, Math.floor(bottomRight.x - topLeft.x)),
    h: Math.max(1, Math.floor(bottomRight.y - topLeft.y)),
  };
}

function drawCollisionObstacles(overlay, runtime, cameraTile, tilePixels, width, height) {
  overlay.fillStyle(BLOCKED_FILL_COLOR, BLOCKED_FILL_ALPHA);
  overlay.lineStyle(1, BLOCKED_STROKE_COLOR, BLOCKED_STROKE_ALPHA);
  runtime.forEachVisibleCollisionObstacle(width, height, tilePixels, (obstacle) => {
    if (!Number.isFinite(obstacle?.w) || !Number.isFinite(obstacle?.h)) {
      return;
    }
    if (obstacle.w <= 0 || obstacle.h <= 0) {
      return;
    }
    const rect = worldRectScreen(
      obstacle.x,
      obstacle.y,
      obstacle.w,
      obstacle.h,
      cameraTile,
      tilePixels,
      width,
      height
    );
    overlay.fillRect(rect.x, rect.y, rect.w, rect.h);
    overlay.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w, rect.h);
  });
}

function drawZombieCollider(overlay, zombie, cameraTile, tilePixels, width, height) {
  const collider = zombie?.collider;
  if (!collider) {
    return;
  }
  const rect = worldRectScreen(
    collider.x,
    collider.y,
    collider.w,
    collider.h,
    cameraTile,
    tilePixels,
    width,
    height
  );
  overlay.fillStyle(COLLIDER_FILL_COLOR, COLLIDER_FILL_ALPHA);
  overlay.fillRect(rect.x, rect.y, rect.w, rect.h);
  overlay.lineStyle(Math.max(1, Math.round(tilePixels * 0.18)), COLLIDER_STROKE_COLOR, COLLIDER_STROKE_ALPHA);
  overlay.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w, rect.h);
}

function drawHeading(overlay, zombie, cameraTile, tilePixels, width, height) {
  const position = zombie?.worldPosition;
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return;
  }
  const headingRadians = Number.isFinite(zombie?.headingRadians) ? zombie.headingRadians : 0;
  const headingLength = Math.max(0.4, (Number(zombie?.visionConeRangeTiles) || 0) * 0.35);
  const start = worldToScreen(position.x, position.y, cameraTile, tilePixels, width, height);
  const end = worldToScreen(
    position.x + Math.cos(headingRadians) * headingLength,
    position.y + Math.sin(headingRadians) * headingLength,
    cameraTile,
    tilePixels,
    width,
    height
  );
  overlay.lineStyle(Math.max(1, Math.round(tilePixels * 0.16)), HEADING_STROKE_COLOR, HEADING_STROKE_ALPHA);
  overlay.beginPath();
  overlay.moveTo(start.x, start.y);
  overlay.lineTo(end.x, end.y);
  overlay.strokePath();
}

function drawVisionCone(overlay, zombie, cameraTile, tilePixels, width, height, liveRaySamples = []) {
  const position = zombie?.worldPosition;
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return;
  }
  const center = worldToScreen(position.x, position.y, cameraTile, tilePixels, width, height);
  const raySamples = Array.isArray(liveRaySamples) ? liveRaySamples : [];
  const clippedRays = raySamples.filter(
    (ray) =>
      !ray?.blockedBySector &&
      Number(ray?.maxReach) > 0.000001 &&
      Number.isFinite(ray?.x) &&
      Number.isFinite(ray?.y)
  );

  overlay.fillStyle(CONE_FILL_COLOR, CONE_FILL_ALPHA);
  overlay.lineStyle(Math.max(1, Math.round(tilePixels * 0.14)), CONE_STROKE_COLOR, CONE_STROKE_ALPHA);

  if (clippedRays.length >= 2) {
    overlay.beginPath();
    overlay.moveTo(center.x, center.y);
    for (const ray of clippedRays) {
      const rayEnd = worldToScreen(ray.x, ray.y, cameraTile, tilePixels, width, height);
      overlay.lineTo(rayEnd.x, rayEnd.y);
    }
    overlay.closePath();
    overlay.fillPath();
    overlay.strokePath();
    return;
  }

  const headingRadians = Number.isFinite(zombie?.headingRadians) ? zombie.headingRadians : 0;
  const coneAngleDegrees = Number(zombie?.visionConeAngleDegrees) || 90;
  const coneRangeTiles = Number(zombie?.visionConeRangeTiles) || 0;
  if (coneRangeTiles <= 0) {
    return;
  }
  const halfAngleRadians = ((coneAngleDegrees * Math.PI) / 180) * 0.5;
  const left = worldToScreen(
    position.x + Math.cos(headingRadians - halfAngleRadians) * coneRangeTiles,
    position.y + Math.sin(headingRadians - halfAngleRadians) * coneRangeTiles,
    cameraTile,
    tilePixels,
    width,
    height
  );
  const right = worldToScreen(
    position.x + Math.cos(headingRadians + halfAngleRadians) * coneRangeTiles,
    position.y + Math.sin(headingRadians + halfAngleRadians) * coneRangeTiles,
    cameraTile,
    tilePixels,
    width,
    height
  );
  overlay.beginPath();
  overlay.moveTo(center.x, center.y);
  overlay.lineTo(left.x, left.y);
  overlay.lineTo(right.x, right.y);
  overlay.closePath();
  overlay.fillPath();
  overlay.strokePath();
}

function drawPathDiagnostics(overlay, zombie, cameraTile, tilePixels, width, height) {
  const start = zombie?.worldPosition;
  const waypoint = zombie?.waypointWorld;
  if (!start || !waypoint) {
    return;
  }
  if (
    !Number.isFinite(start.x) ||
    !Number.isFinite(start.y) ||
    !Number.isFinite(waypoint.x) ||
    !Number.isFinite(waypoint.y)
  ) {
    return;
  }

  const startScreen = worldToScreen(start.x, start.y, cameraTile, tilePixels, width, height);
  const waypointScreen = worldToScreen(
    waypoint.x,
    waypoint.y,
    cameraTile,
    tilePixels,
    width,
    height
  );

  overlay.lineStyle(Math.max(1, Math.round(tilePixels * 0.18)), PATH_STROKE_COLOR, PATH_STROKE_ALPHA);
  overlay.beginPath();
  overlay.moveTo(startScreen.x, startScreen.y);
  overlay.lineTo(waypointScreen.x, waypointScreen.y);
  overlay.strokePath();

  overlay.fillStyle(WAYPOINT_FILL_COLOR, WAYPOINT_FILL_ALPHA);
  overlay.fillCircle(
    Math.round(waypointScreen.x),
    Math.round(waypointScreen.y),
    Math.max(2, Math.round(tilePixels * 0.22))
  );
}

function drawWaypointSelectionDiagnostics(overlay, zombie, cameraTile, tilePixels, width, height) {
  const selection = zombie?.waypointSelection;
  const candidates = Array.isArray(selection?.candidates) ? selection.candidates : [];
  if (candidates.length === 0) {
    return;
  }

  for (const candidate of candidates) {
    if (!Number.isFinite(candidate?.x) || !Number.isFinite(candidate?.y)) {
      continue;
    }
    const status = candidate?.status || "unknown";
    let color = CANDIDATE_LOS_BLOCKED_COLOR;
    let alpha = CANDIDATE_LOS_BLOCKED_ALPHA;
    if (status === "expanded_selected") {
      color = CANDIDATE_ACCEPTED_COLOR;
      alpha = CANDIDATE_ACCEPTED_ALPHA;
    } else if (status === "fallback_selected") {
      color = CANDIDATE_FALLBACK_COLOR;
      alpha = CANDIDATE_FALLBACK_ALPHA;
    } else if (status === "failed_sector") {
      color = CANDIDATE_FAILED_SECTOR_COLOR;
      alpha = CANDIDATE_FAILED_SECTOR_ALPHA;
    } else if (status === "blocked") {
      color = CANDIDATE_BLOCKED_COLOR;
      alpha = CANDIDATE_BLOCKED_ALPHA;
    } else if (status === "no_continuation") {
      color = CANDIDATE_NO_CONTINUATION_COLOR;
      alpha = CANDIDATE_NO_CONTINUATION_ALPHA;
    } else if (status === "too_close") {
      color = CANDIDATE_TOO_CLOSE_COLOR;
      alpha = CANDIDATE_TOO_CLOSE_ALPHA;
    }
    const screen = worldToScreen(candidate.x, candidate.y, cameraTile, tilePixels, width, height);
    overlay.fillStyle(color, alpha);
    overlay.fillCircle(
      Math.round(screen.x),
      Math.round(screen.y),
      Math.max(1, Math.round(tilePixels * 0.16))
    );
  }
}

function drawClippedConeRays(
  overlay,
  zombie,
  cameraTile,
  tilePixels,
  width,
  height,
  liveRaySamples = []
) {
  const position = zombie?.worldPosition;
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return;
  }
  const raySamples = Array.isArray(liveRaySamples) ? liveRaySamples : [];
  if (raySamples.length === 0) {
    return;
  }

  const origin = worldToScreen(position.x, position.y, cameraTile, tilePixels, width, height);
  const lineWidth = Math.max(1, Math.round(tilePixels * 0.08));
  for (const ray of raySamples) {
    if (!Number.isFinite(ray?.x) || !Number.isFinite(ray?.y)) {
      continue;
    }
    const end = worldToScreen(ray.x, ray.y, cameraTile, tilePixels, width, height);
    const color = ray?.blockedBySector ? RAY_BLOCKED_SECTOR_COLOR : RAY_OPEN_COLOR;
    const alpha = ray?.blockedBySector ? RAY_BLOCKED_SECTOR_ALPHA : RAY_OPEN_ALPHA;
    overlay.lineStyle(lineWidth, color, alpha);
    overlay.beginPath();
    overlay.moveTo(origin.x, origin.y);
    overlay.lineTo(end.x, end.y);
    overlay.strokePath();
  }
}

function drawFailedSectors(overlay, zombie, cameraTile, tilePixels, width, height) {
  const position = zombie?.worldPosition;
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return;
  }
  const recovery = zombie?.wanderRecovery;
  const sectors = Array.isArray(recovery?.failedSectors) ? recovery.failedSectors : [];
  if (sectors.length === 0) {
    return;
  }
  const center = worldToScreen(position.x, position.y, cameraTile, tilePixels, width, height);
  const radius = Math.max(8, (Number(zombie?.visionConeRangeTiles) || 0) * tilePixels * 0.88);
  const lineWidth = Math.max(1, Math.round(tilePixels * 0.12));
  for (const sector of sectors) {
    const centerRadians = Number(sector?.centerRadians);
    const halfAngleRadians = Number(sector?.halfAngleRadians);
    if (!Number.isFinite(centerRadians) || !Number.isFinite(halfAngleRadians)) {
      continue;
    }
    overlay.lineStyle(lineWidth, FAILED_SECTOR_ARC_COLOR, FAILED_SECTOR_ARC_ALPHA);
    overlay.beginPath();
    overlay.arc(
      center.x,
      center.y,
      radius,
      centerRadians - halfAngleRadians,
      centerRadians + halfAngleRadians,
      false
    );
    overlay.strokePath();
  }
}

function drawRecoveryIndicator(overlay, zombie, cameraTile, tilePixels, width, height) {
  const position = zombie?.worldPosition;
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return;
  }
  const recovery = zombie?.wanderRecovery;
  if (!recovery?.recoveryActive) {
    return;
  }
  const center = worldToScreen(position.x, position.y, cameraTile, tilePixels, width, height);
  const radius = Math.max(6, tilePixels * 0.45);
  overlay.lineStyle(Math.max(1, Math.round(tilePixels * 0.14)), RECOVERY_RING_COLOR, RECOVERY_RING_ALPHA);
  overlay.strokeCircle(Math.round(center.x), Math.round(center.y), Math.round(radius));
}

export function createZombieDebugOverlay({
  scene,
  runtime,
  zombieManager,
} = {}) {
  if (!scene || !runtime || !zombieManager) {
    throw new Error(
      "createZombieDebugOverlay requires scene, runtime, and zombieManager."
    );
  }

  const overlay = scene.add.graphics();
  overlay.setDepth(92);
  let enabled = false;

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    if (!enabled) {
      overlay.clear();
    }
  }

  function isEnabled() {
    return enabled;
  }

  function renderFrame({
    cameraTile,
    tilePixels,
    viewWidthPx,
    viewHeightPx,
  }) {
    overlay.clear();
    if (!enabled) {
      return;
    }

    overlay.fillStyle(0x000000, BLACKOUT_ALPHA);
    overlay.fillRect(0, 0, viewWidthPx, viewHeightPx);
    drawCollisionObstacles(
      overlay,
      runtime,
      cameraTile,
      tilePixels,
      viewWidthPx,
      viewHeightPx
    );

    const debugState = zombieManager.getDebugState?.() || { zombies: [] };
    const zombies = Array.isArray(debugState.zombies) ? debugState.zombies : [];
    for (const zombie of zombies) {
      const liveConeRays = buildLiveClippedConeRays(runtime, zombie, LIVE_CONE_RAY_COUNT);
      drawVisionCone(
        overlay,
        zombie,
        cameraTile,
        tilePixels,
        viewWidthPx,
        viewHeightPx,
        liveConeRays
      );
      drawClippedConeRays(
        overlay,
        zombie,
        cameraTile,
        tilePixels,
        viewWidthPx,
        viewHeightPx,
        liveConeRays
      );
      drawFailedSectors(overlay, zombie, cameraTile, tilePixels, viewWidthPx, viewHeightPx);
      drawWaypointSelectionDiagnostics(
        overlay,
        zombie,
        cameraTile,
        tilePixels,
        viewWidthPx,
        viewHeightPx
      );
      drawPathDiagnostics(overlay, zombie, cameraTile, tilePixels, viewWidthPx, viewHeightPx);
      drawZombieCollider(overlay, zombie, cameraTile, tilePixels, viewWidthPx, viewHeightPx);
      drawHeading(overlay, zombie, cameraTile, tilePixels, viewWidthPx, viewHeightPx);
      drawRecoveryIndicator(overlay, zombie, cameraTile, tilePixels, viewWidthPx, viewHeightPx);
    }
  }

  function destroy() {
    overlay.clear();
    overlay.destroy();
  }

  return {
    setEnabled,
    isEnabled,
    renderFrame,
    clear: () => overlay.clear(),
    destroy,
  };
}

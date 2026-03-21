const BLACKOUT_ALPHA = 0.9;
const BLOCKED_FILL_COLOR = 0xff4d4d;
const BLOCKED_FILL_ALPHA = 0.72;
const BLOCKED_STROKE_COLOR = 0xff9a9a;
const BLOCKED_STROKE_ALPHA = 0.45;
const VISITED_FILL_COLOR = 0x6aa8ff;
const VISITED_FILL_ALPHA = 0.4;
const PATH_STROKE_COLOR = 0x64fffa;
const PATH_STROKE_ALPHA = 1;
const PATH_NODE_FILL_COLOR = 0x64fffa;
const PATH_NODE_FILL_ALPHA = 0.65;
const COLLIDER_STROKE_COLOR = 0x89ff4f;
const COLLIDER_STROKE_ALPHA = 1;
const COLLIDER_FILL_COLOR = 0x89ff4f;
const COLLIDER_FILL_ALPHA = 0.18;
const HUMAN_VISION_FILL_COLOR = 0x7ec8ff;
const HUMAN_VISION_FILL_ALPHA = 0.18;
const HUMAN_VISION_STROKE_COLOR = 0x7ec8ff;
const HUMAN_VISION_STROKE_ALPHA = 0.85;
const HUMAN_VISION_DETECTED_FILL_COLOR = 0x68e7ff;
const HUMAN_VISION_DETECTED_FILL_ALPHA = 0.24;
const HUMAN_VISION_DETECTED_STROKE_COLOR = 0x68e7ff;
const HUMAN_VISION_DETECTED_STROKE_ALPHA = 0.95;
const HUMAN_VISION_RAY_COLOR = 0x7ec8ff;
const HUMAN_VISION_RAY_ALPHA = 0.26;
const HUMAN_VISION_RAY_DETECTED_COLOR = 0x68e7ff;
const HUMAN_VISION_RAY_DETECTED_ALPHA = 0.32;
const HUMAN_VISION_RAY_BLOCKED_SECTOR_COLOR = 0xb084ff;
const HUMAN_VISION_RAY_BLOCKED_SECTOR_ALPHA = 0.34;
const GUEST_WANDER_FAILED_SECTOR_ARC_COLOR = 0xb084ff;
const GUEST_WANDER_FAILED_SECTOR_ARC_ALPHA = 0.86;
const GUEST_WANDER_RECOVERY_RING_COLOR = 0xffd166;
const GUEST_WANDER_RECOVERY_RING_ALPHA = 0.95;
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
const GUEST_TARGET_LINE_COLOR = 0xffd166;
const GUEST_TARGET_LINE_ALPHA = 0.9;
const GUEST_TARGET_MARKER_COLOR = 0xff8c42;
const GUEST_TARGET_MARKER_ALPHA = 0.95;
const GUEST_HEADING_COLOR = 0xbec9ff;
const GUEST_HEADING_ALPHA = 0.85;
const HUMAN_VISION_RAY_COUNT = 20;
const HUMAN_VISION_STEP_TILES = 0.2;
const HUMAN_VISION_WALK_RADIUS_TILES = 0.29;

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

function colliderRectScreen(colliderWorld, cameraTile, tilePixels, width, height) {
  const topLeft = worldToScreen(
    colliderWorld.x,
    colliderWorld.y,
    cameraTile,
    tilePixels,
    width,
    height
  );
  const bottomRight = worldToScreen(
    colliderWorld.x + colliderWorld.w,
    colliderWorld.y + colliderWorld.h,
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
    return runtime.isWalkableWorldPoint(worldX, worldY, HUMAN_VISION_WALK_RADIUS_TILES);
  }
  if (typeof runtime?.isWalkableWorldRect === "function") {
    return runtime.isWalkableWorldRect(
      worldX,
      worldY,
      HUMAN_VISION_WALK_RADIUS_TILES,
      HUMAN_VISION_WALK_RADIUS_TILES
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
  const safeStep = Math.max(0.01, Number(stepTiles) || HUMAN_VISION_STEP_TILES);
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

function buildLiveClippedConeRays(runtime, humanDebug, rayCount = HUMAN_VISION_RAY_COUNT) {
  const position = humanDebug?.worldPosition;
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return [];
  }
  const headingRadians = Number.isFinite(humanDebug?.headingRadians)
    ? humanDebug.headingRadians
    : 0;
  const coneAngleDegrees = Math.max(0, Number(humanDebug?.visionConeAngleDegrees) || 0);
  const coneRangeTiles = Math.max(0, Number(humanDebug?.visionConeRangeTiles) || 0);
  if (coneRangeTiles <= 0) {
    return [];
  }
  const blockedSectorsRadians = Array.isArray(humanDebug?.wanderRecovery?.failedSectors)
    ? humanDebug.wanderRecovery.failedSectors
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
      : computeRayMaxReach(
          runtime,
          position,
          angleRadians,
          coneRangeTiles,
          HUMAN_VISION_STEP_TILES
        );
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

export function createHumanDebugOverlay({
  scene,
  runtime,
  humanManager = null,
  humanController,
  commandController = null,
  renderBackdrop = true,
  renderCollisionObstacles = true,
} = {}) {
  if (!scene || !runtime || !humanController) {
    throw new Error(
      "createHumanDebugOverlay requires scene, runtime, and humanController."
    );
  }

  const overlay = scene.add.graphics();
  overlay.setDepth(94);
  let enabled = false;
  let visionDebugEnabled = true;

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    if (!enabled) {
      overlay.clear();
    }
  }

  function isEnabled() {
    return enabled;
  }

  function setVisionDebugEnabled(nextEnabled) {
    visionDebugEnabled = Boolean(nextEnabled);
  }

  function isVisionDebugEnabled() {
    return visionDebugEnabled;
  }

  function drawCollisionObstacles(cameraTile, tilePixels, width, height) {
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

function drawVisitedNodes(visitedNodes, cameraTile, tilePixels, width, height) {
    if (!Array.isArray(visitedNodes) || visitedNodes.length === 0) {
      return;
    }
    overlay.fillStyle(VISITED_FILL_COLOR, VISITED_FILL_ALPHA);
    for (const node of visitedNodes) {
      const rect = worldRectScreen(
        node.x,
        node.y,
        node.w || 1,
        node.h || 1,
        cameraTile,
        tilePixels,
        width,
        height
      );
      overlay.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  }

  function drawPath(pathWorld, startWorld, cameraTile, tilePixels, width, height) {
    if (!Array.isArray(pathWorld) || pathWorld.length === 0) {
      return;
    }

    const points = [];
    if (startWorld && Number.isFinite(startWorld.x) && Number.isFinite(startWorld.y)) {
      points.push({
        x: startWorld.x,
        y: startWorld.y,
      });
    }
    for (const point of pathWorld) {
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
        continue;
      }
      points.push({
        x: point.x,
        y: point.y,
      });
    }
    if (points.length === 0) {
      return;
    }

    overlay.lineStyle(Math.max(1, Math.round(tilePixels * 0.18)), PATH_STROKE_COLOR, PATH_STROKE_ALPHA);
    overlay.beginPath();
    for (let i = 0; i < points.length; i += 1) {
      const screen = worldToScreen(
        points[i].x,
        points[i].y,
        cameraTile,
        tilePixels,
        width,
        height
      );
      if (i === 0) {
        overlay.moveTo(screen.x, screen.y);
      } else {
        overlay.lineTo(screen.x, screen.y);
      }
    }
    overlay.strokePath();

    overlay.fillStyle(PATH_NODE_FILL_COLOR, PATH_NODE_FILL_ALPHA);
    const radius = Math.max(2, tilePixels * 0.2);
    for (const point of points) {
      const screen = worldToScreen(point.x, point.y, cameraTile, tilePixels, width, height);
      overlay.fillCircle(Math.round(screen.x), Math.round(screen.y), Math.round(radius));
    }
  }

  function drawCollider(colliderWorld, cameraTile, tilePixels, width, height) {
    if (!colliderWorld) {
      return;
    }
    const rect = colliderRectScreen(colliderWorld, cameraTile, tilePixels, width, height);
    overlay.fillStyle(COLLIDER_FILL_COLOR, COLLIDER_FILL_ALPHA);
    overlay.fillRect(rect.x, rect.y, rect.w, rect.h);
    overlay.lineStyle(Math.max(1, Math.round(tilePixels * 0.18)), COLLIDER_STROKE_COLOR, COLLIDER_STROKE_ALPHA);
    overlay.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w, rect.h);
  }

function drawVisionCone(
  centerWorld,
  headingRadians,
  visionCone,
  detected,
  _raySamples,
  cameraTile,
  tilePixels,
  width,
  height
) {
    if (!centerWorld || !visionCone) {
      return;
    }
    if (!Number.isFinite(centerWorld.x) || !Number.isFinite(centerWorld.y)) {
      return;
    }
    const rangeTiles = Math.max(0, Number(visionCone.rangeTiles) || 0);
    const angleDegrees = Math.max(0, Number(visionCone.angleDegrees) || 0);
    if (rangeTiles <= 0 || angleDegrees <= 0) {
      return;
    }

    const center = worldToScreen(
      centerWorld.x,
      centerWorld.y,
      cameraTile,
      tilePixels,
      width,
      height
    );

    const fillColor = detected
      ? HUMAN_VISION_DETECTED_FILL_COLOR
      : HUMAN_VISION_FILL_COLOR;
    const fillAlpha = detected
      ? HUMAN_VISION_DETECTED_FILL_ALPHA
      : HUMAN_VISION_FILL_ALPHA;
    const strokeColor = detected
      ? HUMAN_VISION_DETECTED_STROKE_COLOR
      : HUMAN_VISION_STROKE_COLOR;
    const strokeAlpha = detected
      ? HUMAN_VISION_DETECTED_STROKE_ALPHA
      : HUMAN_VISION_STROKE_ALPHA;

    overlay.fillStyle(fillColor, fillAlpha);
    overlay.lineStyle(
      Math.max(1, Math.round(tilePixels * 0.12)),
      strokeColor,
      strokeAlpha
    );
    const heading = Number.isFinite(headingRadians) ? headingRadians : 0;
    const halfAngleRadians = ((angleDegrees * Math.PI) / 180) * 0.5;
    const radiusPx = Math.max(0, rangeTiles * tilePixels);
    if (radiusPx <= 0.000001) {
      return;
    }
    overlay.beginPath();
    overlay.moveTo(center.x, center.y);
    overlay.arc(
      center.x,
      center.y,
      radiusPx,
      heading - halfAngleRadians,
      heading + halfAngleRadians,
      false
    );
    overlay.closePath();
    overlay.fillPath();
    overlay.strokePath();
  }

  function drawVisionRays(
    centerWorld,
    detected,
    raySamples,
    cameraTile,
    tilePixels,
    width,
    height
  ) {
    if (!centerWorld || !Array.isArray(raySamples) || raySamples.length === 0) {
      return;
    }
    if (!Number.isFinite(centerWorld.x) || !Number.isFinite(centerWorld.y)) {
      return;
    }
    const origin = worldToScreen(
      centerWorld.x,
      centerWorld.y,
      cameraTile,
      tilePixels,
      width,
      height
    );
    const lineWidth = Math.max(1, Math.round(tilePixels * 0.08));
    for (const ray of raySamples) {
      if (!Number.isFinite(ray?.x) || !Number.isFinite(ray?.y)) {
        continue;
      }
      const color = ray?.blockedBySector
        ? HUMAN_VISION_RAY_BLOCKED_SECTOR_COLOR
        : detected
          ? HUMAN_VISION_RAY_DETECTED_COLOR
          : HUMAN_VISION_RAY_COLOR;
      const alpha = ray?.blockedBySector
        ? HUMAN_VISION_RAY_BLOCKED_SECTOR_ALPHA
        : detected
          ? HUMAN_VISION_RAY_DETECTED_ALPHA
          : HUMAN_VISION_RAY_ALPHA;
      const end = worldToScreen(ray.x, ray.y, cameraTile, tilePixels, width, height);
      overlay.lineStyle(lineWidth, color, alpha);
      overlay.beginPath();
      overlay.moveTo(origin.x, origin.y);
      overlay.lineTo(end.x, end.y);
      overlay.strokePath();
    }
  }

  function drawHeadingLine(
    centerWorld,
    headingRadians,
    visionCone,
    cameraTile,
    tilePixels,
    width,
    height
  ) {
    if (!centerWorld || !visionCone) {
      return;
    }
    if (!Number.isFinite(centerWorld.x) || !Number.isFinite(centerWorld.y)) {
      return;
    }
    const heading = Number.isFinite(headingRadians) ? headingRadians : 0;
    const headingLength = Math.max(0.4, (Number(visionCone.rangeTiles) || 0) * 0.35);
    const start = worldToScreen(
      centerWorld.x,
      centerWorld.y,
      cameraTile,
      tilePixels,
      width,
      height
    );
    const end = worldToScreen(
      centerWorld.x + Math.cos(heading) * headingLength,
      centerWorld.y + Math.sin(heading) * headingLength,
      cameraTile,
      tilePixels,
      width,
      height
    );
    overlay.lineStyle(
      Math.max(1, Math.round(tilePixels * 0.14)),
      GUEST_HEADING_COLOR,
      GUEST_HEADING_ALPHA
    );
    overlay.beginPath();
    overlay.moveTo(start.x, start.y);
    overlay.lineTo(end.x, end.y);
    overlay.strokePath();
  }

  function drawTargetLockLine(
    sourceWorld,
    targetWorld,
    cameraTile,
    tilePixels,
    width,
    height
  ) {
    if (!sourceWorld || !targetWorld) {
      return;
    }
    if (
      !Number.isFinite(sourceWorld.x) ||
      !Number.isFinite(sourceWorld.y) ||
      !Number.isFinite(targetWorld.x) ||
      !Number.isFinite(targetWorld.y)
    ) {
      return;
    }
    const start = worldToScreen(
      sourceWorld.x,
      sourceWorld.y,
      cameraTile,
      tilePixels,
      width,
      height
    );
    const end = worldToScreen(
      targetWorld.x,
      targetWorld.y,
      cameraTile,
      tilePixels,
      width,
      height
    );
    overlay.lineStyle(
      Math.max(1, Math.round(tilePixels * 0.12)),
      GUEST_TARGET_LINE_COLOR,
      GUEST_TARGET_LINE_ALPHA
    );
    overlay.beginPath();
    overlay.moveTo(start.x, start.y);
    overlay.lineTo(end.x, end.y);
    overlay.strokePath();

    overlay.fillStyle(GUEST_TARGET_MARKER_COLOR, GUEST_TARGET_MARKER_ALPHA);
    overlay.fillCircle(
      Math.round(end.x),
      Math.round(end.y),
      Math.max(2, Math.round(tilePixels * 0.2))
    );
  }

  function drawGuestPathDiagnostics(
    guestDebug,
    cameraTile,
    tilePixels,
    width,
    height
  ) {
    const start = guestDebug?.worldPosition;
    const waypoint = guestDebug?.waypointWorld;
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
    const startScreen = worldToScreen(
      start.x,
      start.y,
      cameraTile,
      tilePixels,
      width,
      height
    );
    const waypointScreen = worldToScreen(
      waypoint.x,
      waypoint.y,
      cameraTile,
      tilePixels,
      width,
      height
    );
    overlay.lineStyle(
      Math.max(1, Math.round(tilePixels * 0.18)),
      PATH_STROKE_COLOR,
      PATH_STROKE_ALPHA
    );
    overlay.beginPath();
    overlay.moveTo(startScreen.x, startScreen.y);
    overlay.lineTo(waypointScreen.x, waypointScreen.y);
    overlay.strokePath();
    overlay.fillStyle(PATH_NODE_FILL_COLOR, PATH_NODE_FILL_ALPHA);
    overlay.fillCircle(
      Math.round(waypointScreen.x),
      Math.round(waypointScreen.y),
      Math.max(2, Math.round(tilePixels * 0.22))
    );
  }

  function drawGuestWaypointSelectionDiagnostics(
    guestDebug,
    cameraTile,
    tilePixels,
    width,
    height
  ) {
    const selection = guestDebug?.waypointSelection;
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
      const screen = worldToScreen(
        candidate.x,
        candidate.y,
        cameraTile,
        tilePixels,
        width,
        height
      );
      overlay.fillStyle(color, alpha);
      overlay.fillCircle(
        Math.round(screen.x),
        Math.round(screen.y),
        Math.max(1, Math.round(tilePixels * 0.16))
      );
    }
  }

  function drawGuestFailedSectors(
    guestDebug,
    cameraTile,
    tilePixels,
    width,
    height
  ) {
    const position = guestDebug?.worldPosition;
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      return;
    }
    const recovery = guestDebug?.wanderRecovery;
    const sectors = Array.isArray(recovery?.failedSectors) ? recovery.failedSectors : [];
    if (sectors.length === 0) {
      return;
    }
    const center = worldToScreen(
      position.x,
      position.y,
      cameraTile,
      tilePixels,
      width,
      height
    );
    const radius = Math.max(
      8,
      (Number(guestDebug?.visionConeRangeTiles) || 0) * tilePixels * 0.88
    );
    const lineWidth = Math.max(1, Math.round(tilePixels * 0.12));
    for (const sector of sectors) {
      const centerRadians = Number(sector?.centerRadians);
      const halfAngleRadians = Number(sector?.halfAngleRadians);
      if (!Number.isFinite(centerRadians) || !Number.isFinite(halfAngleRadians)) {
        continue;
      }
      overlay.lineStyle(
        lineWidth,
        GUEST_WANDER_FAILED_SECTOR_ARC_COLOR,
        GUEST_WANDER_FAILED_SECTOR_ARC_ALPHA
      );
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

  function drawGuestRecoveryIndicator(
    guestDebug,
    cameraTile,
    tilePixels,
    width,
    height
  ) {
    const position = guestDebug?.worldPosition;
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      return;
    }
    const recovery = guestDebug?.wanderRecovery;
    if (!recovery?.recoveryActive) {
      return;
    }
    const center = worldToScreen(
      position.x,
      position.y,
      cameraTile,
      tilePixels,
      width,
      height
    );
    const radius = Math.max(6, tilePixels * 0.45);
    overlay.lineStyle(
      Math.max(1, Math.round(tilePixels * 0.14)),
      GUEST_WANDER_RECOVERY_RING_COLOR,
      GUEST_WANDER_RECOVERY_RING_ALPHA
    );
    overlay.strokeCircle(Math.round(center.x), Math.round(center.y), Math.round(radius));
  }

  function drawGuestVisionDiagnostics(
    humanManagerDebug,
    cameraTile,
    tilePixels,
    width,
    height
  ) {
    if (!humanManagerDebug) {
      return;
    }
    const humans = Array.isArray(humanManagerDebug.humans)
      ? humanManagerDebug.humans
      : [];
    const byGuest = Array.isArray(humanManagerDebug.guestPerception?.byGuest)
      ? humanManagerDebug.guestPerception.byGuest
      : [];
    const perceptionById = new Map();
    for (const state of byGuest) {
      if (!state || state.id === undefined || state.id === null) {
        continue;
      }
      perceptionById.set(state.id, state);
    }

    for (const human of humans) {
      if (human?.role !== "guest" || human?.alive !== true) {
        continue;
      }
      const debug = human?.debug || null;
      const centerWorld = debug?.worldPosition || null;
      const headingRadians = Number(debug?.headingRadians) || 0;
      const visionCone = {
        angleDegrees: Number(debug?.visionConeAngleDegrees) || 0,
        rangeTiles: Number(debug?.visionConeRangeTiles) || 0,
      };
      const perceptionState = perceptionById.get(human.id) || null;
      const detected = perceptionState?.detected === true;
      if (visionDebugEnabled) {
        drawVisionCone(
          centerWorld,
          headingRadians,
          visionCone,
          detected,
          null,
          cameraTile,
          tilePixels,
          width,
          height
        );
      }
      drawGuestFailedSectors(debug, cameraTile, tilePixels, width, height);
      drawGuestWaypointSelectionDiagnostics(debug, cameraTile, tilePixels, width, height);
      drawGuestPathDiagnostics(debug, cameraTile, tilePixels, width, height);
      drawCollider(debug?.collider || null, cameraTile, tilePixels, width, height);
      drawHeadingLine(
        centerWorld,
        headingRadians,
        visionCone,
        cameraTile,
        tilePixels,
        width,
        height
      );
      drawGuestRecoveryIndicator(debug, cameraTile, tilePixels, width, height);
      if (visionDebugEnabled && detected) {
        drawTargetLockLine(
          centerWorld,
          perceptionState?.targetWorld || null,
          cameraTile,
          tilePixels,
          width,
          height
        );
      }
    }
  }

  function renderFrame({
    cameraTile,
    tilePixels,
    viewWidthPx,
    viewHeightPx,
    debugSnapshot = null,
  }) {
    overlay.clear();
    if (!enabled) {
      return;
    }

    if (renderBackdrop) {
      overlay.fillStyle(0x000000, BLACKOUT_ALPHA);
      overlay.fillRect(0, 0, viewWidthPx, viewHeightPx);
    }

    if (renderCollisionObstacles) {
      drawCollisionObstacles(cameraTile, tilePixels, viewWidthPx, viewHeightPx);
    }

    const commandDebug = debugSnapshot?.humanCommand || commandController?.getDebugState?.() || null;
    const humanDebug = debugSnapshot?.primaryHuman || humanController.getDebugState();
    const humanManagerDebug = debugSnapshot?.humanManager ||
      (typeof humanManager?.getDebugState === "function"
        ? humanManager.getDebugState()
        : null);

    drawVisitedNodes(
      commandDebug?.lastPathDebug?.visitedCells || [],
      cameraTile,
      tilePixels,
      viewWidthPx,
      viewHeightPx
    );

    drawPath(
      commandDebug?.lastWorldPath || humanDebug.pathWorld || [],
      humanDebug.worldPosition,
      cameraTile,
      tilePixels,
      viewWidthPx,
      viewHeightPx
    );

    drawCollider(
      humanDebug.collider,
      cameraTile,
      tilePixels,
      viewWidthPx,
      viewHeightPx
    );
    drawGuestVisionDiagnostics(
      humanManagerDebug,
      cameraTile,
      tilePixels,
      viewWidthPx,
      viewHeightPx
    );
  }

  function destroy() {
    overlay.clear();
    overlay.destroy();
  }

  return {
    setEnabled,
    isEnabled,
    setVisionDebugEnabled,
    isVisionDebugEnabled,
    renderFrame,
    clear: () => overlay.clear(),
    destroy,
  };
}

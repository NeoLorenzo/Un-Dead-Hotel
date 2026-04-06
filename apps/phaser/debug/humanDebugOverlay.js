const BLACKOUT_ALPHA = 0.9;
const BLOCKED_FILL_COLOR = 0xff4d4d;
const BLOCKED_FILL_ALPHA = 0.72;
const BLOCKED_STROKE_COLOR = 0xff9a9a;
const BLOCKED_STROKE_ALPHA = 0.45;
const VISITED_FILL_COLOR = 0x6aa8ff;
const VISITED_FILL_ALPHA = 0.4;
const FURNITURE_OCCUPIED_FILL_COLOR = 0xffd166;
const FURNITURE_OCCUPIED_FILL_ALPHA = 0.18;
const FURNITURE_OCCUPIED_STROKE_COLOR = 0xffd166;
const FURNITURE_OCCUPIED_STROKE_ALPHA = 0.7;
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
const GUEST_AREA_ROOM_COLOR = 0x5cff87;
const GUEST_AREA_ROOM_DANGER_COLOR = 0xff5a5a;
const GUEST_AREA_ROOM_DANGER_FILL_ALPHA = 0.3;
const GUEST_AREA_CORRIDOR_COLOR = 0xffb347;
const GUEST_AREA_OTHER_COLOR = 0xb5b8c4;
const GUEST_AREA_DOORWAY_COLOR = 0x3fd3ff;
const GUEST_AREA_MARKER_ALPHA = 0.92;
const GUEST_DANGER_LIVE_COLOR = 0xff5a5a;
const GUEST_DANGER_REMEMBERED_COLOR = 0xffb347;
const GUEST_DANGER_LINE_ALPHA = 0.92;
const GUEST_DANGER_MARKER_ALPHA = 0.96;
const GUEST_DANGER_MEMORY_RING_ALPHA = 0.9;
const GUEST_ARBITRATION_HOLD_COLOR = 0x4ec5ff;
const GUEST_ARBITRATION_PREEMPT_COLOR = 0xff6b9b;
const GUEST_ARBITRATION_FALLBACK_COLOR = 0xffc857;
const GUEST_ARBITRATION_LOCKED_COLOR = 0xffe26a;
const BRAIN_PANEL_REFRESH_INTERVAL_MS = 100;
const BRAIN_PANEL_WIDTH_PX = 430;
const BRAIN_PANEL_MIN_HEIGHT_PX = 320;
const BRAIN_PANEL_MARGIN_PX = 12;
const BRAIN_PANEL_GRAPH_TOP_PX = 40;
const BRAIN_PANEL_GRAPH_HEIGHT_PX = 164;
const BRAIN_PANEL_TEXT_TOP_GAP_PX = 10;
const BRAIN_PANEL_BACKGROUND_COLOR = 0x08131f;
const BRAIN_PANEL_BACKGROUND_ALPHA = 0.94;
const BRAIN_PANEL_BORDER_COLOR = 0x4fd1ff;
const BRAIN_PANEL_BORDER_ALPHA = 0.7;
const BRAIN_PANEL_TEXT_COLOR = "#d8ebff";
const BRAIN_PANEL_DISABLED_TEXT_COLOR = "#7c8794";
const BRAIN_PANEL_ACCENT_COLOR = 0x4fd1ff;
const BRAIN_PANEL_POSITIVE_LINK_COLOR = 0x66d0ff;
const BRAIN_PANEL_NEGATIVE_LINK_COLOR = 0xff9f78;
const BRAIN_PANEL_DISABLED_LINK_COLOR = 0x4d5663;
const BRAIN_PANEL_INPUT_NODE_COLOR = 0x7fc9ff;
const BRAIN_PANEL_STATE_NODE_COLOR = 0x7dffb8;
const BRAIN_PANEL_DOMINANT_NODE_COLOR = 0xffe26a;
const BRAIN_PANEL_DISABLED_NODE_COLOR = 0x6f7783;
const BRAIN_PANEL_BADGE_TEXT_COLOR = "#f5f9ff";
const BRAIN_PANEL_BADGE_SUBTLE_BG = "#33414f";
const BRAIN_PANEL_BADGE_HOLD_BG = "#1d5478";
const BRAIN_PANEL_BADGE_HOLD_READY_BG = "#1f6a3b";
const BRAIN_PANEL_BADGE_HOLD_LOCKED_BG = "#7a4c00";
const BRAIN_PANEL_BADGE_PREEMPT_OPEN_BG = "#7a1d45";
const BRAIN_PANEL_BADGE_RETRY_ACTIVE_BG = "#7a5a13";
const SPATIAL_CLASSIFIER_SAMPLE_RADIUS_TILES = 4;
const TILE_KNOWLEDGE_LOS_ONLY_COLOR = 0x38c8ff;
const TILE_KNOWLEDGE_ROOM_REVEAL_COLOR = 0x63d471;
const TILE_KNOWLEDGE_MIXED_COLOR = 0x7ddbd1;
const OBJECTIVE_PATH_VALID_COLOR = 0x6cff9e;
const OBJECTIVE_PATH_FALLBACK_COLOR = 0xffc857;
const OBJECTIVE_PATH_RETRYING_COLOR = 0xff6b9b;
const OBJECTIVE_PATH_IDLE_COLOR = 0x8f9aa8;
const OBJECTIVE_PATH_STATUS_TEXT_COLOR = "#f3f8ff";
const OBJECTIVE_PATH_STATUS_VALID_BG = "#1f6a3b";
const OBJECTIVE_PATH_STATUS_FALLBACK_BG = "#7a5a13";
const OBJECTIVE_PATH_STATUS_RETRYING_BG = "#7a1d45";
const OBJECTIVE_PATH_STATUS_IDLE_BG = "#384554";
const SPATIAL_LEGEND_TEXT_COLOR = "#d9ebff";
const SPATIAL_LEGEND_TITLE_TEXT = "Spatial + Objective Overlay";
const SPATIAL_LEGEND_ITEMS = Object.freeze([
  { label: "Known: LOS-only", backgroundColor: "#1f6c8f" },
  { label: "Known: Room-reveal", backgroundColor: "#2d6f3d" },
  { label: "Known: LOS+Room", backgroundColor: "#347d77" },
  { label: "Area: Room", backgroundColor: "#246845" },
  { label: "Area: Room (Danger)", backgroundColor: "#7a1d1d" },
  { label: "Area: Corridor", backgroundColor: "#7a5a13" },
  { label: "Area: Doorway->Room", backgroundColor: "#246a7c" },
  { label: "Area: Other", backgroundColor: "#4e5663" },
  { label: "Danger: Live threat", backgroundColor: "#7a1d1d" },
  { label: "Danger: Remembered", backgroundColor: "#7a5a13" },
  { label: "Path: Valid", backgroundColor: OBJECTIVE_PATH_STATUS_VALID_BG },
  { label: "Path: Fallback", backgroundColor: OBJECTIVE_PATH_STATUS_FALLBACK_BG },
  { label: "Path: Retrying", backgroundColor: OBJECTIVE_PATH_STATUS_RETRYING_BG },
  { label: "Path: Idle", backgroundColor: OBJECTIVE_PATH_STATUS_IDLE_BG },
]);
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
  getTopLeftUiInsetPx = null,
} = {}) {
  if (!scene || !runtime || !humanController) {
    throw new Error(
      "createHumanDebugOverlay requires scene, runtime, and humanController."
    );
  }

  const overlay = scene.add.graphics();
  overlay.setDepth(94);
  const brainPanelText = scene.add.text(0, 0, "", {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "11px",
    color: BRAIN_PANEL_TEXT_COLOR,
    align: "left",
    lineSpacing: 2,
    wordWrap: {
      width: BRAIN_PANEL_WIDTH_PX - 20,
      useAdvancedWrap: false,
    },
  });
  brainPanelText.setDepth(95);
  brainPanelText.setVisible(false);
  const brainPanelBadgeTexts = Array.from({ length: 3 }, () => {
    const badge = scene.add.text(0, 0, "", {
      fontFamily: "Consolas, 'Courier New', monospace",
      fontSize: "10px",
      color: BRAIN_PANEL_BADGE_TEXT_COLOR,
      backgroundColor: BRAIN_PANEL_BADGE_SUBTLE_BG,
    });
    badge.setPadding(5, 2, 5, 2);
    badge.setDepth(95);
    badge.setVisible(false);
    return badge;
  });
  const spatialLegendTitleText = scene.add.text(0, 0, SPATIAL_LEGEND_TITLE_TEXT, {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "10px",
    color: SPATIAL_LEGEND_TEXT_COLOR,
  });
  spatialLegendTitleText.setDepth(95);
  spatialLegendTitleText.setVisible(false);
  const spatialLegendBadgeTexts = SPATIAL_LEGEND_ITEMS.map((item) => {
    const badge = scene.add.text(0, 0, item.label, {
      fontFamily: "Consolas, 'Courier New', monospace",
      fontSize: "10px",
      color: SPATIAL_LEGEND_TEXT_COLOR,
      backgroundColor: item.backgroundColor,
    });
    badge.setPadding(5, 2, 5, 2);
    badge.setDepth(95);
    badge.setVisible(false);
    return badge;
  });
  const objectiveStatusTagText = scene.add.text(0, 0, "", {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "10px",
    color: OBJECTIVE_PATH_STATUS_TEXT_COLOR,
    backgroundColor: OBJECTIVE_PATH_STATUS_IDLE_BG,
  });
  objectiveStatusTagText.setPadding(5, 2, 5, 2);
  objectiveStatusTagText.setDepth(95);
  objectiveStatusTagText.setVisible(false);
  let enabled = false;
  let visionDebugEnabled = true;
  let inspectedGuestId = null;
  let inspectedGuestLabel = "";
  let forceBrainPanelRefresh = true;
  let lastBrainPanelRefreshAtMs = -Infinity;
  let brainPanelCache = {
    status: "none",
    lines: [],
    graph: null,
    message: "",
    badges: [],
  };

  function resolveTopLeftUiInsetPx() {
    if (typeof getTopLeftUiInsetPx !== "function") {
      return 0;
    }
    const inset = Number(getTopLeftUiInsetPx());
    if (!Number.isFinite(inset) || inset <= 0) {
      return 0;
    }
    return inset;
  }

  function hideBrainPanelBadges() {
    for (const badgeText of brainPanelBadgeTexts) {
      badgeText.setVisible(false);
    }
  }

  function hideSpatialOverlayLegend() {
    spatialLegendTitleText.setVisible(false);
    for (const badgeText of spatialLegendBadgeTexts) {
      badgeText.setVisible(false);
    }
  }

  function hideObjectiveStatusTag() {
    objectiveStatusTagText.setVisible(false);
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    if (!enabled) {
      overlay.clear();
      brainPanelText.setVisible(false);
      hideBrainPanelBadges();
      hideSpatialOverlayLegend();
      hideObjectiveStatusTag();
    } else {
      forceBrainPanelRefresh = true;
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

  function parseTileKey(tileKey) {
    if (typeof tileKey !== "string" || tileKey.length === 0) {
      return null;
    }
    const [xRaw, yRaw] = tileKey.split(",");
    const x = Number(xRaw);
    const y = Number(yRaw);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return {
      x: Math.floor(x),
      y: Math.floor(y),
    };
  }

  function drawFurnitureOccupancy(
    furnitureDebug,
    cameraTile,
    tilePixels,
    width,
    height
  ) {
    const occupiedTiles = Array.isArray(furnitureDebug?.occupiedTiles)
      ? furnitureDebug.occupiedTiles
      : [];
    if (occupiedTiles.length === 0) {
      return;
    }
    overlay.fillStyle(FURNITURE_OCCUPIED_FILL_COLOR, FURNITURE_OCCUPIED_FILL_ALPHA);
    overlay.lineStyle(
      Math.max(1, Math.round(tilePixels * 0.1)),
      FURNITURE_OCCUPIED_STROKE_COLOR,
      FURNITURE_OCCUPIED_STROKE_ALPHA
    );
    for (const entry of occupiedTiles) {
      const tile = parseTileKey(entry?.tileKey);
      if (!tile) {
        continue;
      }
      const rect = worldRectScreen(
        tile.x,
        tile.y,
        1,
        1,
        cameraTile,
        tilePixels,
        width,
        height
      );
      if (
        rect.x + rect.w < 0 ||
        rect.y + rect.h < 0 ||
        rect.x > width ||
        rect.y > height
      ) {
        continue;
      }
      overlay.fillRect(rect.x, rect.y, rect.w, rect.h);
      overlay.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w, rect.h);
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

  function formatDangerSignal(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return "0.00";
    }
    return Math.max(0, Math.min(1, numeric)).toFixed(2);
  }

  function drawDangerThreatMarker({
    guestWorld,
    threatWorld,
    markerColor,
    markerKind = "live",
    cameraTile,
    tilePixels,
    width,
    height,
  }) {
    if (
      !Number.isFinite(guestWorld?.x) ||
      !Number.isFinite(guestWorld?.y) ||
      !Number.isFinite(threatWorld?.x) ||
      !Number.isFinite(threatWorld?.y)
    ) {
      return;
    }
    const start = worldToScreen(
      guestWorld.x,
      guestWorld.y,
      cameraTile,
      tilePixels,
      width,
      height
    );
    const end = worldToScreen(
      threatWorld.x,
      threatWorld.y,
      cameraTile,
      tilePixels,
      width,
      height
    );

    overlay.lineStyle(
      Math.max(1, Math.round(tilePixels * 0.12)),
      markerColor,
      GUEST_DANGER_LINE_ALPHA
    );
    overlay.beginPath();
    overlay.moveTo(start.x, start.y);
    overlay.lineTo(end.x, end.y);
    overlay.strokePath();

    const markerRadius = Math.max(3, Math.round(tilePixels * 0.2));
    if (markerKind === "remembered") {
      overlay.lineStyle(Math.max(1, Math.round(tilePixels * 0.12)), markerColor, 0.98);
      overlay.strokeRect(
        Math.round(end.x - markerRadius),
        Math.round(end.y - markerRadius),
        markerRadius * 2,
        markerRadius * 2
      );
      overlay.beginPath();
      overlay.moveTo(end.x - markerRadius, end.y - markerRadius);
      overlay.lineTo(end.x + markerRadius, end.y + markerRadius);
      overlay.moveTo(end.x + markerRadius, end.y - markerRadius);
      overlay.lineTo(end.x - markerRadius, end.y + markerRadius);
      overlay.strokePath();
      return;
    }

    overlay.fillStyle(markerColor, GUEST_DANGER_MARKER_ALPHA);
    overlay.fillCircle(Math.round(end.x), Math.round(end.y), markerRadius);
  }

  function drawInspectedGuestDangerOverlay(
    guestDebug,
    cameraTile,
    tilePixels,
    width,
    height
  ) {
    const world = guestDebug?.worldPosition;
    const dangerMemory = guestDebug?.dangerMemory || null;
    if (!dangerMemory || !Number.isFinite(world?.x) || !Number.isFinite(world?.y)) {
      return;
    }

    const source = String(dangerMemory.source || "none");
    const liveThreat = dangerMemory.liveThreatWorld || null;
    const rememberedThreat = dangerMemory.lastKnownThreatWorld || null;
    const hasLiveThreat =
      Number.isFinite(liveThreat?.x) &&
      Number.isFinite(liveThreat?.y) &&
      dangerMemory.hasLiveThreat === true;
    const hasRememberedThreat =
      Number.isFinite(rememberedThreat?.x) &&
      Number.isFinite(rememberedThreat?.y) &&
      dangerMemory.expired !== true;

    if (hasRememberedThreat && source !== "live") {
      drawDangerThreatMarker({
        guestWorld: world,
        threatWorld: rememberedThreat,
        markerColor: GUEST_DANGER_REMEMBERED_COLOR,
        markerKind: "remembered",
        cameraTile,
        tilePixels,
        width,
        height,
      });
      const center = worldToScreen(
        world.x,
        world.y,
        cameraTile,
        tilePixels,
        width,
        height
      );
      overlay.lineStyle(
        Math.max(1, Math.round(tilePixels * 0.12)),
        GUEST_DANGER_REMEMBERED_COLOR,
        GUEST_DANGER_MEMORY_RING_ALPHA
      );
      overlay.strokeCircle(
        Math.round(center.x),
        Math.round(center.y),
        Math.max(6, Math.round(tilePixels * 0.58))
      );
    }

    if (hasLiveThreat) {
      drawDangerThreatMarker({
        guestWorld: world,
        threatWorld: liveThreat,
        markerColor: GUEST_DANGER_LIVE_COLOR,
        markerKind: "live",
        cameraTile,
        tilePixels,
        width,
        height,
      });
    }
  }

  function drawGuestPathDiagnostics(
    guestDebug,
    cameraTile,
    tilePixels,
    width,
    height
  ) {
    const start = guestDebug?.worldPosition;
    const pathWorld = Array.isArray(guestDebug?.pathWorld) ? guestDebug.pathWorld : [];
    if (!start || pathWorld.length === 0) {
      return;
    }
    if (
      !Number.isFinite(start.x) ||
      !Number.isFinite(start.y)
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
    overlay.lineStyle(
      Math.max(1, Math.round(tilePixels * 0.18)),
      PATH_STROKE_COLOR,
      PATH_STROKE_ALPHA
    );
    overlay.beginPath();
    overlay.moveTo(startScreen.x, startScreen.y);
    let waypointScreen = null;
    for (const point of pathWorld) {
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
        continue;
      }
      waypointScreen = worldToScreen(
        point.x,
        point.y,
        cameraTile,
        tilePixels,
        width,
        height
      );
      overlay.lineTo(waypointScreen.x, waypointScreen.y);
    }
    overlay.strokePath();
    if (!waypointScreen) {
      return;
    }
    overlay.fillStyle(PATH_NODE_FILL_COLOR, PATH_NODE_FILL_ALPHA);
    overlay.fillCircle(
      Math.round(waypointScreen.x),
      Math.round(waypointScreen.y),
      Math.max(2, Math.round(tilePixels * 0.22))
    );
  }

  function drawGuestAreaContextDiagnostics(
    guestDebug,
    cameraTile,
    tilePixels,
    width,
    height
  ) {
    const world = guestDebug?.worldPosition;
    const inputDebug = guestDebug?.mentalModel?.inputDebug;
    if (
      !world ||
      !Number.isFinite(world.x) ||
      !Number.isFinite(world.y) ||
      !inputDebug
    ) {
      return;
    }

    let color = GUEST_AREA_OTHER_COLOR;
    if (inputDebug.doorwayTreatedAsRoom === true) {
      color = GUEST_AREA_DOORWAY_COLOR;
    } else if (inputDebug.inRoom === true) {
      color = GUEST_AREA_ROOM_COLOR;
    } else if (inputDebug.inCorridor === true) {
      color = GUEST_AREA_CORRIDOR_COLOR;
    }

    const center = worldToScreen(world.x, world.y, cameraTile, tilePixels, width, height);
    const markerRadius = Math.max(2, Math.round(tilePixels * 0.12));
    const markerOffsetY = Math.max(4, Math.round(tilePixels * 0.34));

    overlay.fillStyle(color, GUEST_AREA_MARKER_ALPHA);
    overlay.fillCircle(
      Math.round(center.x),
      Math.round(center.y - markerOffsetY),
      markerRadius
    );
    if (inputDebug.doorwayTreatedAsRoom === true) {
      overlay.lineStyle(1, GUEST_AREA_DOORWAY_COLOR, 1);
      overlay.beginPath();
      overlay.moveTo(center.x - markerRadius - 1, center.y - markerOffsetY);
      overlay.lineTo(center.x + markerRadius + 1, center.y - markerOffsetY);
      overlay.strokePath();
    }
  }

  function drawGuestMentalArbitrationDiagnostics(
    guestDebug,
    cameraTile,
    tilePixels,
    width,
    height
  ) {
    const world = guestDebug?.worldPosition;
    const mentalModel = guestDebug?.mentalModel;
    const evaluation = mentalModel?.lastEvaluation;
    if (
      !world ||
      !evaluation ||
      !Number.isFinite(world.x) ||
      !Number.isFinite(world.y)
    ) {
      return;
    }

    const center = worldToScreen(world.x, world.y, cameraTile, tilePixels, width, height);
    const radiusBase = Math.max(5, tilePixels * 0.35);
    const lineWidth = Math.max(1, Math.round(tilePixels * 0.08));

    const minimumHoldSeconds = Math.max(
      0.000001,
      Number(evaluation.minimumHoldSeconds) || 0.000001
    );
    const holdSeconds = Math.max(0, Number(evaluation.objectiveHoldSeconds) || 0);
    const holdProgress = Math.max(0, Math.min(1, holdSeconds / minimumHoldSeconds));
    overlay.lineStyle(lineWidth, GUEST_ARBITRATION_HOLD_COLOR, 0.88);
    overlay.beginPath();
    overlay.arc(
      center.x,
      center.y,
      radiusBase,
      -Math.PI * 0.5,
      -Math.PI * 0.5 + Math.PI * 2 * holdProgress,
      false
    );
    overlay.strokePath();

    if (evaluation.holdLocked === true) {
      overlay.lineStyle(lineWidth, GUEST_ARBITRATION_LOCKED_COLOR, 0.95);
      overlay.strokeCircle(center.x, center.y, radiusBase + Math.max(1, lineWidth));
    }
    if (evaluation.preemptionGate?.allowed === true) {
      overlay.fillStyle(GUEST_ARBITRATION_PREEMPT_COLOR, 0.95);
      overlay.fillCircle(
        Math.round(center.x + radiusBase + 3),
        Math.round(center.y - radiusBase - 1),
        Math.max(2, Math.round(tilePixels * 0.1))
      );
    }
    if (evaluation.fallback?.active === true) {
      const retrySeconds = Math.max(0, Number(evaluation.fallback.retryRemainingSeconds) || 0);
      const retryDelay = Math.max(
        0.000001,
        Number(evaluation.fallback.retryDelaySeconds) || 0.000001
      );
      const retryProgress = Math.max(0, Math.min(1, retrySeconds / retryDelay));
      overlay.lineStyle(lineWidth, GUEST_ARBITRATION_FALLBACK_COLOR, 0.95);
      overlay.beginPath();
      overlay.arc(
        center.x,
        center.y,
        radiusBase + Math.max(2, lineWidth + 1),
        Math.PI * 0.5,
        Math.PI * 0.5 + Math.PI * 2 * retryProgress,
        false
      );
      overlay.strokePath();
    }
  }

  function resolveObjectivePathOverlayStatus(guestDebug) {
    const objectiveIntent = guestDebug?.objectiveIntent || null;
    const pathStatus = objectiveIntent?.objectivePathStatus || "idle";
    const objectiveReasonCode = objectiveIntent?.objectiveReasonCode || null;
    const fallback = guestDebug?.mentalModel?.lastEvaluation?.fallback || null;

    if (pathStatus === "retrying") {
      return "retrying";
    }
    if (
      pathStatus === "fallback" ||
      objectiveReasonCode === "fallback" ||
      fallback?.active === true ||
      fallback?.applied === true
    ) {
      return "fallback";
    }
    if (pathStatus === "valid" || pathStatus === "following_path") {
      return "valid";
    }
    return "idle";
  }

  function resolveObjectivePathOverlayColor(status) {
    if (status === "valid") {
      return OBJECTIVE_PATH_VALID_COLOR;
    }
    if (status === "fallback") {
      return OBJECTIVE_PATH_FALLBACK_COLOR;
    }
    if (status === "retrying") {
      return OBJECTIVE_PATH_RETRYING_COLOR;
    }
    return OBJECTIVE_PATH_IDLE_COLOR;
  }

  function resolveObjectivePathOverlayBackground(status) {
    if (status === "valid") {
      return OBJECTIVE_PATH_STATUS_VALID_BG;
    }
    if (status === "fallback") {
      return OBJECTIVE_PATH_STATUS_FALLBACK_BG;
    }
    if (status === "retrying") {
      return OBJECTIVE_PATH_STATUS_RETRYING_BG;
    }
    return OBJECTIVE_PATH_STATUS_IDLE_BG;
  }

  function drawInspectedGuestSpatialContextOverlay(
    guestDebug,
    cameraTile,
    tilePixels,
    width,
    height
  ) {
    const world = guestDebug?.worldPosition;
    if (!Number.isFinite(world?.x) || !Number.isFinite(world?.y)) {
      return;
    }
    const knowledge = getInspectedGuestTileKnowledge(
      SPATIAL_CLASSIFIER_SAMPLE_RADIUS_TILES
    );
    if (
      !knowledge ||
      !Array.isArray(knowledge.sampleTiles) ||
      knowledge.sampleTiles.length === 0
    ) {
      return;
    }
    const dangerMemory = guestDebug?.dangerMemory || null;
    let roomDangerActive =
      guestDebug?.objectiveIntent?.objectiveDispatchMode === "danger_room_egress";
    if (!roomDangerActive && typeof runtime?.classifyAreaAtWorld === "function") {
      const dangerSource = String(dangerMemory?.source || "none");
      const dangerWorld =
        dangerSource === "live"
          ? dangerMemory?.liveThreatWorld
          : dangerMemory?.lastKnownThreatWorld;
      if (dangerSource !== "none" && Number.isFinite(dangerWorld?.x) && Number.isFinite(dangerWorld?.y)) {
        const guestArea = runtime.classifyAreaAtWorld(world.x, world.y);
        const dangerArea = runtime.classifyAreaAtWorld(dangerWorld.x, dangerWorld.y);
        const guestInRoom =
          guestArea?.inRoom === true || guestArea?.doorwayTreatedAsRoom === true;
        const dangerInRoom =
          dangerArea?.inRoom === true || dangerArea?.doorwayTreatedAsRoom === true;
        roomDangerActive = guestInRoom && dangerInRoom;
      }
    }

    for (const tile of knowledge.sampleTiles) {
      if (!Number.isFinite(tile?.x) || !Number.isFinite(tile?.y)) {
        continue;
      }
      const identified = tile.identified === true;
      if (!identified) {
        continue;
      }
      const rect = worldRectScreen(
        tile.x,
        tile.y,
        1,
        1,
        cameraTile,
        tilePixels,
        width,
        height
      );
      const sourceLos = tile.sourceLos === true;
      const sourceRoomReveal = tile.sourceRoomReveal === true;
      let fillColor = TILE_KNOWLEDGE_LOS_ONLY_COLOR;
      let fillAlpha = 0.3;
      if (sourceLos && sourceRoomReveal) {
        fillColor = TILE_KNOWLEDGE_MIXED_COLOR;
        fillAlpha = 0.28;
      } else if (sourceLos) {
        fillColor = TILE_KNOWLEDGE_LOS_ONLY_COLOR;
        fillAlpha = 0.3;
      } else if (sourceRoomReveal) {
        fillColor = TILE_KNOWLEDGE_ROOM_REVEAL_COLOR;
        fillAlpha = 0.26;
      }
      const isDangerRoomTile = roomDangerActive && tile.inRoom === true;
      if (isDangerRoomTile) {
        fillColor = GUEST_AREA_ROOM_DANGER_COLOR;
        fillAlpha = GUEST_AREA_ROOM_DANGER_FILL_ALPHA;
      }
      overlay.fillStyle(fillColor, fillAlpha);
      overlay.fillRect(rect.x, rect.y, rect.w, rect.h);

      let borderColor = GUEST_AREA_OTHER_COLOR;
      if (tile.doorwayTreatedAsRoom === true) {
        borderColor = GUEST_AREA_DOORWAY_COLOR;
      } else if (tile.inRoom === true) {
        borderColor = GUEST_AREA_ROOM_COLOR;
      } else if (tile.inCorridor === true) {
        borderColor = GUEST_AREA_CORRIDOR_COLOR;
      }
      if (isDangerRoomTile) {
        borderColor = GUEST_AREA_ROOM_DANGER_COLOR;
      }
      overlay.lineStyle(1, borderColor, identified ? 0.72 : 0.28);
      overlay.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w, rect.h);

      if (tile.doorwayTreatedAsRoom === true && identified) {
        overlay.lineStyle(1, GUEST_AREA_DOORWAY_COLOR, 1);
        overlay.beginPath();
        overlay.moveTo(rect.x + 1, rect.y + 1);
        overlay.lineTo(rect.x + rect.w - 1, rect.y + rect.h - 1);
        overlay.moveTo(rect.x + rect.w - 1, rect.y + 1);
        overlay.lineTo(rect.x + 1, rect.y + rect.h - 1);
        overlay.strokePath();
      }
    }

    if (
      Number.isFinite(knowledge.centerTile?.x) &&
      Number.isFinite(knowledge.centerTile?.y)
    ) {
      const centerRect = worldRectScreen(
        knowledge.centerTile.x,
        knowledge.centerTile.y,
        1,
        1,
        cameraTile,
        tilePixels,
        width,
        height
      );
      overlay.lineStyle(2, 0xffffff, 0.95);
      overlay.strokeRect(centerRect.x + 0.5, centerRect.y + 0.5, centerRect.w, centerRect.h);
    }
  }

  function drawInspectedGuestObjectiveOverlay(
    guestDebug,
    cameraTile,
    tilePixels,
    width,
    height
  ) {
    const world = guestDebug?.worldPosition;
    if (!Number.isFinite(world?.x) || !Number.isFinite(world?.y)) {
      hideObjectiveStatusTag();
      return;
    }
    const objectiveIntent = guestDebug?.objectiveIntent || null;
    if (!objectiveIntent) {
      hideObjectiveStatusTag();
      return;
    }
    const status = resolveObjectivePathOverlayStatus(guestDebug);
    const mentalEvaluation = guestDebug?.mentalModel?.lastEvaluation || null;
    const dangerMemory = guestDebug?.dangerMemory || null;
    const dangerResponse = guestDebug?.dangerResponse || null;
    const pathFeedback = guestDebug?.pathFeedback || null;
    const statusColor = resolveObjectivePathOverlayColor(status);
    const center = worldToScreen(world.x, world.y, cameraTile, tilePixels, width, height);
    const ringRadius = Math.max(7, tilePixels * 0.5);
    const strokeWidth = Math.max(1, Math.round(tilePixels * 0.16));
    overlay.lineStyle(strokeWidth, statusColor, 0.95);
    overlay.strokeCircle(Math.round(center.x), Math.round(center.y), Math.round(ringRadius));

    const target = objectiveIntent?.objectiveTargetWorld || null;
    if (Number.isFinite(target?.x) && Number.isFinite(target?.y)) {
      const targetScreen = worldToScreen(
        target.x,
        target.y,
        cameraTile,
        tilePixels,
        width,
        height
      );
      overlay.lineStyle(strokeWidth, statusColor, 0.92);
      overlay.beginPath();
      overlay.moveTo(center.x, center.y);
      overlay.lineTo(targetScreen.x, targetScreen.y);
      overlay.strokePath();

      const markerRadius = Math.max(3, Math.round(tilePixels * 0.22));
      if (status === "retrying") {
        overlay.lineStyle(strokeWidth, statusColor, 0.98);
        overlay.beginPath();
        overlay.moveTo(targetScreen.x - markerRadius, targetScreen.y - markerRadius);
        overlay.lineTo(targetScreen.x + markerRadius, targetScreen.y + markerRadius);
        overlay.moveTo(targetScreen.x + markerRadius, targetScreen.y - markerRadius);
        overlay.lineTo(targetScreen.x - markerRadius, targetScreen.y + markerRadius);
        overlay.strokePath();
      } else if (status === "fallback") {
        overlay.lineStyle(strokeWidth, statusColor, 0.98);
        overlay.strokeRect(
          Math.round(targetScreen.x - markerRadius),
          Math.round(targetScreen.y - markerRadius),
          markerRadius * 2,
          markerRadius * 2
        );
      } else {
        overlay.fillStyle(statusColor, 0.95);
        overlay.fillCircle(
          Math.round(targetScreen.x),
          Math.round(targetScreen.y),
          markerRadius
        );
      }
    }

    const objectiveState = objectiveIntent.objectiveState || "none";
    const transitionReasonCode =
      mentalEvaluation?.objectiveTransitionReasonCode ||
      mentalEvaluation?.arbitrationReasonCode ||
      objectiveIntent?.objectiveReasonCode ||
      "n/a";
    const objectiveFailureReason =
      objectiveIntent?.objectiveFailureReason ||
      dangerResponse?.failureReason ||
      mentalEvaluation?.fallback?.lastFailureReason ||
      "none";
    const objectiveReplanReasonCode =
      objectiveIntent?.objectiveReplanReasonCode || "none";
    const previousObjective = mentalEvaluation?.previousObjectiveState || "none";
    const dangerSource = String(dangerMemory?.source || "none");
    const labelLines = [
      `Obj ${objectiveState} | Path ${status}`,
      `Transition ${previousObjective}->${objectiveState} (${transitionReasonCode})`,
      `Dispatch ${objectiveIntent.objectiveDispatchMode || "n/a"}`,
      `Replan ${objectiveReplanReasonCode}`,
      `Plan ${status} | fail ${objectiveFailureReason}`,
      `Feedback ${pathFeedback?.status || "none"} | reason ${pathFeedback?.reason || "none"} | dispatch ${pathFeedback?.dispatchMode || "n/a"}`,
    ];

    if (dangerSource !== "none" || objectiveState === "danger") {
      const dangerSignal = formatDangerSignal(dangerMemory?.signalFinal);
      const expiresInSeconds = Number(dangerMemory?.expiresInSeconds);
      const memoryAgeSeconds = Number(dangerMemory?.memoryAgeSeconds);
      const dangerSignalLineParts = [
        `Danger ${dangerSource}`,
        `sig ${dangerSignal}`,
      ];
      if (dangerSource === "remembered") {
        if (Number.isFinite(memoryAgeSeconds)) {
          dangerSignalLineParts.push(`age ${memoryAgeSeconds.toFixed(2)}s`);
        }
        if (Number.isFinite(expiresInSeconds)) {
          dangerSignalLineParts.push(`exp ${Math.max(0, expiresInSeconds).toFixed(2)}s`);
        }
      }
      labelLines.push(dangerSignalLineParts.join(" | "));
      labelLines.push(
        `Resp c=${Math.max(0, Math.floor(Number(dangerResponse?.candidateCount) || 0))} | sel=${
          Number.isFinite(dangerResponse?.selectedCandidateIndex)
            ? Math.floor(Number(dangerResponse.selectedCandidateIndex))
            : "n/a"
        } | score=${
          Number.isFinite(dangerResponse?.selectedScore)
            ? Number(dangerResponse.selectedScore).toFixed(2)
            : "n/a"
        }${dangerResponse?.tieBreakUsed === true ? " | tie-break" : ""}`
      );
    }

    objectiveStatusTagText.setText(labelLines.join("\n"));
    objectiveStatusTagText.setBackgroundColor(
      resolveObjectivePathOverlayBackground(status)
    );
    const tagX = Math.max(8, Math.min(width - objectiveStatusTagText.width - 8, center.x + 10));
    const minTagY = Math.max(8, Math.round(resolveTopLeftUiInsetPx()) + 8);
    const tagY = Math.max(
      minTagY,
      Math.min(height - objectiveStatusTagText.height - 8, center.y - 24)
    );
    objectiveStatusTagText.setPosition(Math.round(tagX), Math.round(tagY));
    objectiveStatusTagText.setVisible(enabled);
  }

  function drawSpatialObjectiveLegend(viewHeightPx) {
    const startX = 10;
    const badgeSpacingPx = 3;
    const titleBottomGapPx = 4;
    let legendHeightPx = spatialLegendTitleText.height + titleBottomGapPx;
    for (let i = 0; i < spatialLegendBadgeTexts.length; i += 1) {
      legendHeightPx += spatialLegendBadgeTexts[i].height;
      if (i < spatialLegendBadgeTexts.length - 1) {
        legendHeightPx += badgeSpacingPx;
      }
    }
    const minStartYPx = 10;
    const maxStartYPx = Math.max(minStartYPx, Math.floor(viewHeightPx - legendHeightPx - 10));
    const startY = Math.min(
      maxStartYPx,
      minStartYPx + Math.round(resolveTopLeftUiInsetPx())
    );
    spatialLegendTitleText.setPosition(startX, startY);
    spatialLegendTitleText.setVisible(enabled);
    let cursorY = startY + spatialLegendTitleText.height + titleBottomGapPx;
    for (const badgeText of spatialLegendBadgeTexts) {
      badgeText.setPosition(startX, cursorY);
      badgeText.setVisible(enabled);
      cursorY += badgeText.height + badgeSpacingPx;
    }
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
      hideSpatialOverlayLegend();
      hideObjectiveStatusTag();
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

    let inspectedGuestDebug = null;

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
      const isInspectedGuest = inspectedGuestId != null && human.id === inspectedGuestId;
      if (isInspectedGuest) {
        inspectedGuestDebug = debug;
      }
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
      drawGuestAreaContextDiagnostics(debug, cameraTile, tilePixels, width, height);
      drawGuestMentalArbitrationDiagnostics(debug, cameraTile, tilePixels, width, height);
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

    if (inspectedGuestDebug) {
      drawInspectedGuestSpatialContextOverlay(
        inspectedGuestDebug,
        cameraTile,
        tilePixels,
        width,
        height
      );
      drawInspectedGuestDangerOverlay(
        inspectedGuestDebug,
        cameraTile,
        tilePixels,
        width,
        height
      );
      drawInspectedGuestObjectiveOverlay(
        inspectedGuestDebug,
        cameraTile,
        tilePixels,
        width,
        height
      );
      drawSpatialObjectiveLegend(height);
    } else {
      hideSpatialOverlayLegend();
      hideObjectiveStatusTag();
    }
  }

  function findGuestAtScreenPoint(screenX, screenY) {
    if (!humanManager || typeof humanManager.getHumanEntries !== "function") {
      return null;
    }
    const entries = humanManager.getHumanEntries({ livingOnly: true });
    let best = null;
    let bestDistance = Infinity;
    for (const entry of entries) {
      if (entry?.role !== "guest") {
        continue;
      }
      const controller = entry?.controller;
      if (
        typeof controller?.containsScreenPoint !== "function" ||
        typeof controller?.getScreenBounds !== "function"
      ) {
        continue;
      }
      if (!controller.containsScreenPoint(screenX, screenY)) {
        continue;
      }
      const bounds = controller.getScreenBounds();
      const centerX = bounds.x + bounds.w * 0.5;
      const centerY = bounds.y + bounds.h * 0.5;
      const distance = Math.hypot(screenX - centerX, screenY - centerY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = {
          id: entry.id,
        };
      }
    }
    return best;
  }

  function handleInspectPointer(screenX, screenY) {
    if (!enabled) {
      return false;
    }
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
      return false;
    }
    const pickedGuest = findGuestAtScreenPoint(screenX, screenY);
    if (pickedGuest) {
      inspectedGuestId = pickedGuest.id;
      inspectedGuestLabel = String(pickedGuest.id);
    } else {
      inspectedGuestId = null;
      inspectedGuestLabel = "";
    }
    forceBrainPanelRefresh = true;
    return true;
  }

  function getInspectedGuestId() {
    return inspectedGuestId;
  }

  function getInspectedGuestWorld() {
    if (!inspectedGuestId) {
      return null;
    }
    if (!humanManager || typeof humanManager.getHumanEntries !== "function") {
      return null;
    }
    const entries = humanManager.getHumanEntries({ livingOnly: true });
    const guest = entries.find(
      (entry) => entry?.id === inspectedGuestId && entry?.role === "guest"
    );
    if (!guest || typeof guest.controller?.getCurrentWorldPosition !== "function") {
      return null;
    }
    const world = guest.controller.getCurrentWorldPosition();
    if (!Number.isFinite(world?.x) || !Number.isFinite(world?.y)) {
      return null;
    }
    return {
      x: world.x,
      y: world.y,
    };
  }

  function getInspectedGuestTileKnowledge(sampleRadiusTiles) {
    if (!inspectedGuestId) {
      return null;
    }
    if (
      !humanManager ||
      typeof humanManager.getGuestTileKnowledgeDebug !== "function"
    ) {
      return null;
    }
    return humanManager.getGuestTileKnowledgeDebug(inspectedGuestId, {
      sampleRadiusTiles,
    });
  }

  function deriveTopDominantContributionTerms({
    evaluation,
    dominantState,
    inputs,
    inputValues,
    stateWeights,
    stateBias,
  }) {
    if (Array.isArray(evaluation?.dominantTopContributions)) {
      return evaluation.dominantTopContributions.slice(0, 3);
    }
    if (Array.isArray(evaluation?.dominantContributionTerms)) {
      return evaluation.dominantContributionTerms.slice(0, 3);
    }
    const weights = stateWeights?.[dominantState] || {};
    const terms = [
      {
        termType: "bias",
        inputId: null,
        weight: null,
        inputValue: null,
        contribution: Number(stateBias?.[dominantState]) || 0,
      },
    ];
    for (const inputId of inputs) {
      const inputValue = Number(inputValues[inputId]) || 0;
      const weight = Number(weights[inputId]) || 0;
      terms.push({
        termType: "input",
        inputId,
        weight,
        inputValue,
        contribution: weight * inputValue,
      });
    }
    terms.sort(
      (a, b) =>
        Math.abs(Number(b.contribution) || 0) - Math.abs(Number(a.contribution) || 0)
    );
    return terms.slice(0, 3);
  }

  function formatContributionTerm(term) {
    const contribution = Number(term?.contribution) || 0;
    const signedContribution = contribution >= 0 ? "+" : "";
    if (term?.termType === "bias") {
      return `bias ${signedContribution}${contribution.toFixed(3)}`;
    }
    const inputId = term?.inputId || "input";
    const weight = Number(term?.weight) || 0;
    const inputValue = Number(term?.inputValue) || 0;
    return `${inputId} ${signedContribution}${contribution.toFixed(3)} (w=${weight.toFixed(2)}*v=${inputValue.toFixed(2)})`;
  }

  function buildDecisionBadges(evaluation) {
    if (!evaluation) {
      return [];
    }
    const badges = [];
    const holdSeconds = Math.max(0, Number(evaluation.objectiveHoldSeconds) || 0);
    const holdRequired = Math.max(0, Number(evaluation.minimumHoldSeconds) || 0);
    const holdReady = holdSeconds >= holdRequired && holdRequired > 0;
    badges.push({
      text: `HOLD ${holdSeconds.toFixed(2)}/${holdRequired.toFixed(2)}`,
      textColor: BRAIN_PANEL_BADGE_TEXT_COLOR,
      backgroundColor: evaluation.holdLocked
        ? BRAIN_PANEL_BADGE_HOLD_LOCKED_BG
        : holdReady
          ? BRAIN_PANEL_BADGE_HOLD_READY_BG
          : BRAIN_PANEL_BADGE_HOLD_BG,
    });

    const gate = evaluation.preemptionGate || null;
    if (gate) {
      const gateLabel = gate.allowed
        ? "PREEMPT OPEN"
        : `PREEMPT ${gate.thresholdMet ? "T+" : "T-"} ${gate.marginMet ? "M+" : "M-"}`;
      badges.push({
        text: gateLabel,
        textColor: BRAIN_PANEL_BADGE_TEXT_COLOR,
        backgroundColor: gate.allowed
          ? BRAIN_PANEL_BADGE_PREEMPT_OPEN_BG
          : BRAIN_PANEL_BADGE_SUBTLE_BG,
      });
    } else {
      badges.push({
        text: "PREEMPT n/a",
        textColor: BRAIN_PANEL_BADGE_TEXT_COLOR,
        backgroundColor: BRAIN_PANEL_BADGE_SUBTLE_BG,
      });
    }

    const retrySeconds = Math.max(
      0,
      Number(evaluation.fallback?.retryRemainingSeconds) || 0
    );
    const retryCount = Math.max(0, Number(evaluation.fallback?.retryCount) || 0);
    badges.push({
      text:
        evaluation.fallback?.active === true
          ? `RETRY ${retrySeconds.toFixed(2)}s #${retryCount}`
          : `RETRY OFF #${retryCount}`,
      textColor: BRAIN_PANEL_BADGE_TEXT_COLOR,
      backgroundColor:
        evaluation.fallback?.active === true
          ? BRAIN_PANEL_BADGE_RETRY_ACTIVE_BG
          : BRAIN_PANEL_BADGE_SUBTLE_BG,
    });
    return badges;
  }

  function buildGuestBrainPanelCache(humanManagerDebug) {
    if (!inspectedGuestId) {
      return {
        status: "none",
        message: "Guest Brain Inspect\nAlt + Left Click a guest to inspect.",
        lines: [],
        graph: null,
        badges: [],
      };
    }
    const humans = Array.isArray(humanManagerDebug?.humans) ? humanManagerDebug.humans : [];
    const inspected = humans.find((human) => human?.id === inspectedGuestId) || null;
    if (!inspected) {
      return {
        status: "unavailable",
        message: `Guest Brain Inspect\nGuest ${inspectedGuestLabel || inspectedGuestId} unavailable (dead/despawned).`,
        lines: [],
        graph: null,
        badges: [],
      };
    }
    if (inspected.role !== "guest") {
      return {
        status: "invalid",
        message: `Guest Brain Inspect\nEntity ${inspected.id} is not a guest.`,
        lines: [],
        graph: null,
        badges: [],
      };
    }
    if (inspected.alive !== true) {
      return {
        status: "unavailable",
        message: `Guest Brain Inspect\nGuest ${inspected.id} unavailable (dead/despawned).`,
        lines: [],
        graph: null,
        badges: [],
      };
    }
    const debug = inspected.debug || null;
    const mentalModel = debug?.mentalModel || null;
    const evaluation = mentalModel?.lastEvaluation || null;
    const config = humanManagerDebug?.guestMentalModel || null;
    if (!mentalModel || !evaluation || !config?.enabled) {
      return {
        status: "missing_payload",
        message: `Guest Brain Inspect\nGuest ${inspected.id} has no mental-model payload.`,
        lines: [],
        graph: null,
        badges: [],
      };
    }

    const states = Array.isArray(config.states) ? config.states : [];
    const inputs = Array.isArray(config.inputs) ? config.inputs : [];
    const disabledStates = new Set(
      Array.isArray(config.disabledStates) ? config.disabledStates : []
    );
    const scoresByState = evaluation.scoresByState || {};
    const inputValues = evaluation.inputValues || {};
    const stateWeights = config.stateWeights || {};
    const stateBias = config.stateBias || {};
    const dominantState = evaluation.dominantState || "none";
    const objectiveState = evaluation.objectiveState || "none";
    const transitionReasonCode =
      evaluation.objectiveTransitionReasonCode ||
      evaluation.arbitrationReasonCode ||
      "n/a";
    const fallbackReason =
      evaluation.fallback?.lastFailureReason ||
      evaluation.pathFeedback?.reason ||
      "none";
    const objectiveIntent = debug?.objectiveIntent || null;
    const movementPathFeedback = debug?.pathFeedback || null;
    const dangerMemory = debug?.dangerMemory || null;
    const dangerResponse = debug?.dangerResponse || null;
    const topContributionTerms = deriveTopDominantContributionTerms({
      evaluation,
      dominantState,
      inputs,
      inputValues,
      stateWeights,
      stateBias,
    });
    const whyWonText =
      topContributionTerms.length > 0
        ? topContributionTerms.map(formatContributionTerm).join(" | ")
        : "n/a";

    const lines = [];
    lines.push(`Guest Brain Inspect`);
    lines.push(`Guest: ${inspected.id}`);
    lines.push(
      `Dominant: ${dominantState} | Objective: ${objectiveState} | Arbitration: ${
        evaluation.arbitrationReasonCode || "n/a"
      }`
    );
    lines.push(
      `Transition: ${evaluation.previousObjectiveState || "none"} -> ${objectiveState} (${transitionReasonCode})`
    );
    lines.push(`Why this won (top 3): ${whyWonText}`);
    lines.push(
      `Fallback: reason=${fallbackReason} | retry=${(Number(evaluation.fallback?.retryRemainingSeconds) || 0).toFixed(2)}s | count=${Math.max(0, Math.floor(Number(evaluation.fallback?.retryCount) || 0))}`
    );
    if (objectiveIntent) {
      lines.push(
        `Movement: dispatch=${objectiveIntent.objectiveDispatchMode || "n/a"} | path=${objectiveIntent.objectivePathStatus || "n/a"} | replan=${objectiveIntent.objectiveReplanReasonCode || "none"} | fail=${objectiveIntent.objectiveFailureReason || "none"}`
      );
    }
    if (movementPathFeedback) {
      lines.push(
        `Path feedback: status=${movementPathFeedback.status || "none"} | reason=${movementPathFeedback.reason || "none"} | dispatch=${movementPathFeedback.dispatchMode || "n/a"}`
      );
    }
    if (dangerMemory) {
      lines.push(
        `Danger signal: src=${dangerMemory.source || "none"} | final=${formatDangerSignal(
          dangerMemory.signalFinal
        )} | live=${formatDangerSignal(dangerMemory.signalLive)} | remembered=${formatDangerSignal(
          dangerMemory.signalRemembered
        )}`
      );
      lines.push(
        `Danger memory: age=${(Number(dangerMemory.memoryAgeSeconds) || 0).toFixed(2)}s | expires=${Math.max(
          0,
          Number(dangerMemory.expiresInSeconds) || 0
        ).toFixed(2)}s | expired=${dangerMemory.expired === true}`
      );
    }
    if (dangerResponse) {
      lines.push(
        `Danger response: candidates=${Math.max(
          0,
          Math.floor(Number(dangerResponse.candidateCount) || 0)
        )} | selected=${
          Number.isFinite(dangerResponse.selectedCandidateIndex)
            ? Math.floor(Number(dangerResponse.selectedCandidateIndex))
            : "n/a"
        } | score=${
          Number.isFinite(dangerResponse.selectedScore)
            ? Number(dangerResponse.selectedScore).toFixed(2)
            : "n/a"
        } | tie_break=${dangerResponse.tieBreakUsed === true} | failure=${
          dangerResponse.failureReason || "none"
        }`
      );
    }
    lines.push(`Inputs:`);
    for (const inputId of inputs) {
      const value = Number(inputValues[inputId]) || 0;
      const inactive = mentalModel?.inputDebug?.inactiveInputs?.[inputId] === true;
      lines.push(`  - ${inputId}: ${value.toFixed(2)}${inactive ? " (inactive=0)" : ""}`);
    }
    lines.push(`Scores:`);
    for (const stateId of states) {
      const score = Number(scoresByState[stateId]) || 0;
      const disabled = disabledStates.has(stateId);
      lines.push(
        `  - ${stateId}: ${score.toFixed(2)}${disabled ? " [disabled]" : ""}`
      );
    }
    lines.push(`Contrib (${dominantState}):`);
    const dominantWeights = stateWeights?.[dominantState] || {};
    for (const inputId of inputs) {
      const inputValue = Number(inputValues[inputId]) || 0;
      const weight = Number(dominantWeights[inputId]) || 0;
      const contribution = weight * inputValue;
      const sign = contribution >= 0 ? "+" : "";
      lines.push(
        `  - ${inputId}: ${sign}${contribution.toFixed(3)} (w=${weight.toFixed(2)} x v=${inputValue.toFixed(2)})`
      );
    }
    lines.push(`  - bias: ${(Number(stateBias[dominantState]) || 0).toFixed(2)}`);

    const inputNodes = [];
    const stateNodes = [];
    const edges = [];
    const graphLeftX = 26;
    const graphRightX = BRAIN_PANEL_WIDTH_PX - 28;
    const graphTopY = BRAIN_PANEL_GRAPH_TOP_PX + 18;
    const graphBottomY = graphTopY + (BRAIN_PANEL_GRAPH_HEIGHT_PX - 32);
    const inputGap =
      inputs.length > 1 ? (graphBottomY - graphTopY) / (inputs.length - 1) : 0;
    const stateGap =
      states.length > 1 ? (graphBottomY - graphTopY) / (states.length - 1) : 0;
    for (let i = 0; i < inputs.length; i += 1) {
      const inputId = inputs[i];
      inputNodes.push({
        id: inputId,
        x: graphLeftX,
        y: graphTopY + inputGap * i,
        value: Number(inputValues[inputId]) || 0,
        inactive: mentalModel?.inputDebug?.inactiveInputs?.[inputId] === true,
      });
    }
    for (let j = 0; j < states.length; j += 1) {
      const stateId = states[j];
      stateNodes.push({
        id: stateId,
        x: graphRightX,
        y: graphTopY + stateGap * j,
        score: Number(scoresByState[stateId]) || 0,
        disabled: disabledStates.has(stateId),
        dominant: stateId === dominantState,
      });
    }
    for (const stateNode of stateNodes) {
      for (const inputNode of inputNodes) {
        const weight = Number(stateWeights?.[stateNode.id]?.[inputNode.id]) || 0;
        const contribution = weight * inputNode.value;
        const absContribution = Math.abs(contribution);
        edges.push({
          fromX: inputNode.x,
          fromY: inputNode.y,
          toX: stateNode.x,
          toY: stateNode.y,
          color: stateNode.disabled
            ? BRAIN_PANEL_DISABLED_LINK_COLOR
            : contribution >= 0
              ? BRAIN_PANEL_POSITIVE_LINK_COLOR
              : BRAIN_PANEL_NEGATIVE_LINK_COLOR,
          alpha: stateNode.disabled
            ? 0.18
            : 0.08 + Math.min(0.65, absContribution * 1.35),
          width: 1 + Math.min(2.5, absContribution * 3.2),
        });
      }
    }

    return {
      status: "ok",
      lines,
      message: lines.join("\n"),
      badges: buildDecisionBadges(evaluation),
      graph: {
        inputNodes,
        stateNodes,
        edges,
      },
    };
  }

  function drawGuestBrainInspectPanel(humanManagerDebug, viewWidthPx, viewHeightPx) {
    const nowMs = scene.time?.now ?? performance.now();
    if (
      forceBrainPanelRefresh ||
      nowMs - lastBrainPanelRefreshAtMs >= BRAIN_PANEL_REFRESH_INTERVAL_MS
    ) {
      brainPanelCache = buildGuestBrainPanelCache(humanManagerDebug);
      lastBrainPanelRefreshAtMs = nowMs;
      forceBrainPanelRefresh = false;
      brainPanelText.setText(brainPanelCache.message || "");
    }

    const panelX = Math.max(4, viewWidthPx - BRAIN_PANEL_WIDTH_PX - BRAIN_PANEL_MARGIN_PX);
    const messageLineCount = Math.max(
      1,
      String(brainPanelCache.message || "").split("\n").length
    );
    const estimatedTextHeight = messageLineCount * 14 + 16;
    const graphBlockBottomY = BRAIN_PANEL_GRAPH_TOP_PX + BRAIN_PANEL_GRAPH_HEIGHT_PX;
    const textTopY = graphBlockBottomY + BRAIN_PANEL_TEXT_TOP_GAP_PX;
    const panelHeight = Math.max(
      BRAIN_PANEL_MIN_HEIGHT_PX,
      textTopY + estimatedTextHeight + 14
    );
    const cappedPanelHeight = Math.min(panelHeight, Math.max(120, viewHeightPx - 24));
    const panelY = BRAIN_PANEL_MARGIN_PX;

    overlay.fillStyle(BRAIN_PANEL_BACKGROUND_COLOR, BRAIN_PANEL_BACKGROUND_ALPHA);
    overlay.fillRect(panelX, panelY, BRAIN_PANEL_WIDTH_PX, cappedPanelHeight);
    overlay.lineStyle(1, BRAIN_PANEL_BORDER_COLOR, BRAIN_PANEL_BORDER_ALPHA);
    overlay.strokeRect(panelX + 0.5, panelY + 0.5, BRAIN_PANEL_WIDTH_PX, cappedPanelHeight);
    overlay.lineStyle(1, BRAIN_PANEL_ACCENT_COLOR, 0.9);
    overlay.beginPath();
    overlay.moveTo(panelX + 10, panelY + BRAIN_PANEL_GRAPH_TOP_PX - 8);
    overlay.lineTo(panelX + BRAIN_PANEL_WIDTH_PX - 10, panelY + BRAIN_PANEL_GRAPH_TOP_PX - 8);
    overlay.strokePath();
    overlay.lineStyle(1, BRAIN_PANEL_ACCENT_COLOR, 0.45);
    overlay.strokeRect(
      panelX + 10.5,
      panelY + BRAIN_PANEL_GRAPH_TOP_PX + 0.5,
      BRAIN_PANEL_WIDTH_PX - 21,
      BRAIN_PANEL_GRAPH_HEIGHT_PX
    );

    const badges = Array.isArray(brainPanelCache.badges) ? brainPanelCache.badges : [];
    let badgeX = panelX + 10;
    const badgeY = panelY + 10;
    for (let i = 0; i < brainPanelBadgeTexts.length; i += 1) {
      const badgeText = brainPanelBadgeTexts[i];
      const badge = badges[i];
      if (!badge) {
        badgeText.setVisible(false);
        continue;
      }
      badgeText.setText(String(badge.text || ""));
      badgeText.setColor(badge.textColor || BRAIN_PANEL_BADGE_TEXT_COLOR);
      badgeText.setBackgroundColor(badge.backgroundColor || BRAIN_PANEL_BADGE_SUBTLE_BG);
      badgeText.setPosition(Math.round(badgeX), Math.round(badgeY));
      badgeText.setVisible(enabled);
      badgeX += badgeText.width + 6;
    }

    const graph = brainPanelCache.graph;
    if (graph && brainPanelCache.status === "ok") {
      for (const edge of graph.edges) {
        overlay.lineStyle(edge.width, edge.color, edge.alpha);
        overlay.beginPath();
        overlay.moveTo(panelX + edge.fromX, panelY + edge.fromY);
        overlay.lineTo(panelX + edge.toX, panelY + edge.toY);
        overlay.strokePath();
      }
      for (const node of graph.inputNodes) {
        overlay.fillStyle(
          node.inactive ? BRAIN_PANEL_DISABLED_NODE_COLOR : BRAIN_PANEL_INPUT_NODE_COLOR,
          0.95
        );
        overlay.fillCircle(
          Math.round(panelX + node.x),
          Math.round(panelY + node.y),
          4
        );
      }
      for (const node of graph.stateNodes) {
        const fillColor = node.disabled
          ? BRAIN_PANEL_DISABLED_NODE_COLOR
          : node.dominant
            ? BRAIN_PANEL_DOMINANT_NODE_COLOR
            : BRAIN_PANEL_STATE_NODE_COLOR;
        overlay.fillStyle(fillColor, 0.98);
        overlay.fillCircle(
          Math.round(panelX + node.x),
          Math.round(panelY + node.y),
          node.dominant ? 5 : 4
        );
      }
    }

    brainPanelText.setPosition(panelX + 10, panelY + textTopY);
    brainPanelText.setVisible(enabled);
    if (brainPanelCache.status === "ok") {
      brainPanelText.setColor(BRAIN_PANEL_TEXT_COLOR);
    } else {
      brainPanelText.setColor(BRAIN_PANEL_DISABLED_TEXT_COLOR);
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
    const furnitureDebug = debugSnapshot?.furniture || null;

    drawFurnitureOccupancy(
      furnitureDebug,
      cameraTile,
      tilePixels,
      viewWidthPx,
      viewHeightPx
    );

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
    drawGuestBrainInspectPanel(humanManagerDebug, viewWidthPx, viewHeightPx);
  }

  function destroy() {
    overlay.clear();
    overlay.destroy();
    brainPanelText.destroy();
    for (const badgeText of brainPanelBadgeTexts) {
      badgeText.destroy();
    }
    spatialLegendTitleText.destroy();
    for (const badgeText of spatialLegendBadgeTexts) {
      badgeText.destroy();
    }
    objectiveStatusTagText.destroy();
  }

  return {
    setEnabled,
    isEnabled,
    setVisionDebugEnabled,
    isVisionDebugEnabled,
    handleInspectPointer,
    getInspectedGuestId,
    getInspectedGuestWorld,
    renderFrame,
    clear: () => {
      overlay.clear();
      brainPanelText.setVisible(false);
      hideBrainPanelBadges();
      hideSpatialOverlayLegend();
      hideObjectiveStatusTag();
    },
    destroy,
  };
}

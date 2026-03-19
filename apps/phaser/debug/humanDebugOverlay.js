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

export function createHumanDebugOverlay({
  scene,
  runtime,
  humanController,
  commandController = null,
} = {}) {
  if (!scene || !runtime || !humanController) {
    throw new Error(
      "createHumanDebugOverlay requires scene, runtime, and humanController."
    );
  }

  const overlay = scene.add.graphics();
  overlay.setDepth(90);
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

    drawCollisionObstacles(cameraTile, tilePixels, viewWidthPx, viewHeightPx);

    const commandDebug = commandController?.getDebugState?.() || null;
    const humanDebug = humanController.getDebugState();

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

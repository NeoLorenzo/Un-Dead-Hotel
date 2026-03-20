const AGENT_VISUAL_DIAMETER_TILES_APPROX = 0.82;
const BAR_WIDTH_TILES = 0.95;
const BAR_HEIGHT_TILES = 0.12;
const BAR_MIN_WIDTH_PX = 18;
const BAR_MAX_WIDTH_PX = 68;
const BAR_MIN_HEIGHT_PX = 3;
const BAR_MAX_HEIGHT_PX = 8;
const BAR_VERTICAL_GAP_PX = 4;
const ZOMBIE_COOLDOWN_GAP_PX = 2;
const OFFSCREEN_MARGIN_PX = 24;

const BAR_BG_COLOR = 0x141414;
const BAR_BG_ALPHA = 0.82;
const BAR_BORDER_COLOR = 0x000000;
const BAR_BORDER_ALPHA = 0.9;
const HUMAN_HP_COLOR = 0x4cff6a;
const ZOMBIE_HP_COLOR = 0xff7a45;
const ZOMBIE_COOLDOWN_COLOR = 0x5ec4ff;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function worldToScreen(worldX, worldY, cameraTile, tilePixels, viewWidthPx, viewHeightPx) {
  return {
    x: (worldX - cameraTile.x) * tilePixels + viewWidthPx * 0.5,
    y: (worldY - cameraTile.y) * tilePixels + viewHeightPx * 0.5,
  };
}

function drawHpBar(overlay, {
  worldX,
  worldY,
  currentHp,
  maxHp,
  color,
  cameraTile,
  tilePixels,
  viewWidthPx,
  viewHeightPx,
}) {
  if (
    !Number.isFinite(worldX) ||
    !Number.isFinite(worldY) ||
    !Number.isFinite(currentHp) ||
    !Number.isFinite(maxHp)
  ) {
    return;
  }

  const screen = worldToScreen(
    worldX,
    worldY,
    cameraTile,
    tilePixels,
    viewWidthPx,
    viewHeightPx
  );
  const barWidth = clamp(
    tilePixels * BAR_WIDTH_TILES,
    BAR_MIN_WIDTH_PX,
    BAR_MAX_WIDTH_PX
  );
  const barHeight = clamp(
    tilePixels * BAR_HEIGHT_TILES,
    BAR_MIN_HEIGHT_PX,
    BAR_MAX_HEIGHT_PX
  );
  const headOffsetPx = tilePixels * (AGENT_VISUAL_DIAMETER_TILES_APPROX * 0.5);
  const x = Math.round(screen.x - barWidth * 0.5);
  const y = Math.round(screen.y - headOffsetPx - BAR_VERTICAL_GAP_PX - barHeight);

  if (
    x + barWidth < -OFFSCREEN_MARGIN_PX ||
    x > viewWidthPx + OFFSCREEN_MARGIN_PX ||
    y + barHeight < -OFFSCREEN_MARGIN_PX ||
    y > viewHeightPx + OFFSCREEN_MARGIN_PX
  ) {
    return null;
  }

  const ratio = maxHp > 0 ? clamp(currentHp / maxHp, 0, 1) : 0;
  const fillWidth = Math.round(barWidth * ratio);

  overlay.fillStyle(BAR_BG_COLOR, BAR_BG_ALPHA);
  overlay.fillRect(x, y, Math.round(barWidth), Math.round(barHeight));
  if (fillWidth > 0) {
    overlay.fillStyle(color, 0.95);
    overlay.fillRect(x, y, fillWidth, Math.round(barHeight));
  }
  overlay.lineStyle(1, BAR_BORDER_COLOR, BAR_BORDER_ALPHA);
  overlay.strokeRect(x + 0.5, y + 0.5, Math.round(barWidth), Math.round(barHeight));
  return {
    x,
    y,
    w: Math.round(barWidth),
    h: Math.round(barHeight),
  };
}

function drawZombieCooldownBar(overlay, hpRect, attackState) {
  if (!hpRect || !attackState) {
    return;
  }
  const cooldownDuration = Number(attackState.cooldownDurationSeconds) || 0;
  const cooldownRemaining = Math.max(
    0,
    Number(attackState.cooldownRemainingSeconds) || 0
  );
  const progress =
    cooldownDuration > 0
      ? clamp(1 - cooldownRemaining / cooldownDuration, 0, 1)
      : 1;
  const fillWidth = Math.round(hpRect.w * progress);
  const y = hpRect.y + hpRect.h + ZOMBIE_COOLDOWN_GAP_PX;

  overlay.fillStyle(BAR_BG_COLOR, BAR_BG_ALPHA);
  overlay.fillRect(hpRect.x, y, hpRect.w, hpRect.h);
  if (fillWidth > 0) {
    overlay.fillStyle(ZOMBIE_COOLDOWN_COLOR, 0.95);
    overlay.fillRect(hpRect.x, y, fillWidth, hpRect.h);
  }
  overlay.lineStyle(1, BAR_BORDER_COLOR, BAR_BORDER_ALPHA);
  overlay.strokeRect(hpRect.x + 0.5, y + 0.5, hpRect.w, hpRect.h);
}

export function createAgentHpBarOverlay({
  scene,
  humanManager = null,
  humanController = null,
  zombieManager = null,
} = {}) {
  if (!scene) {
    throw new Error("createAgentHpBarOverlay requires scene.");
  }
  const overlay = scene.add.graphics();
  overlay.setDepth(96);

  function collectHumanDebugStates() {
    const debugStates = [];
    if (
      humanManager &&
      typeof humanManager.getHumanControllers === "function"
    ) {
      const controllers = humanManager.getHumanControllers();
      for (const controller of controllers) {
        if (typeof controller?.getDebugState !== "function") {
          continue;
        }
        const debug = controller.getDebugState();
        if (debug) {
          debugStates.push(debug);
        }
      }
      return debugStates;
    }
    if (humanController && typeof humanController.getDebugState === "function") {
      const debug = humanController.getDebugState();
      if (debug) {
        debugStates.push(debug);
      }
    }
    return debugStates;
  }

  function drawHumanBars(viewState) {
    const humanDebugStates = collectHumanDebugStates();
    for (const humanDebug of humanDebugStates) {
      const health = humanDebug?.health;
      const world = humanDebug?.worldPosition;
      if (!health || !world) {
        continue;
      }
      drawHpBar(overlay, {
        worldX: world.x,
        worldY: world.y,
        currentHp: health.currentHp,
        maxHp: health.maxHp,
        color: HUMAN_HP_COLOR,
        ...viewState,
      });
    }
  }

  function drawZombieBars(viewState) {
    if (!zombieManager || typeof zombieManager.getDebugState !== "function") {
      return;
    }
    const debugState = zombieManager.getDebugState();
    const zombies = Array.isArray(debugState?.zombies) ? debugState.zombies : [];
    for (const zombie of zombies) {
      const health = zombie?.health;
      const world = zombie?.worldPosition;
      if (!health || !world) {
        continue;
      }
      const hpRect = drawHpBar(overlay, {
        worldX: world.x,
        worldY: world.y,
        currentHp: health.currentHp,
        maxHp: health.maxHp,
        color: ZOMBIE_HP_COLOR,
        ...viewState,
      });
      drawZombieCooldownBar(overlay, hpRect, zombie?.attack || null);
    }
  }

  function renderFrame(viewState) {
    overlay.clear();
    drawHumanBars(viewState);
    drawZombieBars(viewState);
  }

  function destroy() {
    overlay.clear();
    overlay.destroy();
  }

  return {
    renderFrame,
    clear: () => overlay.clear(),
    destroy,
  };
}

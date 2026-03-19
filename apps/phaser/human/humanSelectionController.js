const DRAG_THRESHOLD_PX = 6;
const BOX_FILL_COLOR = 0x6bc7ff;
const BOX_FILL_ALPHA = 0.15;
const BOX_STROKE_COLOR = 0x6bc7ff;
const BOX_STROKE_ALPHA = 0.85;

function normalizedRect(x1, y1, x2, y2) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  return { x, y, w, h };
}

function rectChanged(a, b) {
  if (!a && !b) {
    return false;
  }
  if (!a || !b) {
    return true;
  }
  return a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h;
}

export function createHumanSelectionController({
  scene,
  humanController,
  onSelectionChanged = null,
  dragThresholdPx = DRAG_THRESHOLD_PX,
} = {}) {
  if (!scene || !humanController) {
    throw new Error(
      "createHumanSelectionController requires scene and humanController."
    );
  }

  const overlay = scene.add.graphics();
  overlay.setDepth(80);

  let activePointerId = null;
  let pointerDown = false;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let lastRect = null;

  function applySelection(nextSelected) {
    const wasSelected = humanController.isSelected();
    if (nextSelected) {
      humanController.select();
    } else {
      humanController.deselect();
    }
    const changed = wasSelected !== nextSelected;
    if (changed && typeof onSelectionChanged === "function") {
      onSelectionChanged(nextSelected);
    }
    return changed;
  }

  function drawOverlay() {
    overlay.clear();
    if (!pointerDown || !dragging) {
      return;
    }
    const rect = normalizedRect(startX, startY, currentX, currentY);
    if (rect.w <= 0 || rect.h <= 0) {
      return;
    }
    overlay.fillStyle(BOX_FILL_COLOR, BOX_FILL_ALPHA);
    overlay.fillRect(rect.x, rect.y, rect.w, rect.h);
    overlay.lineStyle(1.5, BOX_STROKE_COLOR, BOX_STROKE_ALPHA);
    overlay.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w, rect.h);
  }

  function onPointerDown(pointer) {
    if (!pointer || pointer.button !== 0) {
      return false;
    }
    if (pointer.event?.ctrlKey) {
      return false;
    }

    activePointerId = pointer.id;
    pointerDown = true;
    dragging = false;
    startX = pointer.x;
    startY = pointer.y;
    currentX = pointer.x;
    currentY = pointer.y;
    lastRect = null;
    drawOverlay();
    return true;
  }

  function onPointerMove(pointer) {
    if (!pointerDown || !pointer || pointer.id !== activePointerId) {
      return false;
    }

    currentX = pointer.x;
    currentY = pointer.y;

    const distance = Math.hypot(currentX - startX, currentY - startY);
    if (!dragging && distance >= dragThresholdPx) {
      dragging = true;
    }

    const nextRect = dragging
      ? normalizedRect(startX, startY, currentX, currentY)
      : null;
    const changed = dragging || rectChanged(lastRect, nextRect);
    lastRect = nextRect;
    drawOverlay();
    return changed;
  }

  function onPointerUp(pointer) {
    if (!pointerDown || !pointer || pointer.id !== activePointerId) {
      return false;
    }

    currentX = pointer.x;
    currentY = pointer.y;
    const wasDragging = dragging;
    pointerDown = false;
    dragging = false;
    activePointerId = null;
    lastRect = null;

    let selectionChanged = false;
    if (wasDragging) {
      const rect = normalizedRect(startX, startY, currentX, currentY);
      if (rect.w < dragThresholdPx && rect.h < dragThresholdPx) {
        selectionChanged = applySelection(
          humanController.containsScreenPoint(currentX, currentY)
        );
      } else {
        selectionChanged = applySelection(
          humanController.intersectsScreenRect(rect)
        );
      }
    } else {
      selectionChanged = applySelection(
        humanController.containsScreenPoint(currentX, currentY)
      );
    }

    drawOverlay();
    return true;
  }

  function updateOverlay() {
    drawOverlay();
  }

  function destroy() {
    overlay.clear();
    overlay.destroy();
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    updateOverlay,
    destroy,
  };
}

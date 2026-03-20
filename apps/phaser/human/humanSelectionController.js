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
  humanController = null,
  getHumanControllers = null,
  onSelectionChanged = null,
  dragThresholdPx = DRAG_THRESHOLD_PX,
} = {}) {
  if (!scene || (!humanController && typeof getHumanControllers !== "function")) {
    throw new Error(
      "createHumanSelectionController requires scene and a human provider."
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
  let shiftHeldAtPointerDown = false;
  const selectedControllers = new Set();

  function getControllersSnapshot() {
    const source =
      typeof getHumanControllers === "function"
        ? getHumanControllers()
        : humanController
          ? [humanController]
          : [];
    if (!Array.isArray(source)) {
      return [];
    }
    const out = [];
    const seen = new Set();
    for (const controller of source) {
      if (!controller || seen.has(controller)) {
        continue;
      }
      seen.add(controller);
      out.push(controller);
    }
    return out;
  }

  function isControllerSelectable(controller) {
    if (!controller) {
      return false;
    }
    const selectable =
      typeof controller.isSelectable === "function"
        ? controller.isSelectable()
        : true;
    if (!selectable) {
      return false;
    }
    if (typeof controller.isDead === "function" && controller.isDead()) {
      return false;
    }
    return true;
  }

  function setControllerSelected(controller, nextSelected) {
    if (!controller) {
      return false;
    }
    const wasSelected = selectedControllers.has(controller);
    const shouldSelect = nextSelected && isControllerSelectable(controller);
    if (wasSelected === shouldSelect) {
      return false;
    }
    if (shouldSelect) {
      selectedControllers.add(controller);
      if (typeof controller.select === "function") {
        controller.select();
      }
    } else {
      selectedControllers.delete(controller);
      if (typeof controller.deselect === "function") {
        controller.deselect();
      }
    }
    return true;
  }

  function emitSelectionChanged() {
    if (typeof onSelectionChanged === "function") {
      onSelectionChanged(getSelectedControllers());
    }
  }

  function pruneSelection() {
    const available = new Set(getControllersSnapshot());
    let changed = false;
    for (const controller of selectedControllers) {
      if (!available.has(controller) || !isControllerSelectable(controller)) {
        selectedControllers.delete(controller);
        if (typeof controller?.deselect === "function") {
          controller.deselect();
        }
        changed = true;
      }
    }
    return changed;
  }

  function clearSelection() {
    let changed = false;
    for (const controller of [...selectedControllers]) {
      changed = setControllerSelected(controller, false) || changed;
    }
    if (changed) {
      emitSelectionChanged();
    }
    return changed;
  }

  function setSelectionSet(nextControllers) {
    const target = new Set();
    if (Array.isArray(nextControllers)) {
      for (const controller of nextControllers) {
        if (isControllerSelectable(controller)) {
          target.add(controller);
        }
      }
    }

    let changed = false;
    for (const controller of [...selectedControllers]) {
      if (!target.has(controller)) {
        changed = setControllerSelected(controller, false) || changed;
      }
    }
    for (const controller of target) {
      changed = setControllerSelected(controller, true) || changed;
    }
    if (changed) {
      emitSelectionChanged();
    }
    return changed;
  }

  function addSelectionSet(addControllers) {
    let changed = false;
    if (Array.isArray(addControllers)) {
      for (const controller of addControllers) {
        changed = setControllerSelected(controller, true) || changed;
      }
    }
    if (changed) {
      emitSelectionChanged();
    }
    return changed;
  }

  function toggleControllerSelection(controller) {
    const changed = setControllerSelected(
      controller,
      !selectedControllers.has(controller)
    );
    if (changed) {
      emitSelectionChanged();
    }
    return changed;
  }

  function findControllerAtPoint(screenX, screenY) {
    const controllers = getControllersSnapshot();
    for (let i = controllers.length - 1; i >= 0; i -= 1) {
      const controller = controllers[i];
      if (!isControllerSelectable(controller)) {
        continue;
      }
      if (typeof controller.containsScreenPoint !== "function") {
        continue;
      }
      if (controller.containsScreenPoint(screenX, screenY)) {
        return controller;
      }
    }
    return null;
  }

  function getControllersInRect(rect) {
    const out = [];
    const controllers = getControllersSnapshot();
    for (const controller of controllers) {
      if (!isControllerSelectable(controller)) {
        continue;
      }
      if (typeof controller.intersectsScreenRect !== "function") {
        continue;
      }
      if (controller.intersectsScreenRect(rect)) {
        out.push(controller);
      }
    }
    return out;
  }

  function getSelectedControllers() {
    pruneSelection();
    return [...selectedControllers];
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
    shiftHeldAtPointerDown = pointer.event?.shiftKey === true;
    lastRect = null;
    pruneSelection();
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
    pruneSelection();

    let selectionChanged = false;
    if (wasDragging) {
      const rect = normalizedRect(startX, startY, currentX, currentY);
      if (rect.w < dragThresholdPx && rect.h < dragThresholdPx) {
        const hit = findControllerAtPoint(currentX, currentY);
        if (shiftHeldAtPointerDown) {
          if (hit) {
            selectionChanged = toggleControllerSelection(hit);
          }
        } else if (hit) {
          selectionChanged = setSelectionSet([hit]);
        } else {
          selectionChanged = clearSelection();
        }
      } else {
        const hits = getControllersInRect(rect);
        if (shiftHeldAtPointerDown) {
          selectionChanged = addSelectionSet(hits);
        } else {
          selectionChanged = setSelectionSet(hits);
        }
      }
    } else {
      const hit = findControllerAtPoint(currentX, currentY);
      if (shiftHeldAtPointerDown) {
        if (hit) {
          selectionChanged = toggleControllerSelection(hit);
        }
      } else if (hit) {
        selectionChanged = setSelectionSet([hit]);
      } else {
        selectionChanged = clearSelection();
      }
    }

    drawOverlay();
    return true;
  }

  function updateOverlay() {
    pruneSelection();
    drawOverlay();
  }

  function destroy() {
    clearSelection();
    overlay.clear();
    overlay.destroy();
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    getSelectedControllers,
    getSelectedCount: () => getSelectedControllers().length,
    clearSelection,
    updateOverlay,
    destroy,
  };
}

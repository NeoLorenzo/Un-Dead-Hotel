export function createKeyboardPanInput({
  speedTilesPerSecond = 24,
  onMove,
  target = document,
} = {}) {
  const pressedKeys = new Set();
  let rafId = null;
  let lastTimestamp = null;

  function directionForKey(key) {
    if (key === "w" || key === "W") {
      return { x: 0, y: -1 };
    }
    if (key === "s" || key === "S") {
      return { x: 0, y: 1 };
    }
    if (key === "a" || key === "A") {
      return { x: -1, y: 0 };
    }
    if (key === "d" || key === "D") {
      return { x: 1, y: 0 };
    }
    return null;
  }

  function computeDirection() {
    let dx = 0;
    let dy = 0;

    for (const key of pressedKeys) {
      const direction = directionForKey(key);
      if (!direction) {
        continue;
      }
      dx += direction.x;
      dy += direction.y;
    }

    if (dx === 0 && dy === 0) {
      return { dx: 0, dy: 0 };
    }

    const length = Math.hypot(dx, dy);
    return {
      dx: dx / length,
      dy: dy / length,
    };
  }

  function frame(timestamp) {
    if (lastTimestamp === null) {
      lastTimestamp = timestamp;
    }
    const deltaSeconds = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
    lastTimestamp = timestamp;

    const direction = computeDirection();
    if (direction.dx !== 0 || direction.dy !== 0) {
      onMove({
        dx: direction.dx * speedTilesPerSecond * deltaSeconds,
        dy: direction.dy * speedTilesPerSecond * deltaSeconds,
      });
    }

    rafId = requestAnimationFrame(frame);
  }

  function handleKeydown(event) {
    if (!directionForKey(event.key)) {
      return;
    }
    pressedKeys.add(event.key);
    event.preventDefault();
  }

  function handleKeyup(event) {
    if (!directionForKey(event.key)) {
      return;
    }
    pressedKeys.delete(event.key);
    event.preventDefault();
  }

  function handleBlur() {
    pressedKeys.clear();
  }

  function start() {
    target.addEventListener("keydown", handleKeydown);
    target.addEventListener("keyup", handleKeyup);
    window.addEventListener("blur", handleBlur);
    if (rafId === null) {
      rafId = requestAnimationFrame(frame);
    }
  }

  function stop() {
    target.removeEventListener("keydown", handleKeydown);
    target.removeEventListener("keyup", handleKeyup);
    window.removeEventListener("blur", handleBlur);
    pressedKeys.clear();
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTimestamp = null;
  }

  return {
    start,
    stop,
  };
}

export function createZoomInput({
  onZoom,
  target = document,
  wheelTarget = target,
  zoomStep = 1,
} = {}) {
  function handleWheel(event) {
    let deltaScale = 1 / 100;
    if (event.deltaMode === 1) {
      deltaScale = 1 / 3;
    } else if (event.deltaMode === 2) {
      deltaScale = 1;
    }
    const delta = -event.deltaY * deltaScale * zoomStep;
    const clamped = Math.max(-4, Math.min(4, delta));
    if (Math.abs(clamped) > 0.0001) {
      onZoom({ delta: clamped, source: "wheel" });
    }
    event.preventDefault();
  }

  function start() {
    wheelTarget.addEventListener("wheel", handleWheel, { passive: false });
  }

  function stop() {
    wheelTarget.removeEventListener("wheel", handleWheel);
  }

  return {
    start,
    stop,
  };
}

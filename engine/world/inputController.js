export function createKeyboardPanInput({
  speedTilesPerSecond = 24,
  onMove,
  target = document,
} = {}) {
  const pressedKeys = new Set();
  let rafId = null;
  let lastTimestamp = null;

  function directionForKey(key) {
    if (key === "ArrowUp" || key === "w" || key === "W") {
      return { x: 0, y: -1 };
    }
    if (key === "ArrowDown" || key === "s" || key === "S") {
      return { x: 0, y: 1 };
    }
    if (key === "ArrowLeft" || key === "a" || key === "A") {
      return { x: -1, y: 0 };
    }
    if (key === "ArrowRight" || key === "d" || key === "D") {
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
    if (event.deltaY < 0) {
      onZoom({ delta: zoomStep, source: "wheel" });
    } else if (event.deltaY > 0) {
      onZoom({ delta: -zoomStep, source: "wheel" });
    }
    event.preventDefault();
  }

  function handleKeydown(event) {
    if (event.key === "=" || event.key === "+") {
      onZoom({ delta: zoomStep, source: "key" });
      event.preventDefault();
      return;
    }
    if (event.key === "-" || event.key === "_") {
      onZoom({ delta: -zoomStep, source: "key" });
      event.preventDefault();
    }
  }

  function start() {
    target.addEventListener("keydown", handleKeydown);
    wheelTarget.addEventListener("wheel", handleWheel, { passive: false });
  }

  function stop() {
    target.removeEventListener("keydown", handleKeydown);
    wheelTarget.removeEventListener("wheel", handleWheel);
  }

  return {
    start,
    stop,
  };
}
